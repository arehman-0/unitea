/**
 * Admin Routes
 *
 * System status, manual controls, and statistics.
 *
 * Endpoints:
 * - GET  /status                 - System health & stats
 * - GET  /admin/users            - User statistics
 * - GET  /admin/audit            - Audit status
 * - POST /admin/audit/trigger    - Manually trigger audit
 * - GET  /admin/archiver         - Archiver status
 * - POST /admin/archiver/trigger - Manually trigger archival
 * - GET  /admin/gatekeeper       - Gatekeeper statistics
 * - GET  /admin/collusion        - Anti-collusion statistics
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Rumor = require('../models/Rumor');
const Vote = require('../models/Vote');
const gatekeeper = require('../services/gatekeeper');
const semanticJudge = require('../services/semanticJudge');
const retroactiveAudit = require('../services/retroactiveAudit');
const antiCollusion = require('../services/antiCollusion');
const auditLoop = require('../jobs/auditLoop');
const archiver = require('../jobs/archiver');
const blindSignature = require('../services/blindSignature');
const constants = require('../config/constants');

/**
 * GET /status
 * System health and overall statistics
 */
router.get('/status', (req, res) => {
  const userStats = User.getSystemUserStats();
  const rumorStats = Rumor.getRumorStats();
  const voteStats = Vote.getVoteStats();
  const emailStats = blindSignature.getApprovedEmailStats();
  const auditStatus = auditLoop.getStatus();
  const archiverStatus = archiver.getStatus();

  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      version: '1.0.0'
    },
    users: userStats,
    rumors: rumorStats,
    votes: voteStats,
    registrations: {
      approvedEmails: emailStats.totalApproved,
      registeredTokens: userStats.totalUsers,
      note: 'These two lists are mathematically unlinkable'
    },
    scheduledJobs: {
      audit: {
        lastRun: auditStatus.lastRunTime,
        nextRun: auditStatus.nextScheduledRun,
        isRunning: auditStatus.isRunning
      },
      archiver: {
        lastRun: archiverStatus.lastRunTime,
        pendingArchival: archiverStatus.pendingArchival
      }
    }
  });
});

/**
 * GET /admin/users
 * User statistics and trust distribution
 */
router.get('/users', (req, res) => {
  const users = User.getAllUsers();
  const userList = Object.values(users);

  // Calculate trust score distribution
  const distribution = {
    low: userList.filter(u => u.trustScore < 2).length,
    medium: userList.filter(u => u.trustScore >= 2 && u.trustScore < 4).length,
    high: userList.filter(u => u.trustScore >= 4).length
  };

  // Top voters
  const topVoters = userList
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, 10)
    .map(u => ({
      tokenId: u.tokenId.substring(0, 8) + '...',
      trustScore: u.trustScore.toFixed(2),
      totalVotes: u.totalVotes,
      accuracy: u.totalVotes > 0
        ? ((u.correctVotes / u.totalVotes) * 100).toFixed(1) + '%'
        : 'N/A'
    }));

  res.json({
    success: true,
    totalUsers: userList.length,
    averageTrustScore: userList.length > 0
      ? (userList.reduce((sum, u) => sum + u.trustScore, 0) / userList.length).toFixed(2)
      : 0,
    trustDistribution: distribution,
    topVoters
  });
});

/**
 * GET /admin/audit
 * Audit system status and statistics
 */
router.get('/audit', (req, res) => {
  const status = auditLoop.getStatus();
  const stats = retroactiveAudit.getStats();

  res.json({
    success: true,
    status,
    stats
  });
});

/**
 * POST /admin/audit/trigger
 * Manually trigger the audit cycle
 */
