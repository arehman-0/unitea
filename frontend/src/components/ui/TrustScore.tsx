'use client';

import { getTrustScoreColor, getTrustScoreLabel } from '@/lib/constants';

interface TrustScoreProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function TrustScore({ score, showLabel = false, size = 'md' }: TrustScoreProps) {
  const color = getTrustScoreColor(score);
  const label = getTrustScoreLabel(score);

  const sizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const percentage = (score / 5) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className={`font-bold ${color} ${sizes[size]}`}>
          {score.toFixed(1)}
        </span>
        <span className="text-chalk/20 text-sm">/5</span>
      </div>
      {showLabel && (
        <span className={`text-sm ${color}`}>{label}</span>
      )}
      <div className="flex-1 h-1.5 bg-chalk-ghost rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full transition-all rounded-full ${
            score >= 4
              ? 'bg-flare'
              : score >= 3
              ? 'bg-mystic'
              : score >= 2
              ? 'bg-flare/60'
              : 'bg-ember'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
