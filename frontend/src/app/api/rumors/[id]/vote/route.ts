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

async function verifyAuth(
  tokenId: string,
  signature: string,
  supabase: ReturnType<typeof createServiceRoleClient>
) {
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

// POST /api/rumors/[id]/vote - Vote on a rumor
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rumorId } = await params;
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

    const { voteType, feedback } = await request.json();

    // Validate vote type
    if (!voteType || !['CONFIRM', 'DENY'].includes(voteType)) {
      return NextResponse.json(
        { success: false, error: 'voteType must be CONFIRM or DENY' },
        { status: 400 }
      );
    }

    // Validate feedback
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Feedback must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (feedback.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Feedback must be less than 500 characters' },
        { status: 400 }
      );
    }

    // Check if rumor exists and is votable
    const { data: rumor } = await supabase
      .from('rumors')
      .select('*')
      .eq('id', rumorId)
      .single();

    if (!rumor) {
      return NextResponse.json(
        { success: false, error: 'Rumor not found' },
        { status: 404 }
      );
    }

    if (rumor.state === 'FINALIZED') {
      return NextResponse.json(
        { success: false, error: 'Cannot vote on finalized rumors' },
        { status: 400 }
      );
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id')
      .eq('rumor_id', rumorId)
      .eq('voter_token_id', tokenId)
      .single();

    if (existingVote) {
      return NextResponse.json(
        { success: false, error: 'You have already voted on this rumor' },
        { status: 400 }
      );
    }

    // Calculate base weight from user's trust score
    const baseWeight = Number(user.trust_score) / 5.0;

    // Insert vote
    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .insert({
        rumor_id: rumorId,
        voter_token_id: tokenId,
        vote_type: voteType,
        feedback: feedback.trim(),
        base_weight: baseWeight,
        final_weight: baseWeight,
      })
      .select()
      .single();

    if (voteError) {
      console.error('Vote insert error:', voteError);
      return NextResponse.json(
        { success: false, error: 'Failed to record vote' },
        { status: 500 }
      );
    }

    // Record timestamp for velocity tracking
    await supabase.from('vote_timestamps').insert({ rumor_id: rumorId });

    // Update rumor vote counts
    const updateData: Record<string, number> = {};
    if (voteType === 'CONFIRM') {
      updateData.confirm_votes = rumor.confirm_votes + 1;
      updateData.weighted_confirm_votes = Number(rumor.weighted_confirm_votes) + baseWeight;
    } else {
      updateData.deny_votes = rumor.deny_votes + 1;
      updateData.weighted_deny_votes = Number(rumor.weighted_deny_votes) + baseWeight;
    }

    // Update trust score if not in probation
    if (rumor.state !== 'PROBATION') {
      const newTotal =
        Number(rumor.weighted_confirm_votes) +
        Number(rumor.weighted_deny_votes) +
        baseWeight;
      const newConfirm =
        voteType === 'CONFIRM'
          ? Number(rumor.weighted_confirm_votes) + baseWeight
          : Number(rumor.weighted_confirm_votes);
      updateData.trust_score = newTotal > 0 ? (newConfirm / newTotal) * 5 : 2.5;
    }

    await supabase.from('rumors').update(updateData).eq('id', rumorId);

    // Update user stats
    await supabase
      .from('users')
      .update({
        total_votes: user.total_votes + 1,
        last_active_at: new Date().toISOString(),
      })
      .eq('token_id', tokenId);

    // Check velocity for potential swarm detection
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentVotes } = await supabase
      .from('vote_timestamps')
      .select('*', { count: 'exact', head: true })
      .eq('rumor_id', rumorId)
      .gte('created_at', oneHourAgo);

    const velocity = (recentVotes || 0) / 60; // votes per minute

    // If velocity is high and rumor is NEUTRAL, trigger PROBATION
    let probationTriggered = false;
    if (velocity > 0.5 && rumor.state === 'NEUTRAL') {
      await supabase
        .from('rumors')
        .update({
          state: 'PROBATION',
          frozen_trust_score: rumor.trust_score,
          state_changed_at: new Date().toISOString(),
        })
        .eq('id', rumorId);
      probationTriggered = true;
    }

    return NextResponse.json({
      success: true,
      vote: {
        id: vote.id,
        voteType: vote.vote_type,
        weight: baseWeight.toFixed(3),
      },
      rumorState: probationTriggered ? 'PROBATION' : rumor.state,
      probationTriggered,
    }, { status: 201 });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/rumors/[id]/vote - Get votes for a rumor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rumorId } = await params;
    const supabase = createServiceRoleClient();

    const { data: rumor } = await supabase
      .from('rumors')
      .select('confirm_votes, deny_votes, weighted_confirm_votes, weighted_deny_votes')
      .eq('id', rumorId)
      .single();

    if (!rumor) {
      return NextResponse.json(
        { success: false, error: 'Rumor not found' },
        { status: 404 }
      );
    }

    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('rumor_id', rumorId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      success: true,
      rumorId,
      total: votes?.length || 0,
      breakdown: {
        confirm: rumor.confirm_votes,
        deny: rumor.deny_votes,
        weightedConfirm: Number(rumor.weighted_confirm_votes).toFixed(3),
        weightedDeny: Number(rumor.weighted_deny_votes).toFixed(3),
      },
      votes: votes?.map((v) => ({
        id: v.id,
        voteType: v.vote_type,
        feedback: v.feedback,
        baseWeight: Number(v.base_weight).toFixed(3),
        semanticWeight: Number(v.semantic_weight).toFixed(3),
        collusionWeight: Number(v.collusion_weight).toFixed(3),
        finalWeight: Number(v.final_weight).toFixed(3),
        createdAt: v.created_at,
        audited: v.audited,
        alignedWithTruth: v.aligned_with_truth,
      })),
    });
  } catch (error) {
    console.error('Get votes error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
