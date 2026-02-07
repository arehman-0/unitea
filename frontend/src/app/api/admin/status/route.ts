import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Get user stats
    const { data: users } = await supabase.from('users').select('trust_score');
    const userList = users || [];
    const totalUsers = userList.length;
    const avgTrustScore =
      totalUsers > 0
        ? userList.reduce((sum: number, u: { trust_score: number }) => sum + Number(u.trust_score), 0) / totalUsers
        : 0;

    // Get rumor stats
    const { data: rumors } = await supabase
      .from('rumors')
      .select('state, trust_score')
      .eq('archived', false);

    const rumorList = rumors || [];

    const rumorStats = {
      total: rumorList.length,
      byState: {
        NEUTRAL: rumorList.filter((r: { state: string }) => r.state === 'NEUTRAL').length,
        PROBATION: rumorList.filter((r: { state: string }) => r.state === 'PROBATION').length,
        EMERGENT_TRUTH: rumorList.filter((r: { state: string }) => r.state === 'EMERGENT_TRUTH').length,
        FINALIZED: rumorList.filter((r: { state: string }) => r.state === 'FINALIZED').length,
      },
      avgTrustScore:
        rumorList.length > 0
          ? rumorList.reduce((sum: number, r: { trust_score: number }) => sum + Number(r.trust_score), 0) / rumorList.length
          : 0,
    };

    // Get vote stats
    const { count: totalVotes } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true });

    const { count: confirmVotes } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('vote_type', 'CONFIRM');

    const { count: auditedVotes } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('audited', true);

    // Get approved emails count
    const { count: approvedEmails } = await supabase
      .from('approved_emails')
      .select('*', { count: 'exact', head: true });

    // Get last audit
    const { data: lastAudit } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      users: {
        totalUsers,
        averageTrustScore: avgTrustScore.toFixed(2),
      },
      rumors: rumorStats,
      votes: {
        total: totalVotes || 0,
        confirm: confirmVotes || 0,
        deny: (totalVotes || 0) - (confirmVotes || 0),
        audited: auditedVotes || 0,
      },
      registrations: {
        approvedEmails: approvedEmails || 0,
        registeredTokens: totalUsers,
        note: 'These two lists are mathematically unlinkable',
      },
      lastAudit: lastAudit
        ? {
            type: lastAudit.audit_type,
            success: lastAudit.success,
            processedRumors: lastAudit.rumors_processed,
            timestamp: lastAudit.created_at,
          }
        : null,
    });
  } catch (error) {
    console.error('Status error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
