import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import NodeRSA from 'node-rsa';
import crypto from 'crypto';

const VALID_EMAIL_DOMAINS = ['university.edu', 'uni.edu', 'student.edu', 'edu.pk'];

function isValidUniversityEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailLower = email.toLowerCase().trim();
  return VALID_EMAIL_DOMAINS.some(
    (domain) => emailLower.endsWith('@' + domain) || emailLower.endsWith('.' + domain)
  );
}

function hashEmail(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex');
}

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

export async function POST(request: NextRequest) {
  try {
    const { blindedToken, email } = await request.json();

    // Validate inputs
    if (!blindedToken || typeof blindedToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'blindedToken is required' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'email is required' },
        { status: 400 }
      );
    }

    // Validate email domain
    if (!isValidUniversityEmail(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email domain. Must be a valid university email.' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if email already used
    const emailHash = hashEmail(email);
    const { data: existingEmail } = await supabase
      .from('approved_emails')
      .select('id')
      .eq('email_hash', emailHash)
      .single();

    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'This email has already been used to register.' },
        { status: 400 }
      );
    }

    // Get server private key
    const { data: keyData } = await supabase
      .from('server_keys')
      .select('private_key')
      .eq('is_active', true)
      .single();

    if (!keyData) {
      return NextResponse.json(
        { success: false, error: 'Server keys not initialized' },
        { status: 500 }
      );
    }

    // Load the key and sign
    const key = new NodeRSA();
    key.importKey(keyData.private_key, 'pkcs1-private-pem');

    // Access key components via internal property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyPair = (key as any).keyPair;
    const blindedBigInt = BigInt('0x' + blindedToken);
    const n = BigInt('0x' + keyPair.n.toString(16));
    const d = BigInt('0x' + keyPair.d.toString(16));

    // Blind signature: s' = (m')^d mod n
    const blindedSignature = modPow(blindedBigInt, d, n);

    // Record email as used (List A - unlinkable to tokens)
    await supabase.from('approved_emails').insert({ email_hash: emailHash });

    return NextResponse.json({
      success: true,
      blindedSignature: blindedSignature.toString(16),
    });
  } catch (error) {
    console.error('Blind sign error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sign token' },
      { status: 500 }
    );
  }
}
