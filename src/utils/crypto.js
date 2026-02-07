/**
 * Cryptographic utilities for blind signatures and token management
 */

const NodeRSA = require('node-rsa');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SERVER_KEYS_FILE } = require('../config/constants');

class CryptoUtils {
  constructor() {
    this.serverKey = null;
    this.loadOrGenerateServerKeys();
  }

  /**
   * Load existing server keys or generate new ones
   */
  loadOrGenerateServerKeys() {
    const keysPath = path.resolve(SERVER_KEYS_FILE);

    try {
      if (fs.existsSync(keysPath)) {
        const keyData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
        this.serverKey = new NodeRSA();
        this.serverKey.importKey(keyData.privateKey, 'pkcs1-private-pem');
        console.log('Loaded existing server keys');
      } else {
        this.generateServerKeys();
      }
    } catch (error) {
      console.error('Error loading keys, generating new ones:', error.message);
      this.generateServerKeys();
    }
  }

  /**
   * Generate new server RSA keypair
   */
  generateServerKeys() {
    this.serverKey = new NodeRSA({ b: 2048 });
    this.serverKey.setOptions({ signingScheme: 'pkcs1-sha256' });

    const keyData = {
      privateKey: this.serverKey.exportKey('pkcs1-private-pem'),
      publicKey: this.serverKey.exportKey('pkcs1-public-pem'),
      createdAt: new Date().toISOString()
    };

    const keysPath = path.resolve(SERVER_KEYS_FILE);
    const dir = path.dirname(keysPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(keysPath, JSON.stringify(keyData, null, 2));
    console.log('Generated new server keys');
  }

  /**
   * Get server's public key for client-side blinding
   */
  getServerPublicKey() {
    return {
      n: this.serverKey.keyPair.n.toString(16),
      e: this.serverKey.keyPair.e.toString(16)
    };
  }

  /**
   * Sign a blinded token (server cannot see the actual token)
   * @param {string} blindedToken - Hex-encoded blinded token
   * @returns {string} - Hex-encoded blind signature
   */
  signBlindedToken(blindedToken) {
    try {
      // Convert hex to BigInt
      const blindedBigInt = BigInt('0x' + blindedToken);
      const n = this.serverKey.keyPair.n;
      const d = this.serverKey.keyPair.d;

      // Perform raw RSA signing: signature = blindedToken^d mod n
      const signatureBigInt = this.modPow(blindedBigInt, d, n);

      return signatureBigInt.toString(16);
    } catch (error) {
      throw new Error('Failed to sign blinded token: ' + error.message);
    }
  }

  /**
   * Verify an unblinded signature against a token
   * @param {string} tokenId - The token ID (hex-encoded public key)
   * @param {string} signature - The unblinded signature (hex)
   * @returns {boolean} - Whether the signature is valid
   */
  verifySignature(tokenId, signature) {
    try {
      const tokenHash = this.hashToken(tokenId);
      const tokenBigInt = BigInt('0x' + tokenHash);
      const sigBigInt = BigInt('0x' + signature);
      const n = this.serverKey.keyPair.n;
      const e = this.serverKey.keyPair.e;

      // Verify: tokenHash === signature^e mod n
      const verified = this.modPow(sigBigInt, e, n);

      return verified === tokenBigInt;
    } catch (error) {
      console.error('Signature verification error:', error.message);
      return false;
    }
  }

  /**
   * Hash a token for signing
   * @param {string} token - Token to hash
   * @returns {string} - Hex-encoded hash
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Modular exponentiation for big integers
   */
  modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

    let result = 1n;
    base = base % modulus;

    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      exponent = exponent / 2n;
      base = (base * base) % modulus;
    }

    return result;
  }

  /**
   * Generate a random hex string
   * @param {number} bytes - Number of random bytes
   * @returns {string} - Hex-encoded random string
   */
  randomHex(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generate a deterministic ID from content
   * @param {string} content - Content to hash
   * @returns {string} - Short ID
   */
  generateId(content) {
    return crypto.createHash('sha256')
      .update(content + Date.now() + Math.random())
      .digest('hex')
      .substring(0, 16);
  }
}

module.exports = new CryptoUtils();
