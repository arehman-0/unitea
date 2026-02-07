/**
 * Blind Signature Service
 *
 * Implements anonymous authentication using blind signatures.
 *
 * Protocol:
 * 1. Client generates a token ID and blinds it with random factor r
 * 2. Server signs the blinded token (cannot see actual token)
 * 3. Client unblinds the signature
 * 4. Client can now authenticate with token + signature
 *
 * Key Privacy Property:
 * - List A (approved emails) and List B (active tokens) are UNLINKABLE
 * - Even with full database access, no one can link a token to an email
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cryptoUtils = require('../utils/crypto');
const constants = require('../config/constants');

/**
 * Load approved emails list (List A)
 */
function loadApprovedEmails() {
  const filePath = path.resolve(constants.APPROVED_EMAILS_FILE);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading approved emails:', error.message);
  }
  return { emails: [] };
}

/**
 * Save approved emails list
 */
function saveApprovedEmails(data) {
  const filePath = path.resolve(constants.APPROVED_EMAILS_FILE);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Hash an email for privacy-preserving storage
 */
function hashEmail(email) {
  return crypto.createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex');
}

/**
 * Validate university email domain
 */
function isValidUniversityEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const emailLower = email.toLowerCase().trim();
  return constants.VALID_EMAIL_DOMAINS.some(domain =>
    emailLower.endsWith('@' + domain) || emailLower.endsWith('.' + domain)
  );
}

/**
 * Check if email has already been used for registration
 */
function isEmailAlreadyUsed(email) {
  const data = loadApprovedEmails();
  const emailHash = hashEmail(email);
  return data.emails.includes(emailHash);
}

/**
 * Record email as used (add to List A)
 * Note: This is COMPLETELY SEPARATE from the user/token list
 */
function recordEmailUsed(email) {
  const data = loadApprovedEmails();
  const emailHash = hashEmail(email);

  if (!data.emails.includes(emailHash)) {
    data.emails.push(emailHash);
    saveApprovedEmails(data);
  }
}

/**
 * Process a blind signing request
 *
 * @param {string} blindedToken - The blinded token (hex)
 * @param {string} email - University email for verification
 * @returns {Object} - Result with blindedSignature or error
 */
function processBlindSignRequest(blindedToken, email) {
  // Validate email domain
  if (!isValidUniversityEmail(email)) {
    return {
      success: false,
      error: 'Invalid email domain. Must be a valid university email.'
    };
  }

  // Check if email already used
  if (isEmailAlreadyUsed(email)) {
    return {
      success: false,
      error: 'This email has already been used to register a token.'
    };
  }

  try {
    // Sign the BLINDED token (server cannot see actual token)
    const blindedSignature = cryptoUtils.signBlindedToken(blindedToken);

    // Record email as used (List A - unlinkable to tokens)
    recordEmailUsed(email);

    return {
      success: true,
      blindedSignature
    };
  } catch (error) {
    return {
      success: false,
      error: 'Failed to sign token: ' + error.message
    };
  }
}

/**
 * Verify a token signature for authentication
 *
 * @param {string} tokenId - The unblinded token ID
 * @param {string} signature - The unblinded signature
 * @returns {boolean} - Whether the signature is valid
 */
function verifyTokenSignature(tokenId, signature) {
  return cryptoUtils.verifySignature(tokenId, signature);
}

/**
 * Get server's public key components for client-side blinding
 */
function getPublicKeyForBlinding() {
  return cryptoUtils.getServerPublicKey();
}

/**
 * Get statistics about approved emails (for admin)
 */
function getApprovedEmailStats() {
  const data = loadApprovedEmails();
  return {
    totalApproved: data.emails.length
  };
}

module.exports = {
  processBlindSignRequest,
  verifyTokenSignature,
  getPublicKeyForBlinding,
  isValidUniversityEmail,
  isEmailAlreadyUsed,
  getApprovedEmailStats
};
