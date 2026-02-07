/**
 * Retroactive Audit Service - Phase 3 Defense
 *
 * Runs periodically (every 24 hours) to:
 * 1. Determine "Emergent Truth" for mature rumors
 * 2. Reward users who aligned with truth (+trust)
 * 3. Penalize users who opposed truth (-trust)
 * 4. Apply forgetting factor to old impacts
 */

const Rumor = require('../models/Rumor');
const Vote = require('../models/Vote');
const User = require('../models/User');
const constants = require('../config/constants');

/**
 * Determine the emergent truth for a rumor based on weighted votes
 *
 * @param {Object} rumor - Rumor object
 * @returns {string} - 'CONFIRMED', 'DENIED', or 'UNDETERMINED'
 */
function determineEmergentTruth(rumor) {
  const total = rumor.weightedConfirmVotes + rumor.weightedDenyVotes;

  if (total === 0) {
    return 'UNDETERMINED';
  }

  const confirmRatio = rumor.weightedConfirmVotes / total;

  // Need clear majority (>60%) to determine truth
  if (confirmRatio > 0.6) {
    return 'CONFIRMED';
  } else if (confirmRatio < 0.4) {
    return 'DENIED';
  }

  return 'UNDETERMINED';
}

/**
 * Audit a single rumor and update user trust scores
 *
 * @param {string} rumorId - Rumor to audit
 * @returns {Object} - Audit results
 */
function auditRumor(rumorId) {
  const rumor = Rumor.getRumorById(rumorId);

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  // Determine emergent truth
  const emergentTruth = determineEmergentTruth(rumor);

  // Set the rumor's emergent truth
  Rumor.setEmergentTruth(rumorId, emergentTruth);

  // Get all votes for this rumor
  const votes = Vote.getVotesForRumor(rumorId);

  if (votes.length === 0) {
    // Finalize without user updates
    Rumor.finalizeRumor(rumorId);
    return {
      success: true,
      rumorId,
      emergentTruth,
      usersUpdated: 0,
      rewarded: 0,
      penalized: 0
    };
  }

  // Determine correct vote type based on emergent truth
  let correctVoteType = null;
  if (emergentTruth === 'CONFIRMED') {
    correctVoteType = constants.VOTE_TYPES.CONFIRM;
  } else if (emergentTruth === 'DENIED') {
    correctVoteType = constants.VOTE_TYPES.DENY;
  }

  // Calculate trust updates for each user
  const trustUpdates = [];
  let rewarded = 0;
  let penalized = 0;

  for (const vote of votes) {
    if (emergentTruth === 'UNDETERMINED') {
      // No reward or penalty for undetermined rumors
      Vote.markVoteAudited(vote.id, null);
      continue;
    }

    const aligned = vote.voteType === correctVoteType;

    // Calculate delta based on vote weight
    // Weighted votes have more impact on trust changes
    let delta;
    if (aligned) {
      delta = constants.TRUST_REWARD * vote.finalWeight;
      rewarded++;
    } else {
      delta = -constants.TRUST_PENALTY * vote.finalWeight;
      penalized++;
    }

    trustUpdates.push({
      tokenId: vote.voterTokenId,
      delta,
      correct: aligned
    });

    Vote.markVoteAudited(vote.id, aligned);
  }

  // Batch update trust scores
  if (trustUpdates.length > 0) {
    User.batchUpdateTrustScores(trustUpdates);
  }

  // Finalize the rumor
  Rumor.finalizeRumor(rumorId);

  return {
    success: true,
    rumorId,
    emergentTruth,
    usersUpdated: trustUpdates.length,
    rewarded,
    penalized
  };
}

/**
 * Run full audit cycle on all eligible rumors
 *
 * @returns {Object} - Audit cycle summary
 */
function runAuditCycle() {
  // Get all rumors past the consensus window that aren't finalized
  const pendingRumors = Rumor.getAllRumors({ pendingAudit: true });

  const results = {
    processed: 0,
    confirmed: 0,
    denied: 0,
    undetermined: 0,
    totalRewarded: 0,
    totalPenalized: 0,
    details: []
  };

  for (const rumor of pendingRumors) {
    const auditResult = auditRumor(rumor.id);

    if (auditResult.success) {
      results.processed++;

      if (auditResult.emergentTruth === 'CONFIRMED') {
        results.confirmed++;
      } else if (auditResult.emergentTruth === 'DENIED') {
        results.denied++;
      } else {
        results.undetermined++;
      }

      results.totalRewarded += auditResult.rewarded || 0;
      results.totalPenalized += auditResult.penalized || 0;

      results.details.push({
        rumorId: rumor.id,
        emergentTruth: auditResult.emergentTruth,
        rewarded: auditResult.rewarded,
        penalized: auditResult.penalized
      });
    }
  }

  return results;
}

