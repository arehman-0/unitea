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

async function verifyAuth(tokenId: string, signature: string, supabase: ReturnType<typeof createServiceRoleClient>) {
  const { data: keyData } = await supabase
    .from('server_keys')
    .select('n, e')
    .eq('is_active', true)
    .single();

  if (!keyData) return null;

  try {
    const tokenHash = hashToken(tokenId);
    const tokenBigInt = BigInt('0x' + tokenHash);
    const sigBigInt = BigInt('0x' + signature);
    const n = BigInt('0x' + keyData.n);
    const e = BigInt('0x' + keyData.e);

    const verified = modPow(sigBigInt, e, n);
    if (verified !== tokenBigInt) return null;

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('token_id', tokenId)
      .single();

    return user;
  } catch {
    return null;
  }
}

// GET /api/rumors - List all rumors
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    const state = searchParams.get('state');
    const category = searchParams.get('category');
    const sortBy = searchParams.get('sortBy') || 'newest';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('rumors')
      .select('*')
      .eq('archived', false);

    if (state) {
      query = query.eq('state', state);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (sortBy === 'oldest') {
      query = query.order('created_at', { ascending: true });
    } else if (sortBy === 'trustScore') {
      query = query.order('trust_score', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: rumors, error } = await query;

    if (error) {
      console.error('List rumors error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch rumors' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: rumors?.length || 0,
      rumors: rumors?.map((r) => ({
        id: r.id,
        content: r.content,
        category: r.category,
        state: r.state,
        trustScore: r.frozen_trust_score ?? r.trust_score,
        confirmVotes: r.confirm_votes,
        denyVotes: r.deny_votes,
        emergentTruth: r.emergent_truth,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('List rumors error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/rumors - Create a new rumor
export async function POST(request: NextRequest) {
  try {
    const tokenId = request.headers.get('x-token-id');
    const signature = request.headers.get('x-signature');

    if (!tokenId || !signature) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();
    const user = await verifyAuth(tokenId, signature, supabase);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      );
    }

    const { content, category } = await request.json();

    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Content must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (content.length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Content must be less than 2000 characters' },
        { status: 400 }
      );
    }

    // Create rumor
    const { data: rumor, error } = await supabase
      .from('rumors')
      .insert({
        content: content.trim(),
        author_token_id: tokenId,
        category: category || 'general',
      })
      .select()
      .single();

    if (error) {
      console.error('Create rumor error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create rumor' },
        { status: 500 }
      );
    }

    // Update user stats
    await supabase
      .from('users')
      .update({
        rumors_posted: user.rumors_posted + 1,
        last_active_at: new Date().toISOString(),
      })
      .eq('token_id', tokenId);

    return NextResponse.json({
      success: true,
      rumor: {
        id: rumor.id,
        content: rumor.content,
        category: rumor.category,
        state: rumor.state,
        trustScore: rumor.trust_score,
        createdAt: rumor.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create rumor error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
