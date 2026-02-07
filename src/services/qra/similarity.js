/**
 * Similarity Calculations
 *
 * Cosine similarity and other distance metrics for semantic analysis.
 */

/**
 * Calculate cosine similarity between two vectors
 *
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score between 0 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  if (vecA.length !== vecB.length) {
    // Pad shorter vector with zeros
    const maxLen = Math.max(vecA.length, vecB.length);
    while (vecA.length < maxLen) vecA.push(0);
    while (vecB.length < maxLen) vecB.push(0);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Calculate Euclidean distance between two vectors
 *
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Distance (0 = identical)
 */
function euclideanDistance(vecA, vecB) {
  if (!vecA || !vecB) return Infinity;

  const maxLen = Math.max(vecA.length, vecB.length);
  let sum = 0;

  for (let i = 0; i < maxLen; i++) {
    const a = vecA[i] || 0;
    const b = vecB[i] || 0;
    sum += Math.pow(a - b, 2);
  }

  return Math.sqrt(sum);
}

/**
 * Calculate Jaccard similarity for text tokens
 *
 * @param {string[]} tokensA - First set of tokens
 * @param {string[]} tokensB - Second set of tokens
 * @returns {number} - Similarity between 0 and 1
 */
function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA || !tokensB) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Find most similar vector from a list
 *
 * @param {number[]} target - Vector to compare
 * @param {number[][]} candidates - List of candidate vectors
 * @returns {Object} - Best match with index and similarity
 */
function findMostSimilar(target, candidates) {
  if (!candidates || candidates.length === 0) {
    return { index: -1, similarity: 0 };
  }

  let bestIndex = 0;
  let bestSimilarity = -1;

  for (let i = 0; i < candidates.length; i++) {
    const similarity = cosineSimilarity(target, candidates[i]);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestIndex = i;
    }
  }

  return {
    index: bestIndex,
    similarity: bestSimilarity
  };
}

/**
 * Calculate pairwise similarity matrix
 *
 * @param {number[][]} vectors - List of vectors
 * @returns {number[][]} - Similarity matrix
 */
function similarityMatrix(vectors) {
  const n = vectors.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;  // Self-similarity
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }

  return matrix;
}

/**
 * Calculate average similarity of a vector to a cluster
 *
 * @param {number[]} vector - Vector to compare
 * @param {number[][]} cluster - Cluster of vectors
 * @returns {number} - Average similarity
 */
function averageSimilarityToCluster(vector, cluster) {
  if (!cluster || cluster.length === 0) return 0;

  const similarities = cluster.map(c => cosineSimilarity(vector, c));
  return similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
}

/**
 * Normalize a vector to unit length
 *
 * @param {number[]} vector - Vector to normalize
 * @returns {number[]} - Normalized vector
 */
function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector.map(() => 0);
  return vector.map(v => v / norm);
}

/**
 * Calculate centroid of multiple vectors
 *
 * @param {number[][]} vectors - List of vectors
 * @returns {number[]} - Centroid vector
 */
function calculateCentroid(vectors) {
  if (!vectors || vectors.length === 0) return [];

  const dim = Math.max(...vectors.map(v => v.length));
  const centroid = Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < vec.length; i++) {
      centroid[i] += vec[i];
    }
  }

  return centroid.map(v => v / vectors.length);
}

module.exports = {
  cosineSimilarity,
  euclideanDistance,
  jaccardSimilarity,
  findMostSimilar,
  similarityMatrix,
  averageSimilarityToCluster,
  normalizeVector,
  calculateCentroid
};