router.post('/audit/trigger', async (req, res) => {
  try {
    const result = await auditLoop.triggerManualAudit();

    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /admin/audit/preview/:rumorId
 * Preview what audit would do for a specific rumor
 */
router.get('/audit/preview/:rumorId', (req, res) => {
  const preview = retroactiveAudit.previewAudit(req.params.rumorId);

  if (!preview.success) {
    return res.status(404).json(preview);
  }

  res.json(preview);
});

/**
 * GET /admin/archiver
 * Archiver status and pending archival list
 */
router.get('/archiver', (req, res) => {
  const status = archiver.getStatus();
  const pending = archiver.getPendingArchivalList();

  res.json({
    success: true,
    status,
    pendingRumors: pending.slice(0, 20)  // Limit to 20
  });
});

/**
 * POST /admin/archiver/trigger
 * Manually trigger archival process
 */
router.post('/archiver/trigger', (req, res) => {
  const result = archiver.triggerManualArchival();

  res.json({
    success: true,
    result
  });
});

/**
 * GET /admin/gatekeeper
 * Gatekeeper (velocity monitoring) statistics
 */
router.get('/gatekeeper', (req, res) => {
  const stats = gatekeeper.getStats();
  const scan = gatekeeper.scanAllRumors();

  res.json({
    success: true,
    stats,
    activeRumors: scan.slice(0, 20).map(r => ({
      rumorId: r.rumorId,
      state: r.state,
      velocity: r.velocity.toFixed(4),
      threshold: r.threshold.toFixed(4),
      isAnomaly: r.isAnomaly,
      totalVotes: r.totalVotes
    }))
  });
});

/**
 * GET /admin/semantic
 * Semantic judge statistics
 */
router.get('/semantic', (req, res) => {
  const stats = semanticJudge.getStats();

  res.json({
    success: true,
    stats
  });
});

/**
 * POST /admin/semantic/analyze/:rumorId
 * Manually trigger semantic analysis for a rumor
 */
router.post('/semantic/analyze/:rumorId', (req, res) => {
  const result = semanticJudge.analyzeRumorFeedback(req.params.rumorId);

  res.json(result);
});

/**
 * GET /admin/collusion
 * Anti-collusion statistics
 */
router.get('/collusion', (req, res) => {
  const stats = antiCollusion.getStats();
  const rings = antiCollusion.detectCollusionRings();

  res.json({
    success: true,
    stats,
    collusionRings: rings.slice(0, 10).map(ring => ({
      size: ring.size,
      averageCorrelation: ring.averageCorrelation.toFixed(3),
      members: ring.members.map(m => m.substring(0, 8) + '...')
    }))
  });
});

/**
 * GET /admin/collusion/user/:tokenId
 * Analyze collusion for a specific user
 */
router.get('/collusion/user/:tokenId', (req, res) => {
  const analysis = antiCollusion.analyzeUserCollusion(req.params.tokenId);

  res.json({
    success: true,
    analysis: {
      ...analysis,
      tokenId: analysis.tokenId.substring(0, 8) + '...',
      highlyCorrelatedUsers: analysis.highlyCorrelatedUsers.map(u => ({
        ...u,
        userId: u.userId.substring(0, 8) + '...'
      }))
    }
  });
});

/**
 * GET /admin/constants
 * Get system constants
 */
router.get('/constants', (req, res) => {
  res.json({
    success: true,
    constants: {
      trustScore: {
        initial: constants.INITIAL_TRUST_SCORE,
        min: constants.MIN_TRUST_SCORE,
        max: constants.MAX_TRUST_SCORE,
        reward: constants.TRUST_REWARD,
        penalty: constants.TRUST_PENALTY,
        forgettingFactor: constants.FORGETTING_FACTOR
      },
      thresholds: {
        sensitivityFactor: constants.SENSITIVITY_FACTOR,
        similarityThreshold: constants.SIMILARITY_THRESHOLD,
        velocityMultiplier: constants.VELOCITY_MULTIPLIER,
        correlationThreshold: constants.CORRELATION_THRESHOLD
      },
      timing: {
        consensusWindowHours: constants.CONSENSUS_WINDOW_HOURS,
        archiveMonths: constants.ARCHIVE_MONTHS,
        velocityWindowMinutes: constants.VELOCITY_WINDOW_MINUTES
      },
      rumorStates: constants.RUMOR_STATES,
      voteTypes: constants.VOTE_TYPES,
      validEmailDomains: constants.VALID_EMAIL_DOMAINS
    }
  });
});

module.exports = router;
