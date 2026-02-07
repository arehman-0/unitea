/**
 * User Model
 *
 * Token-based user with Trust Score.
 * Users are identified ONLY by their Token ID, which is mathematically
 * unlinkable to the email used for registration (blind signatures).
 */

const fs = require('fs');
const path = require('path');
const constants = require('../config/constants');

/**
 * Load users data (List B - completely separate from emails)
 */
function loadUsers() {
  const filePath = path.resolve(constants.USERS_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading users:', error.message);
  }
  return {};
}

/**
 * Save users data
 */
function saveUsers(users) {
  const filePath = path.resolve(constants.USERS_FILE);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
}

/**
 * Create a new user object
 */
function createUserObject(tokenId) {
  return {
    tokenId,
    trustScore: constants.INITIAL_TRUST_SCORE,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    totalVotes: 0,
    correctVotes: 0,
    incorrectVotes: 0,
    rumorsPosted: 0
  };
}

/**
 * Register a new user with their token
 *
 * @param {string} tokenId - The unblinded token ID
 * @param {string} signature - The unblinded signature (stored for verification)
 * @returns {Object} - Result with user data or error
 */
function registerUser(tokenId, signature) {
  const users = loadUsers();

  // Check if token already registered
  if (users[tokenId]) {
    return {
      success: false,
      error: 'Token already registered'
    };
  }

  // Create new user
  const user = createUserObject(tokenId);
  user.signature = signature;  // Store for future authentication

  users[tokenId] = user;
  saveUsers(users);

  return {
    success: true,
    user: {
      tokenId,
      trustScore: user.trustScore,
      createdAt: user.createdAt
    }
  };
}

/**
 * Get user by token ID
 */
function getUserByToken(tokenId) {
  const users = loadUsers();
  return users[tokenId] || null;
}

/**
 * Check if a token exists
 */
function tokenExists(tokenId) {
  const users = loadUsers();
  return tokenId in users;
}

/**
 * Update user's trust score
 *
 * @param {string} tokenId - User's token ID
 * @param {number} delta - Change in trust score (can be negative)
 * @param {boolean} correct - Whether this was a correct vote (for stats)
 * @returns {Object} - Result with old and new scores
 */
function updateTrustScore(tokenId, delta, correct = null) {
  const users = loadUsers();
  const user = users[tokenId];

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  const oldScore = user.trustScore;

  // Apply forgetting factor to existing score, then add delta
  let newScore = oldScore * constants.FORGETTING_FACTOR + delta;

  // Clamp to valid range
  newScore = Math.max(constants.MIN_TRUST_SCORE,
    Math.min(constants.MAX_TRUST_SCORE, newScore));

  user.trustScore = newScore;
  user.lastActiveAt = new Date().toISOString();

  // Update vote outcome stats if provided
  if (correct === true) {
    user.correctVotes++;
  } else if (correct === false) {
    user.incorrectVotes++;
  }

  saveUsers(users);

  return {
    success: true,
    oldScore,
    newScore,
    delta
  };
}

/**
 * Record that user posted a rumor
 */
function incrementRumorsPosted(tokenId) {
  const users = loadUsers();
  const user = users[tokenId];

  if (!user) return { success: false, error: 'User not found' };

  user.rumorsPosted++;
  user.lastActiveAt = new Date().toISOString();

  saveUsers(users);
  return { success: true };
}

/**
 * Record that user cast a vote
 */
function incrementVoteCount(tokenId) {
  const users = loadUsers();
  const user = users[tokenId];

  if (!user) return { success: false, error: 'User not found' };

  user.totalVotes++;
  user.lastActiveAt = new Date().toISOString();

  saveUsers(users);
  return { success: true };
}

/**
 * Get all users for analysis
 */
function getAllUsers() {
  return loadUsers();
}

/**
 * Batch update trust scores (for audit loop efficiency)
 */
function batchUpdateTrustScores(updates) {
  const users = loadUsers();
  let updatedCount = 0;

  for (const update of updates) {
    const { tokenId, delta, correct } = update;
    const user = users[tokenId];

    if (!user) continue;

    const oldScore = user.trustScore;
    let newScore = oldScore + delta;
    newScore = Math.max(constants.MIN_TRUST_SCORE,
      Math.min(constants.MAX_TRUST_SCORE, newScore));

    user.trustScore = newScore;

    if (correct === true) {
      user.correctVotes++;
    } else if (correct === false) {
      user.incorrectVotes++;
    }

    updatedCount++;
  }

  saveUsers(users);
  return { success: true, updatedCount };
}

/**
 * Get user statistics
 */
function getUserStats(tokenId) {
  const user = getUserByToken(tokenId);
  if (!user) return null;

  return {
    trustScore: user.trustScore,
    totalVotes: user.totalVotes,
    correctVotes: user.correctVotes,
    incorrectVotes: user.incorrectVotes,
    accuracy: user.totalVotes > 0
      ? (user.correctVotes / user.totalVotes * 100).toFixed(1) + '%'
      : 'N/A',
    rumorsPosted: user.rumorsPosted,
    memberSince: user.createdAt
  };
}

/**
 * Get system-wide user statistics
 */
function getSystemUserStats() {
  const users = loadUsers();
  const userList = Object.values(users);

  if (userList.length === 0) {
    return {
      totalUsers: 0,
      averageTrustScore: 0,
      totalVotes: 0,
      totalRumors: 0
    };
  }

  const totalTrust = userList.reduce((sum, u) => sum + u.trustScore, 0);
  const totalVotes = userList.reduce((sum, u) => sum + u.totalVotes, 0);
  const totalRumors = userList.reduce((sum, u) => sum + u.rumorsPosted, 0);

  return {
    totalUsers: userList.length,
    averageTrustScore: (totalTrust / userList.length).toFixed(2),
    totalVotes,
    totalRumors
  };
}

module.exports = {
  registerUser,
  getUserByToken,
  tokenExists,
  updateTrustScore,
  incrementRumorsPosted,
  incrementVoteCount,
  getAllUsers,
  batchUpdateTrustScores,
  getUserStats,
  getSystemUserStats,
  loadUsers,
  saveUsers
};
