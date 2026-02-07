/**
 * Vote Model
 *
 * Vote records with mandatory text feedback for semantic analysis.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const constants = require('../config/constants');

/**
 * Load votes data
 */
function loadVotes() {
  const filePath = path.resolve(constants.VOTES_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading votes:', error.message);
  }
  return {};
}

/**
 * Save votes data
 */
function saveVotes(votes) {
  const filePath = path.resolve(constants.VOTES_FILE);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(votes, null, 2));
}

/**
 * Create a new vote object
 */
function createVoteObject(rumorId, voterTokenId, voteType, feedback, voterTrustScore) {
  // Calculate initial weight based on voter's trust score
  const baseWeight = voterTrustScore / constants.MAX_TRUST_SCORE;

  return {
    id: uuidv4(),
    rumorId,
    voterTokenId,
    voteType,  // CONFIRM or DENY
    feedback,  // Mandatory text explanation

    // Weight calculations
    baseWeight,
    semanticWeight: 1.0,     // Adjusted by semantic analysis
    collusionWeight: 1.0,    // Adjusted by anti-collusion
    finalWeight: baseWeight, // baseWeight * semanticWeight * collusionWeight

    // Audit tracking
    audited: false,
    alignedWithTruth: null,  // Set during audit

    // Timestamps
    createdAt: new Date().toISOString(),
    auditedAt: null
  };
}

/**
 * Cast a vote on a rumor
 */
function castVote(rumorId, voterTokenId, voteType, feedback, voterTrustScore) {
  const votes = loadVotes();

  // Check for duplicate vote
  const existingVote = Object.values(votes).find(
    v => v.rumorId === rumorId && v.voterTokenId === voterTokenId
  );

  if (existingVote) {
    return {
      success: false,
      error: 'User has already voted on this rumor'
    };
  }

  // Validate feedback length
  if (!feedback || feedback.trim().length < 10) {
    return {
      success: false,
      error: 'Feedback must be at least 10 characters'
    };
  }

  // Create vote
  const vote = createVoteObject(
    rumorId,
    voterTokenId,
    voteType,
    feedback.trim(),
    voterTrustScore
  );

  votes[vote.id] = vote;
  saveVotes(votes);

  return {
    success: true,
    vote
  };
}

/**
 * Get vote by ID
 */
function getVoteById(id) {
  const votes = loadVotes();
  return votes[id] || null;
}

/**
 * Get all votes for a rumor
 */
function getVotesForRumor(rumorId) {
  const votes = loadVotes();
  return Object.values(votes).filter(v => v.rumorId === rumorId);
}

/**
 * Get user's vote on a rumor
 */
function getUserVoteOnRumor(rumorId, voterTokenId) {
  const votes = loadVotes();
  return Object.values(votes).find(
    v => v.rumorId === rumorId && v.voterTokenId === voterTokenId
  ) || null;
}

/**
 * Get all votes by a user
 */
function getVotesByUser(voterTokenId) {
  const votes = loadVotes();
  return Object.values(votes).filter(v => v.voterTokenId === voterTokenId);
}

/**
 * Update vote's semantic weight (from LSI analysis)
 */
function updateSemanticWeight(voteId, semanticWeight) {
  const votes = loadVotes();
  const vote = votes[voteId];

  if (!vote) {
    return { success: false, error: 'Vote not found' };
  }

  vote.semanticWeight = semanticWeight;
  vote.finalWeight = vote.baseWeight * vote.semanticWeight * vote.collusionWeight;

  saveVotes(votes);
  return { success: true, vote };
}

/**
 * Update vote's collusion weight (from anti-collusion analysis)
 */
function updateCollusionWeight(voteId, collusionWeight) {
  const votes = loadVotes();
  const vote = votes[voteId];

  if (!vote) {
    return { success: false, error: 'Vote not found' };
  }

  vote.collusionWeight = collusionWeight;
  vote.finalWeight = vote.baseWeight * vote.semanticWeight * vote.collusionWeight;

  saveVotes(votes);
  return { success: true, vote };
}

/**
 * Mark vote as audited with truth alignment
 */
function markVoteAudited(voteId, alignedWithTruth) {
  const votes = loadVotes();
  const vote = votes[voteId];

  if (!vote) {
    return { success: false, error: 'Vote not found' };
  }

  vote.audited = true;
  vote.alignedWithTruth = alignedWithTruth;
  vote.auditedAt = new Date().toISOString();

  saveVotes(votes);
  return { success: true, vote };
}

