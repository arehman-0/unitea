/**
 * Archiver Job
 *
 * Runs periodically to:
 * 1. Archive rumors older than 4 months
 * 2. Preserve trust score impacts (with decay)
 * 3. Clean up orphaned votes
 */

const cron = require('node-cron');
const Rumor = require('../models/Rumor');
const Vote = require('../models/Vote');
const constants = require('../config/constants');

let lastRunTime = null;
let lastRunResult = null;

/**
 * Run the archival process
 */
function runArchival() {
  console.log('[Archiver] Starting archival process...');

  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    rumorsArchived: 0,
    votesCleanedUp: 0,
    details: []
  };

  try {
    // Get rumors ready for archival
    const rumorsToArchive = Rumor.getRumorsForArchival();

    console.log(`[Archiver] Found ${rumorsToArchive.length} rumors to archive`);

    for (const rumor of rumorsToArchive) {
      // Archive the rumor
      const archiveResult = Rumor.archiveRumor(rumor.id);

      if (archiveResult.success) {
        results.rumorsArchived++;
        results.details.push({
          rumorId: rumor.id,
          createdAt: rumor.createdAt,
          state: rumor.state,
          totalVotes: rumor.confirmVotes + rumor.denyVotes
        });
      }
    }

    // Clean up orphaned votes (votes for rumors that no longer exist)
    const cleanupResult = cleanupOrphanedVotes();
    results.votesCleanedUp = cleanupResult.cleaned;

    results.success = true;
    results.duration = Date.now() - startTime;

    console.log(`[Archiver] Archived ${results.rumorsArchived} rumors`);
    console.log(`[Archiver] Cleaned up ${results.votesCleanedUp} orphaned votes`);

  } catch (error) {
    console.error('[Archiver] Error during archival:', error);
    results.success = false;
    results.error = error.message;
    results.duration = Date.now() - startTime;
  }

  lastRunTime = new Date();
  lastRunResult = results;

  return results;
}

/**
 * Clean up votes for rumors that no longer exist
 */
function cleanupOrphanedVotes() {
  const votes = Vote.loadVotes();
  const rumors = Rumor.loadRumors();
  const rumorIds = new Set(Object.keys(rumors));

  const orphanedVoteIds = [];

  for (const voteId in votes) {
    if (!rumorIds.has(votes[voteId].rumorId)) {
      orphanedVoteIds.push(voteId);
    }
  }

  // Remove orphaned votes
  for (const voteId of orphanedVoteIds) {
    delete votes[voteId];
  }

  if (orphanedVoteIds.length > 0) {
    Vote.saveVotes(votes);
  }

  return {
    cleaned: orphanedVoteIds.length
  };
}

/**
 * Schedule the archiver job
 * Runs weekly on Sunday at 3 AM UTC
 */
function scheduleArchiver() {
  const job = cron.schedule('0 3 * * 0', () => {
    console.log('[Archiver] Scheduled archival triggered');
    runArchival();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[Archiver] Archiver scheduled to run weekly on Sundays at 3 AM UTC');

  return job;
}

/**
 * Get archiver status
 */
function getStatus() {
  // Count rumors eligible for archival
  const pendingArchival = Rumor.getRumorsForArchival().length;

  return {
    lastRunTime: lastRunTime?.toISOString() || null,
    lastRunResult: lastRunResult ? {
      success: lastRunResult.success,
      rumorsArchived: lastRunResult.rumorsArchived,
      votesCleanedUp: lastRunResult.votesCleanedUp,
      duration: lastRunResult.duration
    } : null,
    pendingArchival,
    archiveThresholdMonths: constants.ARCHIVE_MONTHS
  };
}

/**
 * Manually trigger archival (for testing/admin)
 */
function triggerManualArchival() {
  console.log('[Archiver] Manual archival triggered');
  return runArchival();
}

/**
 * Get list of rumors pending archival
 */
function getPendingArchivalList() {
  const rumors = Rumor.getRumorsForArchival();

  return rumors.map(r => ({
    id: r.id,
    createdAt: r.createdAt,
    state: r.state,
    totalVotes: r.confirmVotes + r.denyVotes,
    ageMonths: Math.floor(
      (Date.now() - new Date(r.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000)
    )
  }));
}

module.exports = {
  scheduleArchiver,
  runArchival,
  triggerManualArchival,
  getStatus,
  getPendingArchivalList,
  cleanupOrphanedVotes
};
