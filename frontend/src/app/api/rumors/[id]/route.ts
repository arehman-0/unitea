import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// GET /api/rumors/[id] - Get rumor details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceRoleClient();

    const { data: rumor, error } = await supabase
      .from('rumors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !rumor) {
      return NextResponse.json(
        { success: false, error: 'Rumor not found' },
        { status: 404 }
      );
    }

    // Get vote count
    const { count: voteCount } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('rumor_id', id);

    return NextResponse.json({
      success: true,
      rumor: {
        id: rumor.id,
        content: rumor.content,
        category: rumor.category,
        state: rumor.state,
        trustScore: rumor.frozen_trust_score ?? rumor.trust_score,
        frozenTrustScore: rumor.frozen_trust_score,
        confirmVotes: rumor.confirm_votes,
        denyVotes: rumor.deny_votes,
        weightedConfirmVotes: Number(rumor.weighted_confirm_votes).toFixed(3),
        weightedDenyVotes: Number(rumor.weighted_deny_votes).toFixed(3),
        emergentTruth: rumor.emergent_truth,
        createdAt: rumor.created_at,
        stateChangedAt: rumor.state_changed_at,
        finalizedAt: rumor.finalized_at,
      },
      voteStats: {
        total: voteCount || 0,
        confirm: rumor.confirm_votes,
        deny: rumor.deny_votes,
        confirmPercent:
          (voteCount || 0) > 0
            ? ((rumor.confirm_votes / (voteCount || 1)) * 100).toFixed(1) + '%'
            : '0%',
      },
    });
  } catch (error) {
    console.error('Get rumor error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
