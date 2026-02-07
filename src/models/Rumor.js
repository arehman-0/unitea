/**
 * Rumor Model
 *
 * Rumor with lifecycle states:
 * NEUTRAL → PROBATION → EMERGENT_TRUTH → FINALIZED
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const constants = require('../config/constants');

/**
 * Load rumors data
 */
function loadRumors() {
  const filePath = path.resolve(constants.RUMORS_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading rumors:', error.message);
  }
  return {};
}

/**
 * Save rumors data
 */
function saveRumors(rumors) {
  const filePath = path.resolve(constants.RUMORS_FILE);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(rumors, null, 2));
}

/**
 * Create a new rumor object
 */
function createRumorObject(content, authorTokenId, category = 'general') {
  const now = new Date().toISOString();

  return {
    id: uuidv4(),
    content,
    authorTokenId,
    category,
    state: constants.RUMOR_STATES.NEUTRAL,

    // Trust scoring
    trustScore: constants.INITIAL_TRUST_SCORE,
    frozenTrustScore: null,  // Frozen during PROBATION

    // Vote counts
    confirmVotes: 0,
    denyVotes: 0,
    weightedConfirmVotes: 0,
    weightedDenyVotes: 0,

    // Velocity tracking for swarm detection
    voteTimestamps: [],

    // Truth determination
    emergentTruth: null,  // 'CONFIRMED', 'DENIED', or 'UNDETERMINED'

    // Timestamps
    createdAt: now,
    stateChangedAt: now,
    finalizedAt: null,

    // Archival
    archived: false,
    archivedAt: null
  };
}

/**
 * Create and save a new rumor
 */
function createRumor(content, authorTokenId, category) {
  const rumors = loadRumors();
  const rumor = createRumorObject(content, authorTokenId, category);

  rumors[rumor.id] = rumor;
  saveRumors(rumors);

  return rumor;
}

/**
 * Get rumor by ID
 */
function getRumorById(id) {
  const rumors = loadRumors();
  return rumors[id] || null;
}

/**
 * Update rumor state
 */
function updateRumorState(id, newState) {
  const rumors = loadRumors();
  const rumor = rumors[id];

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  const oldState = rumor.state;
  rumor.state = newState;
  rumor.stateChangedAt = new Date().toISOString();

  // Freeze trust score when entering PROBATION
  if (newState === constants.RUMOR_STATES.PROBATION &&
      oldState === constants.RUMOR_STATES.NEUTRAL) {
    rumor.frozenTrustScore = rumor.trustScore;
  }

  // Record finalization
  if (newState === constants.RUMOR_STATES.FINALIZED) {
    rumor.finalizedAt = new Date().toISOString();
    // Unfreeze trust score
    if (rumor.frozenTrustScore !== null) {
      rumor.trustScore = calculateTrustScore(rumor);
      rumor.frozenTrustScore = null;
    }
  }

  saveRumors(rumors);
  return { success: true, rumor, oldState, newState };
}

/**
 * Record a vote on a rumor
 */
function recordVote(id, voteType, weight = 1) {
  const rumors = loadRumors();
  const rumor = rumors[id];

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  // Record timestamp for velocity tracking
  rumor.voteTimestamps.push(new Date().toISOString());

  // Update vote counts
  if (voteType === constants.VOTE_TYPES.CONFIRM) {
    rumor.confirmVotes++;
    rumor.weightedConfirmVotes += weight;
  } else if (voteType === constants.VOTE_TYPES.DENY) {
    rumor.denyVotes++;
    rumor.weightedDenyVotes += weight;
  }

  // Recalculate trust score (unless frozen)
  if (rumor.state !== constants.RUMOR_STATES.PROBATION) {
    rumor.trustScore = calculateTrustScore(rumor);
  }

  saveRumors(rumors);
  return { success: true, rumor };
}

/**
 * Update vote weight for a specific vote
 */
function adjustVoteWeight(id, voteType, weightDelta) {
  const rumors = loadRumors();
  const rumor = rumors[id];

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  if (voteType === constants.VOTE_TYPES.CONFIRM) {
    rumor.weightedConfirmVotes += weightDelta;
  } else if (voteType === constants.VOTE_TYPES.DENY) {
    rumor.weightedDenyVotes += weightDelta;
  }

  // Recalculate trust score if not frozen
  if (rumor.state !== constants.RUMOR_STATES.PROBATION) {
    rumor.trustScore = calculateTrustScore(rumor);
  }

  saveRumors(rumors);
  return { success: true, rumor };
}

