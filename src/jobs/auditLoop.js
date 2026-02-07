/**
 * Audit Loop Job
 *
 * Runs every 24 hours to:
 * 1. Process semantic analysis on PROBATION rumors
 * 2. Run anti-collusion analysis
 * 3. Determine emergent truth for mature rumors
 * 4. Update user trust scores
 * 5. Apply trust decay
 */

const cron = require('node-cron');
const retroactiveAudit = require('../services/retroactiveAudit');
const semanticJudge = require('../services/semanticJudge');
const antiCollusion = require('../services/antiCollusion');
const gatekeeper = require('../services/gatekeeper');
const constants = require('../config/constants');

let isRunning = false;
let lastRunTime = null;
let lastRunResult = null;

/**
 * Run the full audit cycle
 */
async function runAuditCycle() {
  if (isRunning) {
    console.log('[AuditLoop] Audit already in progress, skipping...');
    return { skipped: true, reason: 'Already running' };
  }

  isRunning = true;
  const startTime = Date.now();
  console.log('[AuditLoop] Starting audit cycle...');

  const results = {
    timestamp: new Date().toISOString(),
    phases: {}
  };

  try {
    // Phase 0: Auto-process NEUTRAL rumors for velocity anomalies
    console.log('[AuditLoop] Phase 0: Checking velocity anomalies...');
    results.phases.gatekeeper = gatekeeper.autoProcessRumors();

    // Phase 1: Process semantic analysis on PROBATION rumors
    console.log('[AuditLoop] Phase 1: Running semantic analysis...');
    results.phases.semanticJudge = semanticJudge.processProbationRumors();

    // Phase 2: Run anti-collusion analysis
    console.log('[AuditLoop] Phase 2: Running anti-collusion analysis...');
    results.phases.antiCollusion = antiCollusion.runCollusionAnalysis();

    // Phase 3: Run retroactive audit (determine truth, update trust)
    console.log('[AuditLoop] Phase 3: Running retroactive audit...');
    results.phases.retroactiveAudit = retroactiveAudit.runAuditCycle();

    // Phase 4: Apply trust decay
    console.log('[AuditLoop] Phase 4: Applying trust decay...');
    results.phases.trustDecay = retroactiveAudit.applyTrustDecay();

    results.success = true;
    results.duration = Date.now() - startTime;

    console.log(`[AuditLoop] Audit cycle completed in ${results.duration}ms`);
    console.log(`[AuditLoop] Processed: ${results.phases.retroactiveAudit.processed} rumors`);
    console.log(`[AuditLoop] Rewarded: ${results.phases.retroactiveAudit.totalRewarded} users`);
    console.log(`[AuditLoop] Penalized: ${results.phases.retroactiveAudit.totalPenalized} users`);

  } catch (error) {
    console.error('[AuditLoop] Error during audit cycle:', error);
    results.success = false;
    results.error = error.message;
    results.duration = Date.now() - startTime;
  }

  lastRunTime = new Date();
  lastRunResult = results;
  isRunning = false;

  return results;
}

/**
 * Schedule the audit loop
 * Runs at midnight every day
 */
function scheduleAuditLoop() {
  // Run at 00:00 every day
  const job = cron.schedule('0 0 * * *', () => {
    console.log('[AuditLoop] Scheduled audit triggered');
    runAuditCycle();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[AuditLoop] Audit loop scheduled to run daily at midnight UTC');

  return job;
}

/**
 * Get audit loop status
 */
function getStatus() {
  return {
    isRunning,
    lastRunTime: lastRunTime?.toISOString() || null,
    lastRunResult: lastRunResult ? {
      success: lastRunResult.success,
      duration: lastRunResult.duration,
      rumorsProcessed: lastRunResult.phases?.retroactiveAudit?.processed || 0,
      usersRewarded: lastRunResult.phases?.retroactiveAudit?.totalRewarded || 0,
      usersPenalized: lastRunResult.phases?.retroactiveAudit?.totalPenalized || 0
    } : null,
    nextScheduledRun: getNextScheduledRun()
  };
}

/**
 * Calculate next scheduled run time
 */
function getNextScheduledRun() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(0, 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

/**
 * Manually trigger audit (for testing/admin)
 */
async function triggerManualAudit() {
  console.log('[AuditLoop] Manual audit triggered');
  return runAuditCycle();
}

module.exports = {
  scheduleAuditLoop,
  runAuditCycle,
  triggerManualAudit,
  getStatus
};
