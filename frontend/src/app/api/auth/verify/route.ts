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

    if (!tokenId || !signature) {
      return NextResponse.json(
        { success: false, error: 'tokenId and signature are required' },
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
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'Server keys not initialized',
      });
    }

    // Verify signature
    try {
      const tokenHash = hashToken(tokenId);
      const tokenBigInt = BigInt('0x' + tokenHash);
      const sigBigInt = BigInt('0x' + signature);
      const n = BigInt('0x' + keyData.n);
      const e = BigInt('0x' + keyData.e);

      const verified = modPow(sigBigInt, e, n);

      if (verified !== tokenBigInt) {
        return NextResponse.json({
          success: true,
          valid: false,
        });
      }
    } catch {
      return NextResponse.json({
        success: true,
        valid: false,
      });
    }

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('token_id, trust_score, created_at, total_votes, correct_votes, rumors_posted')
      .eq('token_id', tokenId)
      .single();

    return NextResponse.json({
      success: true,
      valid: true,
      registered: !!user,
      user: user
        ? {
            tokenId: user.token_id,
            trustScore: user.trust_score,
            totalVotes: user.total_votes,
            correctVotes: user.correct_votes,
            rumorsPosted: user.rumors_posted,
            memberSince: user.created_at,
          }
        : null,
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