/**
 * Apply forgetting factor to all user trust scores
 * This decays old trust impacts over time
 *
 * @returns {Object} - Decay application summary
 */
function applyTrustDecay() {
  const users = User.loadUsers();
  let updated = 0;

  for (const tokenId in users) {
    const user = users[tokenId];
    const oldScore = user.trustScore;

    // Apply forgetting factor
    // Scores drift toward the mean (2.5) over time
    const mean = constants.INITIAL_TRUST_SCORE;
    const newScore = mean + (oldScore - mean) * constants.FORGETTING_FACTOR;

    if (Math.abs(newScore - oldScore) > 0.001) {
      users[tokenId].trustScore = newScore;
      updated++;
    }
  }

  User.saveUsers(users);

  return {
    success: true,
    usersUpdated: updated
  };
}

/**
 * Get audit statistics
 */
function getStats() {
  const rumors = Rumor.loadRumors();
  const rumorList = Object.values(rumors);

  const finalized = rumorList.filter(r =>
    r.state === constants.RUMOR_STATES.FINALIZED ||
    r.state === constants.RUMOR_STATES.EMERGENT_TRUTH
  );

  const confirmed = finalized.filter(r => r.emergentTruth === 'CONFIRMED').length;
  const denied = finalized.filter(r => r.emergentTruth === 'DENIED').length;
  const undetermined = finalized.filter(r => r.emergentTruth === 'UNDETERMINED').length;

  const votes = Vote.loadVotes();
  const voteList = Object.values(votes);
  const auditedVotes = voteList.filter(v => v.audited);

  return {
    totalFinalized: finalized.length,
    confirmed,
    denied,
    undetermined,
    auditedVotes: auditedVotes.length,
    pendingAudit: Rumor.getAllRumors({ pendingAudit: true }).length
  };
}

/**
 * Preview what audit would do without applying changes
 *
 * @param {string} rumorId - Rumor to preview
 * @returns {Object} - Preview of audit actions
 */
function previewAudit(rumorId) {
  const rumor = Rumor.getRumorById(rumorId);

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  const emergentTruth = determineEmergentTruth(rumor);
  const votes = Vote.getVotesForRumor(rumorId);

  let correctVoteType = null;
  if (emergentTruth === 'CONFIRMED') {
    correctVoteType = constants.VOTE_TYPES.CONFIRM;
  } else if (emergentTruth === 'DENIED') {
    correctVoteType = constants.VOTE_TYPES.DENY;
  }

  const preview = votes.map(vote => {
    const aligned = correctVoteType ? vote.voteType === correctVoteType : null;
    let delta = 0;

    if (aligned === true) {
      delta = constants.TRUST_REWARD * vote.finalWeight;
    } else if (aligned === false) {
      delta = -constants.TRUST_PENALTY * vote.finalWeight;
    }

    const user = User.getUserByToken(vote.voterTokenId);

    return {
      voteId: vote.id,
      voterTokenId: vote.voterTokenId.substring(0, 8) + '...',
      voteType: vote.voteType,
      aligned,
      currentTrustScore: user?.trustScore,
      trustDelta: delta,
      projectedTrustScore: user ? Math.max(0, Math.min(5, user.trustScore + delta)) : null
    };
  });

  return {
    success: true,
    rumorId,
    emergentTruth,
    confirmRatio: (rumor.weightedConfirmVotes /
      (rumor.weightedConfirmVotes + rumor.weightedDenyVotes) || 0).toFixed(3),
    votes: preview,
    wouldReward: preview.filter(p => p.aligned === true).length,
    wouldPenalize: preview.filter(p => p.aligned === false).length
  };
}

module.exports = {
  determineEmergentTruth,
  auditRumor,
  runAuditCycle,
  applyTrustDecay,
  previewAudit,
  getStats
};
