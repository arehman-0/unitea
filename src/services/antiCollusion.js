/**
 * Anti-Collusion Service
 *
 * Detects coordinated voting behavior between users and reduces
 * their vote weights accordingly.
 *
 * Formula: W_i = base_weight / (1 + correlation_score)
 *
 * High correlation (voting in lockstep) → Reduced weight
 * Independent voters maintain full weight
 */

const Vote = require('../models/Vote');
const User = require('../models/User');
const constants = require('../config/constants');

/**
 * Calculate Pearson correlation coefficient between two users' voting patterns
 *
 * @param {Object[]} user1Votes - Votes by user 1
 * @param {Object[]} user2Votes - Votes by user 2
 * @returns {number} - Correlation coefficient (-1 to 1)
 */
function calculateVotingCorrelation(user1Votes, user2Votes) {
  // Find shared rumors
  const user1ByRumor = new Map(user1Votes.map(v => [v.rumorId, v]));
  const user2ByRumor = new Map(user2Votes.map(v => [v.rumorId, v]));

  const sharedRumors = [...user1ByRumor.keys()].filter(r => user2ByRumor.has(r));

  if (sharedRumors.length < constants.MIN_SHARED_VOTES) {
    return 0; // Not enough shared votes to determine correlation
  }

  // Convert votes to numeric: CONFIRM = 1, DENY = -1
  const votes1 = sharedRumors.map(r =>
    user1ByRumor.get(r).voteType === constants.VOTE_TYPES.CONFIRM ? 1 : -1
  );
  const votes2 = sharedRumors.map(r =>
    user2ByRumor.get(r).voteType === constants.VOTE_TYPES.CONFIRM ? 1 : -1
  );

  // Calculate Pearson correlation
  const n = votes1.length;
  const mean1 = votes1.reduce((a, b) => a + b, 0) / n;
  const mean2 = votes2.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = votes1[i] - mean1;
    const diff2 = votes2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }

  const denominator = Math.sqrt(sum1Sq * sum2Sq);

  if (denominator === 0) {
    // All votes are the same (perfect agreement or disagreement)
    return votes1[0] === votes2[0] ? 1 : -1;
  }

  return numerator / denominator;
}

/**
 * Build correlation matrix for all users
 *
 * @returns {Object} - Correlation data
 */
function buildCorrelationMatrix() {
  const correlationData = Vote.getVotingCorrelationData();

  // Calculate correlation for each pair
  const correlations = [];

  for (const pair of correlationData) {
    if (pair.sharedVotes < constants.MIN_SHARED_VOTES) {
      continue;
    }

    // Agreement ratio as simple correlation measure
    const correlation = (pair.agreementCount / pair.sharedVotes) * 2 - 1;

    correlations.push({
      user1: pair.user1,
      user2: pair.user2,
      sharedVotes: pair.sharedVotes,
      agreementCount: pair.agreementCount,
      correlation
    });
  }

  return correlations;
}

/**
 * Calculate collusion score for a user
 *
 * @param {string} tokenId - User's token ID
 * @returns {Object} - Collusion analysis
 */
function analyzeUserCollusion(tokenId) {
  const correlations = buildCorrelationMatrix();

  // Find all correlations involving this user
  const userCorrelations = correlations.filter(
    c => c.user1 === tokenId || c.user2 === tokenId
  );

  if (userCorrelations.length === 0) {
    return {
      tokenId,
      collusionScore: 0,
      highlyCorrelatedUsers: [],
      analysis: 'No significant voting patterns detected'
    };
  }

  // Calculate average correlation with other users
  const avgCorrelation = userCorrelations.reduce(
    (sum, c) => sum + Math.abs(c.correlation), 0
  ) / userCorrelations.length;

  // Find highly correlated users (potential colluders)
  const highlyCorrelated = userCorrelations
    .filter(c => c.correlation > constants.CORRELATION_THRESHOLD)
    .map(c => ({
      userId: c.user1 === tokenId ? c.user2 : c.user1,
      correlation: c.correlation,
      sharedVotes: c.sharedVotes
    }));

  // Collusion score: 0 = independent, 1 = highly colluding
  const collusionScore = Math.min(1, avgCorrelation * (1 + highlyCorrelated.length * 0.2));

  return {
    tokenId,
    collusionScore,
    highlyCorrelatedUsers: highlyCorrelated,
    totalCorrelations: userCorrelations.length,
    analysis: collusionScore > 0.5
      ? 'Suspicious voting pattern detected'
      : 'Normal voting behavior'
  };
}

