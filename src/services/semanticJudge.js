/**
 * Semantic Judge Service - Phase 2 Defense
 *
 * Analyzes vote feedback using LSI/semantic clustering.
 * Reduces vote weights for users with generic or inconsistent feedback.
 * Detects "stealth swarms" - coordinated votes with similar generic text.
 */

const Vote = require('../models/Vote');
const Rumor = require('../models/Rumor');
const User = require('../models/User');
const clustering = require('./qra/clustering');
const lsi = require('./qra/lsi');
const constants = require('../config/constants');

/**
 * Analyze all feedback for a rumor and assign semantic weights
 *
 * @param {string} rumorId - Rumor to analyze
 * @returns {Object} - Analysis results with weight assignments
 */
function analyzeRumorFeedback(rumorId) {
  const rumor = Rumor.getRumorById(rumorId);

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  // Get all feedback for this rumor
  const feedbacks = Vote.getFeedbackForRumor(rumorId);

  if (feedbacks.length < constants.MIN_CLUSTER_SIZE) {
    return {
      success: true,
      rumorId,
      analyzed: false,
      reason: `Insufficient feedback (${feedbacks.length}/${constants.MIN_CLUSTER_SIZE} required)`,
      results: feedbacks.map(f => ({
        voteId: f.voteId,
        semanticWeight: 1.0,
        reason: 'Insufficient data'
      }))
    };
  }

  // Assign semantic weights using clustering
  const weightedResults = clustering.assignSemanticWeights(feedbacks);

  // Update votes with new semantic weights
  const updates = weightedResults.map(result => ({
    voteId: result.voteId,
    semanticWeight: result.semanticWeight
  }));

  Vote.batchUpdateVotes(updates);

  // Recalculate rumor weighted votes
  recalculateRumorWeights(rumorId);

  return {
    success: true,
    rumorId,
    analyzed: true,
    feedbackCount: feedbacks.length,
    results: weightedResults
  };
}

/**
 * Recalculate rumor's weighted vote totals after semantic analysis
 */
function recalculateRumorWeights(rumorId) {
  const votes = Vote.getVotesForRumor(rumorId);
  const rumor = Rumor.getRumorById(rumorId);

  if (!rumor || votes.length === 0) return;

  let weightedConfirm = 0;
  let weightedDeny = 0;

  for (const vote of votes) {
    const weight = vote.finalWeight || (vote.baseWeight * vote.semanticWeight * vote.collusionWeight);

    if (vote.voteType === constants.VOTE_TYPES.CONFIRM) {
      weightedConfirm += weight;
    } else {
      weightedDeny += weight;
    }
  }

  // Update rumor with recalculated weights
  const rumors = Rumor.loadRumors();
  if (rumors[rumorId]) {
    rumors[rumorId].weightedConfirmVotes = weightedConfirm;
    rumors[rumorId].weightedDenyVotes = weightedDeny;

    // Recalculate trust score if not frozen
    if (rumors[rumorId].state !== constants.RUMOR_STATES.PROBATION) {
      rumors[rumorId].trustScore = Rumor.calculateTrustScore(rumors[rumorId]);
    }

    Rumor.saveRumors(rumors);
  }
}

/**
 * Detect stealth swarm attacks on a rumor
 *
 * @param {string} rumorId - Rumor to check
 * @returns {Object} - Detection results
 */
function detectStealthSwarm(rumorId) {
  const feedbacks = Vote.getFeedbackForRumor(rumorId);

  if (feedbacks.length < constants.MIN_CLUSTER_SIZE) {
    return {
      success: true,
      detected: false,
      reason: 'Insufficient feedback for analysis'
    };
  }

  const detection = clustering.detectStealthSwarm(feedbacks);

  // If swarm detected, apply weight penalties
  if (detection.detected) {
    const updates = detection.suspiciousVotes.map(sv => ({
      voteId: sv.voteId,
      semanticWeight: 0.3  // Severe penalty for swarm participants
    }));

    Vote.batchUpdateVotes(updates);
    recalculateRumorWeights(rumorId);
  }

  return {
    success: true,
    rumorId,
    ...detection
  };
}

/**
 * Judge a single vote's feedback quality
 *
 * @param {string} voteId - Vote to analyze
 * @returns {Object} - Judgment result
 */
function judgeVote(voteId) {
  const vote = Vote.getVoteById(voteId);

  if (!vote) {
    return { success: false, error: 'Vote not found' };
  }

  // Get all feedback for the same rumor for comparison
  const allFeedback = Vote.getFeedbackForRumor(vote.rumorId);

  if (allFeedback.length < 2) {
    return {
      success: true,
      voteId,
      semanticWeight: 1.0,
      reason: 'First/only vote, no comparison available'
    };
  }

  // Use LSI to analyze this feedback against others
  const analysis = lsi.analyzeFeedback(allFeedback);
  const voteAnalysis = analysis.find(a => a.voteId === voteId);

  if (voteAnalysis) {
    Vote.updateSemanticWeight(voteId, voteAnalysis.semanticWeight);

    return {
      success: true,
      voteId,
      semanticWeight: voteAnalysis.semanticWeight,
      avgSimilarity: voteAnalysis.avgSimilarity,
      reason: voteAnalysis.reason
    };
  }

  return {
    success: true,
    voteId,
    semanticWeight: 1.0,
    reason: 'Could not analyze'
  };
}

/**
 * Process all PROBATION rumors through semantic analysis
 *
 * @returns {Object} - Processing summary
 */
function processProbationRumors() {
  const probationRumors = Rumor.getAllRumors({
    state: constants.RUMOR_STATES.PROBATION
  });

  const results = [];

  for (const rumor of probationRumors) {
    const analysis = analyzeRumorFeedback(rumor.id);
    const swarmCheck = detectStealthSwarm(rumor.id);

    results.push({
      rumorId: rumor.id,
      feedbackAnalyzed: analysis.feedbackCount || 0,
      swarmDetected: swarmCheck.detected,
      suspiciousVotes: swarmCheck.suspiciousVotes?.length || 0
    });
  }

  return {
    processed: results.length,
    details: results
  };
}

/**
 * Get semantic judge statistics
 */
function getStats() {
  const votes = Vote.loadVotes();
  const voteList = Object.values(votes);

  const weightedVotes = voteList.filter(v => v.semanticWeight !== 1.0);
  const penalizedVotes = voteList.filter(v => v.semanticWeight < 0.5);

  return {
    totalVotes: voteList.length,
    analyzedVotes: weightedVotes.length,
    penalizedVotes: penalizedVotes.length,
    averageSemanticWeight: voteList.length > 0
      ? (voteList.reduce((sum, v) => sum + v.semanticWeight, 0) / voteList.length).toFixed(3)
      : 1.0
  };
}

module.exports = {
  analyzeRumorFeedback,
  detectStealthSwarm,
  judgeVote,
  processProbationRumors,
  recalculateRumorWeights,
  getStats
};