/**
 * Get unaudited votes for rumors older than consensus window
 */
function getVotesPendingAudit() {
  const votes = loadVotes();
  const Rumor = require('./Rumor');

  const pendingRumors = Rumor.getAllRumors({ pendingAudit: true });
  const pendingRumorIds = new Set(pendingRumors.map(r => r.id));

  return Object.values(votes).filter(v =>
    !v.audited && pendingRumorIds.has(v.rumorId)
  );
}

/**
 * Get feedback texts for a rumor (for clustering)
 */
function getFeedbackForRumor(rumorId) {
  const votes = getVotesForRumor(rumorId);
  return votes.map(v => ({
    voteId: v.id,
    voteType: v.voteType,
    feedback: v.feedback,
    voterTokenId: v.voterTokenId
  }));
}

/**
 * Get voting correlation data between users
 * Returns pairs of users who voted on same rumors
 */
function getVotingCorrelationData() {
  const votes = loadVotes();
  const voteList = Object.values(votes);

  // Group votes by rumor
  const votesByRumor = {};
  for (const vote of voteList) {
    if (!votesByRumor[vote.rumorId]) {
      votesByRumor[vote.rumorId] = [];
    }
    votesByRumor[vote.rumorId].push(vote);
  }

  // Build correlation data
  const correlations = {};

  for (const rumorId in votesByRumor) {
    const rumorVotes = votesByRumor[rumorId];

    for (let i = 0; i < rumorVotes.length; i++) {
      for (let j = i + 1; j < rumorVotes.length; j++) {
        const user1 = rumorVotes[i].voterTokenId;
        const user2 = rumorVotes[j].voterTokenId;
        const sameVote = rumorVotes[i].voteType === rumorVotes[j].voteType;

        // Create consistent key for user pair
        const pairKey = [user1, user2].sort().join('|');

        if (!correlations[pairKey]) {
          correlations[pairKey] = {
            user1: pairKey.split('|')[0],
            user2: pairKey.split('|')[1],
            sharedVotes: 0,
            agreementCount: 0
          };
        }

        correlations[pairKey].sharedVotes++;
        if (sameVote) {
          correlations[pairKey].agreementCount++;
        }
      }
    }
  }

  return Object.values(correlations);
}

/**
 * Batch update votes (for efficiency during audit)
 */
function batchUpdateVotes(updates) {
  const votes = loadVotes();
  let updatedCount = 0;

  for (const update of updates) {
    const vote = votes[update.voteId];
    if (!vote) continue;

    if (update.semanticWeight !== undefined) {
      vote.semanticWeight = update.semanticWeight;
    }
    if (update.collusionWeight !== undefined) {
      vote.collusionWeight = update.collusionWeight;
    }
    if (update.audited !== undefined) {
      vote.audited = update.audited;
      vote.auditedAt = new Date().toISOString();
    }
    if (update.alignedWithTruth !== undefined) {
      vote.alignedWithTruth = update.alignedWithTruth;
    }

    // Recalculate final weight
    vote.finalWeight = vote.baseWeight * vote.semanticWeight * vote.collusionWeight;
    updatedCount++;
  }

  saveVotes(votes);
  return { success: true, updatedCount };
}

/**
 * Get vote statistics
 */
function getVoteStats() {
  const votes = loadVotes();
  const voteList = Object.values(votes);

  const confirmVotes = voteList.filter(v => v.voteType === constants.VOTE_TYPES.CONFIRM).length;
  const denyVotes = voteList.filter(v => v.voteType === constants.VOTE_TYPES.DENY).length;
  const auditedVotes = voteList.filter(v => v.audited).length;

  return {
    total: voteList.length,
    confirm: confirmVotes,
    deny: denyVotes,
    audited: auditedVotes,
    pending: voteList.length - auditedVotes
  };
}

module.exports = {
  castVote,
  getVoteById,
  getVotesForRumor,
  getUserVoteOnRumor,
  getVotesByUser,
  updateSemanticWeight,
  updateCollusionWeight,
  markVoteAudited,
  getVotesPendingAudit,
  getFeedbackForRumor,
  getVotingCorrelationData,
  batchUpdateVotes,
  getVoteStats,
  loadVotes,
  saveVotes
};
