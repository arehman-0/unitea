import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import crypto from 'crypto';

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

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const { tokenId, signature } = await request.json();

    // Validate inputs
    if (!tokenId || typeof tokenId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'tokenId is required' },
        { status: 400 }
      );
    }

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json(
        { success: false, error: 'signature is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get server public key
    const { data: keyData } = await supabase
      .from('server_keys')
      .select('n, e')
      .eq('is_active', true)
      .single();

    if (!keyData) {
      return NextResponse.json(
        { success: false, error: 'Server keys not initialized' },
        { status: 500 }
      );
    }

    // Verify signature
    const tokenHash = hashToken(tokenId);
    const tokenBigInt = BigInt('0x' + tokenHash);
    const sigBigInt = BigInt('0x' + signature);
    const n = BigInt('0x' + keyData.n);
    const e = BigInt('0x' + keyData.e);

    const verified = modPow(sigBigInt, e, n);

    if (verified !== tokenBigInt) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Check if token already registered
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('token_id', tokenId)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Token already registered' },
        { status: 400 }
      );
    }

    // Register user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        token_id: tokenId,
        signature: signature,
        trust_score: 2.5,
      })
      .select()
      .single();

    if (error || !newUser) {
      console.error('Registration error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to register user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        tokenId: newUser.token_id,
        trustScore: newUser.trust_score,
        createdAt: newUser.created_at,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
