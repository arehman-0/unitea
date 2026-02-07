'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CardBody, CardFooter } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import TrustScore from '@/components/ui/TrustScore';
import VoteModal from './VoteModal';
import { STATE_CONFIG } from '@/lib/constants';
import { ThumbsUp, ThumbsDown, MessageSquare, Clock } from 'lucide-react';
import type { RumorState } from '@/lib/supabase/types';

interface RumorCardProps {
  id: string;
  content: string;
  category: string;
  state: RumorState;
  trustScore: number;
  confirmVotes: number;
  denyVotes: number;
  emergentTruth: string | null;
  createdAt: string;
  onVote?: () => void;
}

export default function RumorCard({
  id,
  content,
  category,
  state,
  trustScore,
  confirmVotes,
  denyVotes,
  emergentTruth,
  createdAt,
  onVote,
}: RumorCardProps) {
  const [showVoteModal, setShowVoteModal] = useState(false);
  const totalVotes = confirmVotes + denyVotes;
  const stateConfig = STATE_CONFIG[state];

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const getStateBadge = () => {
    const variants: Record<RumorState, 'info' | 'warning' | 'success' | 'default'> = {
      NEUTRAL: 'info',
      PROBATION: 'warning',
      EMERGENT_TRUTH: 'success',
      FINALIZED: 'default',
    };

    return (
      <Badge variant={variants[state]} size="sm">
        {stateConfig.label}
      </Badge>
    );
  };

  const getBorderColor = () => {
    if (trustScore >= 4) return 'border-l-[3px] border-l-primary';
    if (trustScore >= 2.5) return 'border-l-2 border-l-primary/40';
    return 'border-l-2 border-l-accent';
  };

  const handleVoteComplete = () => {
    setShowVoteModal(false);
    onVote?.();
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className={`bg-white rounded-xl shadow-sm border border-ink/8 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-colors ${getBorderColor()}`}
      >
        <CardBody>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Badge variant="default" size="sm">
                {category}
              </Badge>
              {getStateBadge()}
            </div>
            <div className="flex items-center text-sm text-ink/40">
              <Clock className="w-4 h-4 mr-1" />
              {formatDate(createdAt)}
            </div>
          </div>

          <p className="text-ink/80 text-base leading-relaxed mb-4">{content}</p>

          <div className="flex items-center justify-between">
            <TrustScore score={trustScore} />

            {emergentTruth && (
              <Badge
                variant={emergentTruth === 'CONFIRMED' ? 'success' : emergentTruth === 'DENIED' ? 'danger' : 'default'}
              >
                {emergentTruth === 'CONFIRMED' ? 'Verified True' : emergentTruth === 'DENIED' ? 'Verified False' : 'Undetermined'}
              </Badge>
            )}
          </div>
        </CardBody>

        <CardFooter className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-ink/40">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-4 h-4 text-green-500" />
              {confirmVotes}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              {denyVotes}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {totalVotes} votes
            </span>
          </div>

          {state !== 'FINALIZED' && (
            <button
              onClick={() => setShowVoteModal(true)}
              className="text-primary hover:text-primary/80 font-medium text-sm transition-colors"
            >
              Vote
            </button>
          )}
        </CardFooter>
      </motion.div>

      <VoteModal
        isOpen={showVoteModal}
        onClose={() => setShowVoteModal(false)}
        rumorId={id}
        rumorContent={content}
        onVoteComplete={handleVoteComplete}
      />
    </>
  );
}
