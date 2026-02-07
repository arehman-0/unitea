/**
 * Latent Semantic Indexing (LSI)
 *
 * Simplified LSI implementation for semantic analysis of vote feedback.
 * Uses term frequency vectors and basic dimensionality reduction.
 *
 * Full SVD-based LSI would require additional dependencies (like numeric.js).
 * This implementation uses a simplified approach suitable for our use case.
 */

const natural = require('natural');
const similarity = require('./similarity');
const constants = require('../../config/constants');

// Tokenizer and stemmer
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these',
  'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
  'who', 'whom', 'whose', 'where', 'when', 'why', 'how', 'all', 'each',
  'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just'
]);

/**
 * Preprocess and tokenize text
 *
 * @param {string} text - Input text
 * @returns {string[]} - Processed tokens
 */
function preprocessText(text) {
  if (!text || typeof text !== 'string') return [];

  // Lowercase and tokenize
  const tokens = tokenizer.tokenize(text.toLowerCase());

  // Filter and stem
  return tokens
    .filter(token => token.length > 2 && !STOP_WORDS.has(token))
    .map(token => stemmer.stem(token));
}

/**
 * Build vocabulary from documents
 *
 * @param {string[][]} tokenizedDocs - Array of tokenized documents
 * @returns {Map<string, number>} - Term to index mapping
 */
function buildVocabulary(tokenizedDocs) {
  const vocab = new Map();
  let index = 0;

  for (const doc of tokenizedDocs) {
    for (const term of doc) {
      if (!vocab.has(term)) {
        vocab.set(term, index++);
      }
    }
  }

  return vocab;
}

/**
 * Create term-frequency vector for a document
 *
 * @param {string[]} tokens - Document tokens
 * @param {Map<string, number>} vocabulary - Term to index mapping
 * @returns {number[]} - TF vector
 */
function createTFVector(tokens, vocabulary) {
  const vector = Array(vocabulary.size).fill(0);

  for (const token of tokens) {
    const index = vocabulary.get(token);
    if (index !== undefined) {
      vector[index]++;
    }
  }

  // Normalize by document length
  const docLength = tokens.length || 1;
  return vector.map(v => v / docLength);
}

/**
 * Apply TF-IDF weighting
 *
 * @param {number[][]} tfMatrix - Term-frequency matrix
 * @returns {number[][]} - TF-IDF weighted matrix
 */
function applyTFIDF(tfMatrix) {
  if (tfMatrix.length === 0) return [];

  const numDocs = tfMatrix.length;
  const numTerms = tfMatrix[0].length;

  // Calculate document frequency for each term
  const df = Array(numTerms).fill(0);
  for (const doc of tfMatrix) {
    for (let i = 0; i < numTerms; i++) {
      if (doc[i] > 0) df[i]++;
    }
  }

  // Calculate IDF and apply
  const tfidfMatrix = tfMatrix.map(doc => {
    return doc.map((tf, i) => {
      const idf = df[i] > 0 ? Math.log(numDocs / df[i]) : 0;
      return tf * idf;
    });
  });

  return tfidfMatrix;
}

/**
 * Simplified dimensionality reduction using feature selection
 * (Select top-k features by variance)
 *
 * @param {number[][]} matrix - Input matrix
 * @param {number} k - Target dimensions
 * @returns {Object} - Reduced matrix and feature indices
 */
function reduceDimensions(matrix, k = constants.LSI_DIMENSIONS) {
  if (matrix.length === 0 || matrix[0].length <= k) {
    return { reduced: matrix, indices: Array.from({ length: matrix[0]?.length || 0 }, (_, i) => i) };
  }

  const numTerms = matrix[0].length;

  // Calculate variance for each term
  const variances = [];
  for (let i = 0; i < numTerms; i++) {
    const values = matrix.map(doc => doc[i]);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    variances.push({ index: i, variance });
  }

  // Sort by variance and select top k
  variances.sort((a, b) => b.variance - a.variance);
  const topIndices = variances.slice(0, k).map(v => v.index);

  // Create reduced matrix
  const reduced = matrix.map(doc =>
    topIndices.map(i => doc[i])
  );

  return { reduced, indices: topIndices };
}

/**
 * LSI Model class
 */
class LSIModel {
  constructor() {
    this.vocabulary = null;
    this.featureIndices = null;
    this.documentVectors = [];
    this.trained = false;
  }

