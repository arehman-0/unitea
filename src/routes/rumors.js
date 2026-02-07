/**
 * Rumor Routes
 *
 * Handles rumor creation, listing, and voting.
 *
 * Endpoints:
 * - POST   /rumors           - Create new rumor
 * - GET    /rumors           - List all rumors
 * - GET    /rumors/:id       - Get rumor details
 * - POST   /rumors/:id/vote  - Vote on a rumor
 * - GET    /rumors/:id/votes - Get vote breakdown
 */

const express = require('express');
const router = express.Router();
const Rumor = require('../models/Rumor');
const Vote = require('../models/Vote');
const User = require('../models/User');
const blindSignature = require('../services/blindSignature');
const gatekeeper = require('../services/gatekeeper');
const semanticJudge = require('../services/semanticJudge');
const constants = require('../config/constants');

/**
 * Authentication middleware
 * Verifies token and signature in request headers
 */
function authenticate(req, res, next) {
  const tokenId = req.headers['x-token-id'];
  const signature = req.headers['x-signature'];

  if (!tokenId || !signature) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Provide X-Token-ID and X-Signature headers.'
    });
  }

  // Verify signature
  const isValid = blindSignature.verifyTokenSignature(tokenId, signature);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token or signature'
    });
  }

  // Check if user exists
  const user = User.getUserByToken(tokenId);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Token not registered'
    });
  }

  // Attach user to request
  req.user = user;
  req.tokenId = tokenId;

  next();
}

/**
 * POST /rumors
 * Create a new rumor
 *
 * Headers: X-Token-ID, X-Signature
 * Body: { content, category? }
 */
router.post('/', authenticate, (req, res) => {
  const { content, category } = req.body;

  if (!content || typeof content !== 'string' || content.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Content is required and must be at least 10 characters'
    });
  }

  if (content.length > 2000) {
    return res.status(400).json({
      success: false,
      error: 'Content must be less than 2000 characters'
    });
  }

  // Create rumor
  const rumor = Rumor.createRumor(
    content.trim(),
    req.tokenId,
    category || 'general'
  );

  // Update user stats
  User.incrementRumorsPosted(req.tokenId);

  res.status(201).json({
    success: true,
    rumor: {
      id: rumor.id,
      content: rumor.content,
      category: rumor.category,
      state: rumor.state,
      trustScore: rumor.trustScore,
      createdAt: rumor.createdAt
    }
  });
});

/**
 * GET /rumors
 * List all rumors with optional filtering
 *
 * Query params:
 * - state: Filter by state (NEUTRAL, PROBATION, EMERGENT_TRUTH, FINALIZED)
 * - category: Filter by category
 * - sortBy: Sort order (newest, oldest, trustScore)
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 */
router.get('/', (req, res) => {
  const {
    state,
    category,
    sortBy = 'newest',
    limit = 50,
    offset = 0
  } = req.query;

  const options = {
    limit: Math.min(parseInt(limit) || 50, 100),
    offset: parseInt(offset) || 0
  };

  if (state && Object.values(constants.RUMOR_STATES).includes(state)) {
    options.state = state;
  }

  if (category) {
    options.category = category;
  }

  if (sortBy === 'oldest') {
    options.sortBy = 'oldest';
  } else if (sortBy === 'trustScore') {
    options.sortBy = 'trustScore';
  }

  const rumors = Rumor.getAllRumors(options);

  res.json({
    success: true,
    count: rumors.length,
    rumors: rumors.map(r => ({
      id: r.id,
      content: r.content,
      category: r.category,
      state: r.state,
      trustScore: r.frozenTrustScore !== null ? r.frozenTrustScore : r.trustScore,
      confirmVotes: r.confirmVotes,
      denyVotes: r.denyVotes,
      emergentTruth: r.emergentTruth,
      createdAt: r.createdAt
    }))
  });
});

/**
 * GET /rumors/:id
 * Get rumor details with vote breakdown
 */
router.get('/:id', (req, res) => {
  const rumor = Rumor.getRumorById(req.params.id);

  if (!rumor) {
    return res.status(404).json({
      success: false,
      error: 'Rumor not found'
    });
  }

  const votes = Vote.getVotesForRumor(rumor.id);

  res.json({
    success: true,
    rumor: {
      id: rumor.id,
      content: rumor.content,
      category: rumor.category,
      state: rumor.state,
      trustScore: rumor.frozenTrustScore !== null ? rumor.frozenTrustScore : rumor.trustScore,
      frozenTrustScore: rumor.frozenTrustScore,
      confirmVotes: rumor.confirmVotes,
      denyVotes: rumor.denyVotes,
      weightedConfirmVotes: rumor.weightedConfirmVotes.toFixed(3),
      weightedDenyVotes: rumor.weightedDenyVotes.toFixed(3),
      emergentTruth: rumor.emergentTruth,
      createdAt: rumor.createdAt,
      stateChangedAt: rumor.stateChangedAt,
      finalizedAt: rumor.finalizedAt
    },
    voteStats: {
      total: votes.length,
      confirm: rumor.confirmVotes,
      deny: rumor.denyVotes,
      confirmPercent: votes.length > 0
        ? ((rumor.confirmVotes / votes.length) * 100).toFixed(1) + '%'
        : '0%'
    }
  });
});