/**
 * Calculate collusion weight for a vote
 *
 * @param {string} voterTokenId - Voter's token ID
 * @returns {number} - Weight multiplier (0 to 1)
 */
function calculateCollusionWeight(voterTokenId) {
  const analysis = analyzeUserCollusion(voterTokenId);

  // W = 1 / (1 + collusionScore)
  // collusionScore = 0 → W = 1 (full weight)
  // collusionScore = 1 → W = 0.5 (half weight)
  const weight = 1 / (1 + analysis.collusionScore);

  return {
    weight,
    collusionScore: analysis.collusionScore,
    reason: analysis.analysis
  };
}

/**
 * Update collusion weights for all votes on a rumor
 *
 * @param {string} rumorId - Rumor to process
 * @returns {Object} - Update summary
 */
function processRumorCollusion(rumorId) {
  const votes = Vote.getVotesForRumor(rumorId);
  const updates = [];

  for (const vote of votes) {
    const { weight, collusionScore, reason } = calculateCollusionWeight(vote.voterTokenId);

    updates.push({
      voteId: vote.id,
      collusionWeight: weight
    });
  }

  Vote.batchUpdateVotes(updates);

  return {
    success: true,
    rumorId,
    votesProcessed: updates.length,
    averageCollusionWeight: updates.length > 0
      ? (updates.reduce((sum, u) => sum + u.collusionWeight, 0) / updates.length).toFixed(3)
      : 1.0
  };
}

/**
 * Run anti-collusion analysis on all active rumors
 *
 * @returns {Object} - Analysis summary
 */
function runCollusionAnalysis() {
  const rumors = require('../models/Rumor').getAllRumors({
    includeArchived: false
  });

  const results = [];

  for (const rumor of rumors) {
    const result = processRumorCollusion(rumor.id);
    results.push(result);
  }

  return {
    rumorsProcessed: results.length,
    details: results
  };
}

/**
 * Detect collusion rings (groups of users who always vote together)
 *
 * @returns {Object[]} - Detected collusion rings
 */
function detectCollusionRings() {
  const correlations = buildCorrelationMatrix();
  const highCorrelations = correlations.filter(
    c => c.correlation > constants.CORRELATION_THRESHOLD
  );

  // Build adjacency list
  const graph = new Map();
  for (const c of highCorrelations) {
    if (!graph.has(c.user1)) graph.set(c.user1, new Set());
    if (!graph.has(c.user2)) graph.set(c.user2, new Set());
    graph.get(c.user1).add(c.user2);
    graph.get(c.user2).add(c.user1);
  }

  // Find connected components (collusion rings)
  const visited = new Set();
  const rings = [];

  for (const user of graph.keys()) {
    if (visited.has(user)) continue;

    const ring = [];
    const queue = [user];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;

      visited.add(current);
      ring.push(current);

      const neighbors = graph.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }

    if (ring.length >= 2) {
      rings.push({
        members: ring,
        size: ring.length,
        averageCorrelation: calculateRingCorrelation(ring, highCorrelations)
      });
    }
  }

  return rings.sort((a, b) => b.size - a.size);
}

/**
 * Calculate average correlation within a ring
 */
function calculateRingCorrelation(ring, correlations) {
  const ringSet = new Set(ring);
  const ringCorrelations = correlations.filter(
    c => ringSet.has(c.user1) && ringSet.has(c.user2)
  );

  if (ringCorrelations.length === 0) return 0;

  return ringCorrelations.reduce((sum, c) => sum + c.correlation, 0) / ringCorrelations.length;
}

/**
 * Get anti-collusion statistics
 */
function getStats() {
  const correlations = buildCorrelationMatrix();
  const rings = detectCollusionRings();

  return {
    totalUserPairs: correlations.length,
    highlyCorrelatedPairs: correlations.filter(
      c => c.correlation > constants.CORRELATION_THRESHOLD
    ).length,
    detectedRings: rings.length,
    largestRingSize: rings.length > 0 ? rings[0].size : 0,
    averageCorrelation: correlations.length > 0
      ? (correlations.reduce((sum, c) => sum + c.correlation, 0) / correlations.length).toFixed(3)
      : 0
  };
}

module.exports = {
  calculateVotingCorrelation,
  buildCorrelationMatrix,
  analyzeUserCollusion,
  calculateCollusionWeight,
  processRumorCollusion,
  runCollusionAnalysis,
  detectCollusionRings,
  getStats
};
