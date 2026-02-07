/**
 * Semantic Clustering
 *
 * Groups vote feedback into semantic clusters for analysis.
 * Used to detect coordinated voting patterns and stealth swarms.
 */

const lsi = require('./lsi');
const similarity = require('./similarity');
const constants = require('../../config/constants');

/**
 * Simple K-means clustering implementation
 *
 * @param {number[][]} vectors - Vectors to cluster
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations
 * @returns {Object} - Cluster assignments and centroids
 */
function kMeans(vectors, k = 2, maxIterations = 50) {
  if (vectors.length < k) {
    // Not enough vectors, put each in its own cluster
    return {
      assignments: vectors.map((_, i) => i),
      centroids: vectors.slice(0, k),
      converged: true,
      iterations: 0
    };
  }

  // Initialize centroids randomly (first k vectors)
  let centroids = vectors.slice(0, k).map(v => [...v]);
  let assignments = Array(vectors.length).fill(0);
  let iterations = 0;
  let changed = true;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Assign each vector to nearest centroid
    for (let i = 0; i < vectors.length; i++) {
      const { index } = similarity.findMostSimilar(vectors[i], centroids);
      if (index !== assignments[i]) {
        assignments[i] = index;
        changed = true;
      }
    }

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterVectors = vectors.filter((_, i) => assignments[i] === c);
      if (clusterVectors.length > 0) {
        centroids[c] = similarity.calculateCentroid(clusterVectors);
      }
    }
  }

  return {
    assignments,
    centroids,
    converged: !changed,
    iterations
  };
}

/**
 * Cluster feedback by semantic similarity
 *
 * @param {Object[]} feedbacks - Array of { voteId, feedback, voteType }
 * @returns {Object} - Clustering results
 */
function clusterFeedback(feedbacks) {
  if (!feedbacks || feedbacks.length < 2) {
    return {
      success: false,
      error: 'Need at least 2 feedbacks to cluster',
      clusters: []
    };
  }

  // Train LSI model
  const model = new lsi.LSIModel();
  const texts = feedbacks.map(f => f.feedback);
  const trainResult = model.train(texts);

  if (!trainResult.success) {
    return {
      success: false,
      error: trainResult.error,
      clusters: []
    };
  }

  // Determine number of clusters (2 for confirm/deny, or more if detected)
  const k = Math.min(feedbacks.length, 2);

  // Perform clustering
  const { assignments, centroids, converged } = kMeans(model.documentVectors, k);

  // Group feedbacks by cluster
  const clusters = [];
  for (let c = 0; c < k; c++) {
    const clusterFeedbacks = feedbacks.filter((_, i) => assignments[i] === c);
    const voteTypes = clusterFeedbacks.map(f => f.voteType);
    const dominantVoteType = mode(voteTypes);

    clusters.push({
      id: c,
      feedbacks: clusterFeedbacks,
      size: clusterFeedbacks.length,
      dominantVoteType,
      centroid: centroids[c],
      coherence: calculateClusterCoherence(
        clusterFeedbacks.map((_, i) =>
          model.documentVectors[feedbacks.indexOf(clusterFeedbacks[i])]
        )
      )
    });
  }

  return {
    success: true,
    clusters,
    converged,
    totalFeedbacks: feedbacks.length
  };
}

/**
 * Calculate coherence of a cluster (average pairwise similarity)
 */
function calculateClusterCoherence(vectors) {
  if (vectors.length < 2) return 1.0;

  let totalSim = 0;
  let count = 0;

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      totalSim += similarity.cosineSimilarity(vectors[i], vectors[j]);
      count++;
    }
  }

  return count > 0 ? totalSim / count : 0;
}

/**
 * Find mode (most frequent value) in array
 */
function mode(arr) {
  const counts = {};
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Detect stealth swarm patterns
 *
 * A stealth swarm is when multiple users vote the same way with
 * suspiciously similar or generic feedback.
 *
 * @param {Object[]} feedbacks - Array of feedback objects
 * @returns {Object} - Detection results
 */
function detectStealthSwarm(feedbacks) {
  if (!feedbacks || feedbacks.length < constants.MIN_CLUSTER_SIZE) {
    return {
      detected: false,
      reason: 'Insufficient data',
      suspiciousVotes: []
    };
  }

  // Cluster the feedback
  const clusterResult = clusterFeedback(feedbacks);

  if (!clusterResult.success) {
    return {
      detected: false,
      reason: clusterResult.error,
      suspiciousVotes: []
    };
  }

  const suspiciousVotes = [];

  for (const cluster of clusterResult.clusters) {
    // High coherence with many votes of same type = potential swarm
    if (cluster.coherence > 0.85 && cluster.size >= 3) {
      // Check if all votes are same type
      const allSameType = cluster.feedbacks.every(
        f => f.voteType === cluster.dominantVoteType
      );

      if (allSameType) {
        suspiciousVotes.push(...cluster.feedbacks.map(f => ({
          voteId: f.voteId,
          clusterId: cluster.id,
          coherence: cluster.coherence,
          reason: 'Suspiciously similar feedback pattern'
        })));
      }
    }
  }

  return {
    detected: suspiciousVotes.length >= 3,
    reason: suspiciousVotes.length >= 3
      ? 'Coordinated voting pattern detected'
      : 'No stealth swarm detected',
    suspiciousVotes,
    clusters: clusterResult.clusters.map(c => ({
      id: c.id,
      size: c.size,
      dominantVoteType: c.dominantVoteType,
      coherence: c.coherence
    }))
  };
}

/**
 * Analyze feedback and assign semantic weights
 *
 * @param {Object[]} feedbacks - Array of feedback objects
 * @returns {Object[]} - Feedbacks with semantic weights
 */
function assignSemanticWeights(feedbacks) {
  if (!feedbacks || feedbacks.length < constants.MIN_CLUSTER_SIZE) {
    return feedbacks.map(f => ({
      ...f,
      semanticWeight: 1.0,
      reason: 'Insufficient data for semantic analysis'
    }));
  }

  // First, detect any stealth swarm
  const swarmDetection = detectStealthSwarm(feedbacks);

  // Create a map of suspicious vote IDs
  const suspiciousIds = new Set(
    swarmDetection.suspiciousVotes.map(v => v.voteId)
  );

  // Use LSI to get individual semantic weights
  const lsiWeights = lsi.analyzeFeedback(feedbacks);
  const lsiWeightMap = new Map(lsiWeights.map(w => [w.voteId, w]));

  return feedbacks.map(f => {
    const lsiResult = lsiWeightMap.get(f.voteId) || { semanticWeight: 1.0 };
    let semanticWeight = lsiResult.semanticWeight;
    let reason = lsiResult.reason || 'Normal';

    // Apply penalty for suspicious votes
    if (suspiciousIds.has(f.voteId)) {
      semanticWeight *= 0.3;  // Reduce weight by 70%
      reason = 'Potential swarm participant';
    }

    return {
      voteId: f.voteId,
      voterTokenId: f.voterTokenId,
      voteType: f.voteType,
      semanticWeight: Math.max(0.1, semanticWeight),
      reason
    };
  });
}

module.exports = {
  kMeans,
  clusterFeedback,
  calculateClusterCoherence,
  detectStealthSwarm,
  assignSemanticWeights
};
