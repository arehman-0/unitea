/**
 * Gatekeeper Service - Phase 1 Defense
 *
 * Monitors vote velocity to detect potential swarm attacks.
 * When suspicious activity is detected, triggers PROBATION state
 * and freezes the rumor's trust score.
 */

const Rumor = require('../models/Rumor');
const Vote = require('../models/Vote');
const meanBisector = require('./qra/meanBisector');
const constants = require('../config/constants');

/**
 * Calculate historical average velocity across all rumors
 */
function getHistoricalVelocities() {
  const rumors = Rumor.getAllRumors({ includeArchived: true });

  return rumors
    .filter(r => r.voteTimestamps && r.voteTimestamps.length > 0)
    .map(r => {
      const ageMinutes = (Date.now() - new Date(r.createdAt).getTime()) / 60000;
      return r.voteTimestamps.length / Math.max(ageMinutes, 1);
    });
}

/**
 * Check if a rumor's voting velocity is suspicious
 *
 * @param {string} rumorId - Rumor ID to check
 * @returns {Object} - Velocity check result
 */
function checkVelocity(rumorId) {
  const rumor = Rumor.getRumorById(rumorId);

  if (!rumor) {
    return { success: false, error: 'Rumor not found' };
  }

  // Calculate current velocity
  const currentVelocity = Rumor.getVoteVelocity(rumorId);

  // Get historical velocities for comparison
  const historicalVelocities = getHistoricalVelocities();

  // Detect anomaly
  const detection = meanBisector.detectVelocityAnomaly(
    currentVelocity,
    historicalVelocities
  );

  return {
    success: true,
    rumorId,
    currentVelocity,
    threshold: detection.threshold,
    isAnomaly: detection.isAnomaly,
    confidence: detection.confidence,
    reason: detection.reason,
    currentState: rumor.state
  };
}

/**
 * Process a new vote and check for swarm behavior
 *
 * @param {string} rumorId - Rumor that received the vote
 * @returns {Object} - Processing result with any state changes
 */
function processVote(rumorId) {
  const velocityCheck = checkVelocity(rumorId);

  if (!velocityCheck.success) {
    return velocityCheck;
  }

  const rumor = Rumor.getRumorById(rumorId);

  // If anomaly detected and rumor is still NEUTRAL, trigger PROBATION
  if (velocityCheck.isAnomaly &&
      rumor.state === constants.RUMOR_STATES.NEUTRAL &&
      velocityCheck.confidence > 0.3) {

    // Update state to PROBATION
    const stateResult = Rumor.updateRumorState(
      rumorId,
      constants.RUMOR_STATES.PROBATION
    );

    return {
      success: true,
      rumorId,
      action: 'PROBATION_TRIGGERED',
      previousState: constants.RUMOR_STATES.NEUTRAL,
      newState: constants.RUMOR_STATES.PROBATION,
      velocity: velocityCheck.currentVelocity,
      threshold: velocityCheck.threshold,
      confidence: velocityCheck.confidence,
      frozenTrustScore: stateResult.rumor?.frozenTrustScore
    };
  }

  return {
    success: true,
    rumorId,
    action: 'NORMAL',
    state: rumor.state,
    velocity: velocityCheck.currentVelocity,
    threshold: velocityCheck.threshold,
    isAnomaly: velocityCheck.isAnomaly
  };
}

/**
 * Scan all active rumors for velocity anomalies
 *
 * @returns {Object[]} - List of rumors with anomaly flags
 */
function scanAllRumors() {
  const rumors = Rumor.getAllRumors({
    state: constants.RUMOR_STATES.NEUTRAL
  });

  const historicalVelocities = getHistoricalVelocities();

  return rumors.map(rumor => {
    const currentVelocity = Rumor.getVoteVelocity(rumor.id);
    const detection = meanBisector.detectVelocityAnomaly(
      currentVelocity,
      historicalVelocities
    );

    return {
      rumorId: rumor.id,
      state: rumor.state,
      velocity: currentVelocity,
      threshold: detection.threshold,
      isAnomaly: detection.isAnomaly,
      confidence: detection.confidence,
      totalVotes: rumor.confirmVotes + rumor.denyVotes
    };
  });
}

/**
 * Auto-process all NEUTRAL rumors and trigger PROBATION where needed
 *
 * @returns {Object} - Summary of actions taken
 */
function autoProcessRumors() {
  const scan = scanAllRumors();
  const triggered = [];

  for (const result of scan) {
    if (result.isAnomaly && result.confidence > 0.3) {
      const stateResult = Rumor.updateRumorState(
        result.rumorId,
        constants.RUMOR_STATES.PROBATION
      );

      if (stateResult.success) {
        triggered.push({
          rumorId: result.rumorId,
          velocity: result.velocity,
          confidence: result.confidence
        });
      }
    }
  }

  return {
    scanned: scan.length,
    triggered: triggered.length,
    details: triggered
  };
}

/**
 * Get gatekeeper statistics
 */
function getStats() {
  const allRumors = Rumor.getAllRumors({ includeArchived: false });
  const velocities = getHistoricalVelocities();
  const thresholdAnalysis = meanBisector.calculateThreshold(velocities);

  return {
    totalActiveRumors: allRumors.length,
    neutralRumors: allRumors.filter(r => r.state === constants.RUMOR_STATES.NEUTRAL).length,
    probationRumors: allRumors.filter(r => r.state === constants.RUMOR_STATES.PROBATION).length,
    averageVelocity: velocities.length > 0
      ? (velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(4)
      : 0,
    currentThreshold: (thresholdAnalysis.upperThreshold * constants.VELOCITY_MULTIPLIER).toFixed(4)
  };
}

module.exports = {
  checkVelocity,
  processVote,
  scanAllRumors,
  autoProcessRumors,
  getStats
};
