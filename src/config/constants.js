/**
 * System constants for UniTea trust system
 */

module.exports = {
  // Trust Score Configuration
  INITIAL_TRUST_SCORE: 2.5,      // Mean of 0-5 scale
  MIN_TRUST_SCORE: 0,
  MAX_TRUST_SCORE: 5,
  TRUST_REWARD: 0.1,             // Correct vote bonus
  TRUST_PENALTY: 0.15,           // Wrong vote penalty
  FORGETTING_FACTOR: 0.95,       // λ for decay

  // Threshold Configuration
  SENSITIVITY_FACTOR: 0.0,       // Range: -0.4 to +0.2
  SIMILARITY_THRESHOLD: 0.7,     // LSI cosine threshold
  VELOCITY_MULTIPLIER: 2.0,      // Swarm detection multiplier

  // Timing Configuration
  CONSENSUS_WINDOW_HOURS: 24,    // Audit cycle duration
  ARCHIVE_MONTHS: 4,             // Auto-deletion period
  VELOCITY_WINDOW_MINUTES: 60,   // Window for velocity calculation

  // LSI Configuration
  LSI_DIMENSIONS: 10,            // Reduced dimensions for LSI
  MIN_CLUSTER_SIZE: 3,           // Minimum votes for clustering

  // Anti-Collusion
  CORRELATION_THRESHOLD: 0.8,    // High correlation threshold
  MIN_SHARED_VOTES: 5,           // Minimum shared votes for correlation

  // Rumor States
  RUMOR_STATES: {
    NEUTRAL: 'NEUTRAL',
    PROBATION: 'PROBATION',
    EMERGENT_TRUTH: 'EMERGENT_TRUTH',
    FINALIZED: 'FINALIZED'
  },

  // Vote Types
  VOTE_TYPES: {
    CONFIRM: 'CONFIRM',
    DENY: 'DENY'
  },

  // Valid email domains for university verification
  VALID_EMAIL_DOMAINS: [
    'university.edu',
    'uni.edu',
    'student.edu',
    'edu.pk'
  ],

  // Server Configuration
  PORT: process.env.PORT || 5000,

  // Data paths
  DATA_DIR: 'data',
  APPROVED_EMAILS_FILE: 'data/approved-emails.json',
  USERS_FILE: 'data/users.json',
  RUMORS_FILE: 'data/rumors.json',
  VOTES_FILE: 'data/votes.json',
  SERVER_KEYS_FILE: 'data/server-keys.json'
};
