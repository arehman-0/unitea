'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store';
import { CATEGORIES } from '@/lib/constants';
import { AlertCircle, CheckCircle, MessageCircle } from 'lucide-react';

interface CreateRumorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRumorCreated?: () => void;
}

export default function CreateRumorModal({
  isOpen,
  onClose,
  onRumorCreated,
}: CreateRumorModalProps) {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { tokenId, signature, isAuthenticated } = useAuthStore();

  const handleCreate = async () => {
    if (!content.trim()) return;
    if (!isAuthenticated || !tokenId || !signature) {
      setError('Please register or login first');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/rumors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Token-ID': tokenId,
          'X-Signature': signature,
        },
        body: JSON.stringify({ content: content.trim(), category }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create rumor');
      }

      setSuccess(true);
      setTimeout(() => {
        onRumorCreated?.();
        resetForm();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rumor');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setContent('');
    setCategory('general');
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Share a Rumor" size="md">
      <div className="p-6">
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700">Rumor Posted!</h3>
            <p className="text-ink/40 mt-2">Others can now vote on it</p>
          </div>
        ) : (
          <>
            {!isAuthenticated && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-yellow-700">
                <AlertCircle className="w-5 h-5" />
                <span>Please register or login to post rumors</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 mb-6 p-4 bg-primary-soft rounded-lg">
              <MessageCircle className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold text-ink">Anonymous Posting</h3>
                <p className="text-sm text-ink/60">
                  Your identity is protected by blind signatures
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-ink/70 mb-2">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-ink/15 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-ink/70 mb-2">
                Rumor Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's the rumor you've heard?"
                className="w-full px-3 py-2 border border-ink/15 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary min-h-[120px]"
                maxLength={2000}
              />
              <p className="text-sm text-ink/40 mt-1">
                {content.length}/2000 characters (minimum 10)
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={content.trim().length < 10 || isLoading || !isAuthenticated}
                isLoading={isLoading}
                className="flex-1"
              >
                Post Rumor
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