  /**
   * Train the LSI model on a corpus of documents
   *
   * @param {string[]} documents - Array of text documents
   * @returns {Object} - Training result
   */
  train(documents) {
    if (!documents || documents.length < 2) {
      return { success: false, error: 'Need at least 2 documents' };
    }

    // Tokenize all documents
    const tokenizedDocs = documents.map(doc => preprocessText(doc));

    // Build vocabulary
    this.vocabulary = buildVocabulary(tokenizedDocs);

    if (this.vocabulary.size === 0) {
      return { success: false, error: 'No valid terms found' };
    }

    // Create TF matrix
    const tfMatrix = tokenizedDocs.map(doc =>
      createTFVector(doc, this.vocabulary)
    );

    // Apply TF-IDF
    const tfidfMatrix = applyTFIDF(tfMatrix);

    // Reduce dimensions
    const { reduced, indices } = reduceDimensions(tfidfMatrix);
    this.featureIndices = indices;
    this.documentVectors = reduced;

    this.trained = true;

    return {
      success: true,
      vocabularySize: this.vocabulary.size,
      dimensions: this.featureIndices.length,
      documentCount: documents.length
    };
  }

  /**
   * Transform a new document into the LSI space
   *
   * @param {string} document - Text document
   * @returns {number[]} - Document vector in LSI space
   */
  transform(document) {
    if (!this.trained) {
      throw new Error('Model not trained');
    }

    const tokens = preprocessText(document);
    const tfVector = createTFVector(tokens, this.vocabulary);

    // Select only the features used in training
    return this.featureIndices.map(i => tfVector[i] || 0);
  }

  /**
   * Calculate similarity between a new document and trained documents
   *
   * @param {string} document - New document
   * @returns {number[]} - Similarity scores to each trained document
   */
  getSimilarities(document) {
    const newVector = this.transform(document);
    return this.documentVectors.map(docVec =>
      similarity.cosineSimilarity(newVector, docVec)
    );
  }

  /**
   * Find the most similar trained document
   *
   * @param {string} document - New document
   * @returns {Object} - Index and similarity of best match
   */
  findMostSimilar(document) {
    const newVector = this.transform(document);
    return similarity.findMostSimilar(newVector, this.documentVectors);
  }
}

/**
 * Analyze feedback texts for a rumor
 *
 * @param {Object[]} feedbacks - Array of { voteId, feedback, voteType }
 * @returns {Object} - Analysis results with semantic weights
 */
function analyzeFeedback(feedbacks) {
  if (!feedbacks || feedbacks.length < constants.MIN_CLUSTER_SIZE) {
    // Not enough feedback for analysis
    return feedbacks.map(f => ({
      voteId: f.voteId,
      semanticWeight: 1.0,
      analyzed: false,
      reason: 'Insufficient feedback for analysis'
    }));
  }

  const model = new LSIModel();
  const texts = feedbacks.map(f => f.feedback);
  const trainResult = model.train(texts);

  if (!trainResult.success) {
    return feedbacks.map(f => ({
      voteId: f.voteId,
      semanticWeight: 1.0,
      analyzed: false,
      reason: trainResult.error
    }));
  }

  // Calculate pairwise similarities
  const simMatrix = similarity.similarityMatrix(model.documentVectors);

  // For each feedback, calculate average similarity to same-vote-type group
  const results = feedbacks.map((feedback, idx) => {
    // Find same-type votes
    const sameTypeIndices = feedbacks
      .map((f, i) => f.voteType === feedback.voteType ? i : -1)
      .filter(i => i !== -1 && i !== idx);

    if (sameTypeIndices.length === 0) {
      return {
        voteId: feedback.voteId,
        semanticWeight: 1.0,
        analyzed: true,
        reason: 'Only vote of this type'
      };
    }

    // Calculate average similarity to same-type votes
    const avgSimilarity = sameTypeIndices.reduce((sum, i) =>
      sum + simMatrix[idx][i], 0) / sameTypeIndices.length;

    // If feedback is very different from others with same vote, reduce weight
    let semanticWeight = 1.0;
    if (avgSimilarity < constants.SIMILARITY_THRESHOLD) {
      // Low similarity suggests generic or irrelevant feedback
      semanticWeight = Math.max(0.1, avgSimilarity);
    }

    return {
      voteId: feedback.voteId,
      semanticWeight,
      avgSimilarity,
      analyzed: true,
      reason: avgSimilarity < constants.SIMILARITY_THRESHOLD
        ? 'Feedback inconsistent with similar votes'
        : 'Feedback consistent'
    };
  });

  return results;
}

module.exports = {
  LSIModel,
  preprocessText,
  buildVocabulary,
  createTFVector,
  applyTFIDF,
  reduceDimensions,
  analyzeFeedback
};
