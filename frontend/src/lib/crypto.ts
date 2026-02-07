/**
 * Client-side cryptographic utilities for blind signatures
 */

// Generate a random hex string
export function randomHex(bytes: number = 32): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Hash a string using SHA-256
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// BigInt utilities for RSA operations
function hexToBigInt(hex: string): bigint {
  return BigInt('0x' + hex);
}

function bigIntToHex(n: bigint): string {
  return n.toString(16);
}

// Modular exponentiation
function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
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

// Extended Euclidean Algorithm for modular inverse
function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];

  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }

  if (old_r > 1n) {
    throw new Error('Modular inverse does not exist');
  }

  return old_s < 0n ? old_s + m : old_s;
}

/**
 * Blind Signature Client
 * Handles the client-side of the blind signature protocol
 */
export class BlindSignatureClient {
  private n: bigint;
  private e: bigint;
  private r: bigint | null = null;

  constructor(publicKeyN: string, publicKeyE: string) {
    this.n = hexToBigInt(publicKeyN);
    this.e = hexToBigInt(publicKeyE);
  }

  /**
   * Generate a token ID (random hex string)
   */
  generateTokenId(): string {
    return randomHex(32);
  }

  /**
   * Blind the token for signing
   * m' = m * r^e mod n
   */
  async blindToken(tokenId: string): Promise<string> {
    // Hash the token ID
    const tokenHash = await sha256(tokenId);
    const m = hexToBigInt(tokenHash);

    // Generate random blinding factor
    this.r = hexToBigInt(randomHex(32));

    // Ensure r is coprime with n
    while (this.r >= this.n) {
      this.r = hexToBigInt(randomHex(32));
    }

    // Blind: m' = m * r^e mod n
    const rToE = modPow(this.r, this.e, this.n);
    const blindedToken = (m * rToE) % this.n;

    return bigIntToHex(blindedToken);
  }

  /**
   * Unblind the signature
   * s = s' * r^(-1) mod n
   */
  unblindSignature(blindedSignature: string): string {
    if (!this.r) {
      throw new Error('Must blind token first');
    }

    const sPrime = hexToBigInt(blindedSignature);

    // Calculate r^(-1) mod n
    const rInverse = modInverse(this.r, this.n);

    // Unblind: s = s' * r^(-1) mod n
    const signature = (sPrime * rInverse) % this.n;

    return bigIntToHex(signature);
  }
}

/**
 * Generate a complete token with blinding
 */
export async function generateBlindedToken(publicKeyN: string, publicKeyE: string): Promise<{
  tokenId: string;
  blindedToken: string;
  client: BlindSignatureClient;
}> {
  const client = new BlindSignatureClient(publicKeyN, publicKeyE);
  const tokenId = client.generateTokenId();
  const blindedToken = await client.blindToken(tokenId);

  return { tokenId, blindedToken, client };
}
