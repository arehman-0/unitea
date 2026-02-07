/**
 * Authentication Routes
 *
 * Handles blind signature registration and token authentication.
 *
 * Endpoints:
 * - GET  /auth/public-key     - Get server's public key for blinding
 * - POST /auth/blind-sign     - Submit blinded token + email for signing
 * - POST /auth/register-token - Register unblinded token (creates user)
 * - POST /auth/verify         - Verify a token signature
 */

const express = require('express');
const router = express.Router();
const blindSignature = require('../services/blindSignature');
const User = require('../models/User');

/**
 * GET /auth/public-key
 * Returns server's public key components for client-side blinding
 */
router.get('/public-key', (req, res) => {
  try {
    const publicKey = blindSignature.getPublicKeyForBlinding();

    res.json({
      success: true,
      publicKey
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get public key: ' + error.message
    });
  }
});

/**
 * POST /auth/blind-sign
 * Process blind signing request
 *
 * Request body:
 * - blindedToken: hex-encoded blinded token
 * - email: university email for verification
 *
 * Response:
 * - blindedSignature: hex-encoded blind signature
 */
router.post('/blind-sign', (req, res) => {
  const { blindedToken, email } = req.body;

  // Validate inputs
  if (!blindedToken || typeof blindedToken !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'blindedToken is required and must be a hex string'
    });
  }

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'email is required'
    });
  }

  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(blindedToken)) {
    return res.status(400).json({
      success: false,
      error: 'blindedToken must be a valid hex string'
    });
  }

  // Process blind signing
  const result = blindSignature.processBlindSignRequest(blindedToken, email);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    blindedSignature: result.blindedSignature
  });
});

/**
 * POST /auth/register-token
 * Register an unblinded token (creates user account)
 *
 * Request body:
 * - tokenId: the unblinded token ID
 * - signature: the unblinded signature
 *
 * Response:
 * - user: { tokenId, trustScore, createdAt }
 */
router.post('/register-token', (req, res) => {
  const { tokenId, signature } = req.body;

  // Validate inputs
  if (!tokenId || typeof tokenId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'tokenId is required'
    });
  }

  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'signature is required'
    });
  }

  // Verify the signature
  const isValid = blindSignature.verifyTokenSignature(tokenId, signature);

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid signature'
    });
  }

  // Register the user
  const result = User.registerUser(tokenId, signature);

  if (!result.success) {
    return res.status(400).json(result);
  }

  res.json({
    success: true,
    user: result.user
  });
});

/**
 * POST /auth/verify
 * Verify a token and signature (for authentication)
 *
 * Request body:
 * - tokenId: the token ID
 * - signature: the signature
 *
 * Response:
 * - valid: boolean
 * - user: user data if valid and exists
 */
router.post('/verify', (req, res) => {
  const { tokenId, signature } = req.body;

  if (!tokenId || !signature) {
    return res.status(400).json({
      success: false,
      error: 'tokenId and signature are required'
    });
  }

  // Verify signature
  const isValid = blindSignature.verifyTokenSignature(tokenId, signature);

  if (!isValid) {
    return res.json({
      success: true,
      valid: false
    });
  }

  // Check if user exists
  const user = User.getUserByToken(tokenId);

  res.json({
    success: true,
    valid: true,
    registered: !!user,
    user: user ? {
      tokenId: user.tokenId,
      trustScore: user.trustScore,
      memberSince: user.createdAt
    } : null
  });
});

/**
 * GET /auth/stats
 * Get registration statistics (for admin)
 */
router.get('/stats', (req, res) => {
  const emailStats = blindSignature.getApprovedEmailStats();
  const userStats = User.getSystemUserStats();

  res.json({
    success: true,
    approvedEmails: emailStats.totalApproved,
    registeredUsers: userStats.totalUsers,
    averageTrustScore: userStats.averageTrustScore,
    note: 'Approved emails and registered users are mathematically unlinkable'
  });
});

module.exports = router;
