'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  rumorId: string;
  rumorContent: string;
  onVoteComplete?: () => void;
}

export default function VoteModal({
  isOpen,
  onClose,
  rumorId,
  rumorContent,
  onVoteComplete,
}: VoteModalProps) {
  const [voteType] = useState<'CONFIRM' | 'DENY' | null>('CONFIRM');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { tokenId, signature, isAuthenticated } = useAuthStore();

  const handleVote = async () => {
    if (!voteType || !feedback.trim()) return;
    if (!isAuthenticated || !tokenId || !signature) {
      setError('Please register or login first');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/rumors/${rumorId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token-ID': tokenId,
          'X-Signature': signature,
        },
        body: JSON.stringify({ voteType, feedback: feedback.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to vote');
      }

      setSuccess(true);
      setTimeout(() => {
        onVoteComplete?.();
        resetForm();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vote failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFeedback('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      resetForm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Cast Your Vote" size="md">
      <div className="p-6">
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700">Vote Recorded!</h3>
            <p className="text-ink/40 mt-2">Thank you for your contribution</p>
          </div>
        ) : (
          <>
            {!isAuthenticated && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
                <AlertCircle className="w-5 h-5" />
                <span>Please register or login to vote</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="mb-6 p-4 bg-base rounded-lg border border-ink/5">
              <p className="text-ink/70 text-sm">{rumorContent}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-ink/70 mb-2">
                Share your thoughts (Required)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your reasoning or evidence..."
                className="w-full px-3 py-2 border border-ink/15 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary min-h-[100px]"
                maxLength={500}
              />
              <p className="text-sm text-ink/40 mt-1">
                {feedback.length}/500 characters (minimum 10)
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleVote}
                disabled={feedback.trim().length < 10 || isLoading || !isAuthenticated}
                isLoading={isLoading}
                className="flex-1"
              >
                Submit Vote
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
