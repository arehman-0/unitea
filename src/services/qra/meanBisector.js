/**
 * Mean Bisector Analysis
 *
 * Dynamically calculates thresholds for anomaly detection using iterative bisection.
 * Used for detecting abnormal voting patterns (swarm attacks).
 *
 * Algorithm:
 * 1. Calculate mean (μ) of all values
 * 2. Bisect into Group1 (< μ) and Group2 (≥ μ)
 * 3. Calculate μ1 and μ2 for each group
 * 4. Mid_value = (μ1 + μ2) / 2
 * 5. Repeat until stable
 * 6. Threshold = Mid_value ± (deviation + sensitivity)
 */

const constants = require('../../config/constants');

const MAX_ITERATIONS = 100;
const CONVERGENCE_THRESHOLD = 0.0001;

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values, mean) {
  if (!values || values.length < 2) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(calculateMean(squaredDiffs));
}

/**
 * Perform Mean Bisector Analysis to find dynamic threshold
 *
 * @param {number[]} values - Array of values to analyze
 * @param {number} sensitivityFactor - Adjustment factor (-0.4 to +0.2)
 * @returns {Object} - Threshold and analysis data
 */
function calculateThreshold(values, sensitivityFactor = constants.SENSITIVITY_FACTOR) {
  if (!values || values.length === 0) {
    return {
      threshold: 0,
      upperThreshold: 0,
      lowerThreshold: 0,
      midValue: 0,
      iterations: 0,
      converged: false
    };
  }

  if (values.length === 1) {
    return {
      threshold: values[0],
      upperThreshold: values[0],
      lowerThreshold: values[0],
      midValue: values[0],
      iterations: 0,
      converged: true
    };
  }

  let midValue = calculateMean(values);
  let previousMidValue = Infinity;
  let iterations = 0;

  // Iterative bisection
  while (iterations < MAX_ITERATIONS &&
         Math.abs(midValue - previousMidValue) > CONVERGENCE_THRESHOLD) {
    previousMidValue = midValue;

    // Split into two groups
    const group1 = values.filter(v => v < midValue);
    const group2 = values.filter(v => v >= midValue);

    // Calculate means for each group
    const mean1 = group1.length > 0 ? calculateMean(group1) : midValue;
    const mean2 = group2.length > 0 ? calculateMean(group2) : midValue;

    // New mid value
    midValue = (mean1 + mean2) / 2;
    iterations++;
  }

  // Calculate deviation from the full dataset
  const deviation = calculateStdDev(values, midValue);

  // Apply sensitivity factor to adjust thresholds
  const adjustment = deviation * (1 + sensitivityFactor);

  return {
    threshold: midValue,
    upperThreshold: midValue + adjustment,
    lowerThreshold: Math.max(0, midValue - adjustment),
    midValue,
    deviation,
    iterations,
    converged: iterations < MAX_ITERATIONS
  };
}

/**
 * Calculate velocity threshold for swarm detection
 *
 * @param {number[]} historicalVelocities - Past vote velocities
 * @returns {number} - Threshold above which velocity is suspicious
 */
function calculateVelocityThreshold(historicalVelocities) {
  const analysis = calculateThreshold(historicalVelocities);

  // Use upper threshold multiplied by velocity multiplier
  return analysis.upperThreshold * constants.VELOCITY_MULTIPLIER;
}

/**
 * Detect if current velocity is anomalous (potential swarm)
 *
 * @param {number} currentVelocity - Current vote velocity
 * @param {number[]} historicalVelocities - Past velocities for comparison
 * @returns {Object} - Detection result
 */
function detectVelocityAnomaly(currentVelocity, historicalVelocities) {
  if (historicalVelocities.length < 3) {
    // Not enough history, use default threshold
    return {
      isAnomaly: currentVelocity > 1.0,  // More than 1 vote per minute
      threshold: 1.0,
      confidence: 0.5,
      reason: 'Insufficient history'
    };
  }

  const threshold = calculateVelocityThreshold(historicalVelocities);
  const isAnomaly = currentVelocity > threshold;

  // Calculate confidence based on how far above threshold
  let confidence = 0;
  if (isAnomaly && threshold > 0) {
    confidence = Math.min(1, (currentVelocity - threshold) / threshold);
  }

  return {
    isAnomaly,
    threshold,
    currentVelocity,
    confidence,
    reason: isAnomaly ? 'Velocity exceeds dynamic threshold' : 'Normal velocity'
  };
}

/**
 * Calculate threshold for trust score updates
 * Used to determine if a vote is malicious based on voting patterns
 *
 * @param {number[]} userTrustScores - Trust scores of users who voted
 * @returns {Object} - Threshold analysis
 */
function calculateTrustThreshold(userTrustScores) {
  return calculateThreshold(userTrustScores, constants.SENSITIVITY_FACTOR);
}

/**
 * Batch analyze multiple rumor velocities
 *
 * @param {Object[]} rumors - Array of rumors with velocity data
 * @returns {Object[]} - Rumors with anomaly flags
 */
function analyzeRumorVelocities(rumors) {
  // Calculate baseline from all rumors
  const allVelocities = rumors.map(r => r.velocity).filter(v => v > 0);
  const analysis = calculateThreshold(allVelocities);

  return rumors.map(rumor => ({
    rumorId: rumor.id,
    velocity: rumor.velocity,
    isAnomaly: rumor.velocity > analysis.upperThreshold * constants.VELOCITY_MULTIPLIER,
    threshold: analysis.upperThreshold * constants.VELOCITY_MULTIPLIER
  }));
}

module.exports = {
  calculateThreshold,
  calculateVelocityThreshold,
  detectVelocityAnomaly,
  calculateTrustThreshold,
  analyzeRumorVelocities,
  calculateMean,
  calculateStdDev
};