/**
 * POST /rumors/:id/vote
 * Vote on a rumor with mandatory feedback
 *
 * Headers: X-Token-ID, X-Signature
 * Body: { voteType: 'CONFIRM' | 'DENY', feedback: string }
 */
router.post('/:id/vote', authenticate, (req, res) => {
  const { voteType, feedback } = req.body;

  // Validate vote type
  if (!voteType || !Object.values(constants.VOTE_TYPES).includes(voteType)) {
    return res.status(400).json({
      success: false,
      error: `voteType must be one of: ${Object.values(constants.VOTE_TYPES).join(', ')}`
    });
  }

  // Validate feedback
  if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 10) {
    return res.status(400).json({
      success: false,
      error: 'Feedback is required and must be at least 10 characters'
    });
  }

  if (feedback.length > 500) {
    return res.status(400).json({
      success: false,
      error: 'Feedback must be less than 500 characters'
    });
  }

  const rumor = Rumor.getRumorById(req.params.id);

  if (!rumor) {
    return res.status(404).json({
      success: false,
      error: 'Rumor not found'
    });
  }

  // Check if rumor is finalized
  if (rumor.state === constants.RUMOR_STATES.FINALIZED) {
    return res.status(400).json({
      success: false,
      error: 'Cannot vote on finalized rumors'
    });
  }

  // Check if user already voted
  const existingVote = Vote.getUserVoteOnRumor(req.params.id, req.tokenId);

  if (existingVote) {
    return res.status(400).json({
      success: false,
      error: 'You have already voted on this rumor'
    });
  }

  // Cast vote
  const voteResult = Vote.castVote(
    req.params.id,
    req.tokenId,
    voteType,
    feedback.trim(),
    req.user.trustScore
  );

  if (!voteResult.success) {
    return res.status(400).json(voteResult);
  }

  // Record vote on rumor with initial weight
  const initialWeight = voteResult.vote.baseWeight;
  Rumor.recordVote(req.params.id, voteType, initialWeight);

  // Update user stats
  User.incrementVoteCount(req.tokenId);

  // Process through gatekeeper for velocity check
  const gatekeeperResult = gatekeeper.processVote(req.params.id);

  // If enough votes, run semantic analysis
  const votes = Vote.getVotesForRumor(req.params.id);
  if (votes.length >= constants.MIN_CLUSTER_SIZE) {
    // Run semantic analysis asynchronously
    setImmediate(() => {
      semanticJudge.analyzeRumorFeedback(req.params.id);
    });
  }

  res.status(201).json({
    success: true,
    vote: {
      id: voteResult.vote.id,
      voteType: voteResult.vote.voteType,
      weight: voteResult.vote.baseWeight.toFixed(3)
    },
    rumorState: gatekeeperResult.action === 'PROBATION_TRIGGERED'
      ? 'PROBATION'
      : rumor.state,
    probationTriggered: gatekeeperResult.action === 'PROBATION_TRIGGERED'
  });
});

/**
 * GET /rumors/:id/votes
 * Get vote breakdown for a rumor
 */
router.get('/:id/votes', (req, res) => {
  const rumor = Rumor.getRumorById(req.params.id);

  if (!rumor) {
    return res.status(404).json({
      success: false,
      error: 'Rumor not found'
    });
  }

  const votes = Vote.getVotesForRumor(req.params.id);

  res.json({
    success: true,
    rumorId: req.params.id,
    total: votes.length,
    breakdown: {
      confirm: rumor.confirmVotes,
      deny: rumor.denyVotes,
      weightedConfirm: rumor.weightedConfirmVotes.toFixed(3),
      weightedDeny: rumor.weightedDenyVotes.toFixed(3)
    },
    votes: votes.map(v => ({
      id: v.id,
      voteType: v.voteType,
      feedback: v.feedback,
      baseWeight: v.baseWeight.toFixed(3),
      semanticWeight: v.semanticWeight.toFixed(3),
      collusionWeight: v.collusionWeight.toFixed(3),
      finalWeight: v.finalWeight.toFixed(3),
      createdAt: v.createdAt,
      audited: v.audited,
      alignedWithTruth: v.alignedWithTruth
    }))
  });
});

/**
 * GET /rumors/stats
 * Get rumor statistics
 */
router.get('/stats/summary', (req, res) => {
  const stats = Rumor.getRumorStats();
  const voteStats = Vote.getVoteStats();

  res.json({
    success: true,
    rumors: stats,
    votes: voteStats
  });
});

module.exports = router;