/**
 * Calculate rumor trust score based on weighted votes
 * Score ranges from 0 (definitely false) to 5 (definitely true)
 */
function calculateTrustScore(rumor) {
  const totalWeighted = rumor.weightedConfirmVotes + rumor.weightedDenyVotes;

  if (totalWeighted === 0) {
    return constants.INITIAL_TRUST_SCORE;
  }

  const confirmRatio = rumor.weightedConfirmVotes / totalWeighted;
  return confirmRatio * constants.MAX_TRUST_SCORE;
}

/**
 * Get vote velocity (votes per minute in recent window)
 */
function getVoteVelocity(id, windowMinutes = constants.VELOCITY_WINDOW_MINUTES) {
  const rumor = getRumorById(id);
  if (!rumor) return 0;

  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  const recentVotes = rumor.voteTimestamps.filter(
    ts => new Date(ts) > windowStart
  );

  return recentVotes.length / windowMinutes;
}

/**
 * Set emergent truth for a rumor
 */
function setEmergentTruth(id, truth) {
  const rumors = loadRumors();
  const rumor = rumors[id];

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  rumor.emergentTruth = truth;
  rumor.state = constants.RUMOR_STATES.EMERGENT_TRUTH;
  rumor.stateChangedAt = new Date().toISOString();

  saveRumors(rumors);
  return { success: true, rumor };
}

/**
 * Finalize a rumor (after audit)
 */
function finalizeRumor(id) {
  return updateRumorState(id, constants.RUMOR_STATES.FINALIZED);
}

/**
 * Get all rumors with optional filtering
 */
function getAllRumors(options = {}) {
  const rumors = loadRumors();
  let result = Object.values(rumors);

  // Exclude archived by default
  if (!options.includeArchived) {
    result = result.filter(r => !r.archived);
  }

  // Filter by state
  if (options.state) {
    result = result.filter(r => r.state === options.state);
  }

  // Filter by category
  if (options.category) {
    result = result.filter(r => r.category === options.category);
  }

  // Filter by age (for audit)
  if (options.olderThanHours) {
    const cutoff = new Date(Date.now() - options.olderThanHours * 60 * 60 * 1000);
    result = result.filter(r => new Date(r.createdAt) < cutoff);
  }

  // Filter for pending audit (older than consensus window, not finalized)
  if (options.pendingAudit) {
    const cutoff = new Date(Date.now() - constants.CONSENSUS_WINDOW_HOURS * 60 * 60 * 1000);
    result = result.filter(r =>
      new Date(r.createdAt) < cutoff &&
      r.state !== constants.RUMOR_STATES.FINALIZED
    );
  }

  // Sort by creation date (newest first by default)
  if (options.sortBy === 'oldest') {
    result.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (options.sortBy === 'trustScore') {
    result.sort((a, b) => b.trustScore - a.trustScore);
  } else {
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Pagination
  if (options.limit) {
    const offset = options.offset || 0;
    result = result.slice(offset, offset + options.limit);
  }

  return result;
}

/**
 * Archive a rumor
 */
function archiveRumor(id) {
  const rumors = loadRumors();
  const rumor = rumors[id];

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  rumor.archived = true;
  rumor.archivedAt = new Date().toISOString();

  saveRumors(rumors);
  return { success: true };
}

/**
 * Get rumors ready for archival
 */
function getRumorsForArchival() {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - constants.ARCHIVE_MONTHS);

  const rumors = loadRumors();
  return Object.values(rumors).filter(r =>
    !r.archived && new Date(r.createdAt) < cutoffDate
  );
}

/**
 * Get rumor statistics
 */
function getRumorStats() {
  const rumors = loadRumors();
  const rumorList = Object.values(rumors).filter(r => !r.archived);

  const states = {};
  for (const state of Object.values(constants.RUMOR_STATES)) {
    states[state] = rumorList.filter(r => r.state === state).length;
  }

  return {
    total: rumorList.length,
    byState: states,
    averageTrustScore: rumorList.length > 0
      ? (rumorList.reduce((sum, r) => sum + r.trustScore, 0) / rumorList.length).toFixed(2)
      : 0
  };
}

module.exports = {
  createRumor,
  getRumorById,
  updateRumorState,
  recordVote,
  adjustVoteWeight,
  calculateTrustScore,
  getVoteVelocity,
  setEmergentTruth,
  finalizeRumor,
  getAllRumors,
  archiveRumor,
  getRumorsForArchival,
  getRumorStats,
  loadRumors,
  saveRumors
};
