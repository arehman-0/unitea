// Trust Score Configuration
export const INITIAL_TRUST_SCORE = 2.5;
export const MIN_TRUST_SCORE = 0;
export const MAX_TRUST_SCORE = 5;
export const TRUST_REWARD = 0.1;
export const TRUST_PENALTY = 0.15;

// Rumor States
export const RUMOR_STATES = {
  NEUTRAL: 'NEUTRAL',
  PROBATION: 'PROBATION',
  EMERGENT_TRUTH: 'EMERGENT_TRUTH',
  FINALIZED: 'FINALIZED',
} as const;

// Vote Types
export const VOTE_TYPES = {
  CONFIRM: 'CONFIRM',
  DENY: 'DENY',
} as const;

// Categories
export const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'events', label: 'Events' },
  { value: 'sports', label: 'Sports' },
  { value: 'housing', label: 'Housing' },
  { value: 'food', label: 'Food' },
  { value: 'other', label: 'Other' },
] as const;

// Valid email domains
export const VALID_EMAIL_DOMAINS = [
  'university.edu',
  'uni.edu',
  'student.edu',
  'edu.pk',
];

// State colors and labels
export const STATE_CONFIG = {
  NEUTRAL: { color: 'bg-mystic', label: 'New', textColor: 'text-mystic' },
  PROBATION: { color: 'bg-flare', label: 'Under Review', textColor: 'text-flare' },
  EMERGENT_TRUTH: { color: 'bg-ember', label: 'Verified', textColor: 'text-ember' },
  FINALIZED: { color: 'bg-chalk/20', label: 'Final', textColor: 'text-chalk/70' },
} as const;

// Trust score colors — no blue or green
export function getTrustScoreColor(score: number): string {
  if (score >= 4) return 'text-flare';
  if (score >= 3) return 'text-mystic';
  if (score >= 2) return 'text-chalk/60';
  return 'text-ember';
}

export function getTrustScoreLabel(score: number): string {
  if (score >= 4) return 'Highly Trusted';
  if (score >= 3) return 'Trusted';
  if (score >= 2) return 'Neutral';
  if (score >= 1) return 'Low Trust';
  return 'Untrusted';
}
