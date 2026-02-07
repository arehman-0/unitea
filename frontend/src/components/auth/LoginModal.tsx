'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuthStore } from '@/lib/store';
import { Key, AlertCircle, CheckCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [tokenId, setTokenId] = useState('');
  const [signature, setSignature] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const setCredentials = useAuthStore((state) => state.setCredentials);
  const setTrustScore = useAuthStore((state) => state.setTrustScore);

  const handleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, signature }),
      });
      const data = await response.json();

      if (!data.success || !data.valid) {
        throw new Error('Invalid token or signature');
      }

      if (!data.registered) {
        throw new Error('Token not registered');
      }

      setCredentials(tokenId, signature);
      if (data.user?.trustScore) {
        setTrustScore(data.user.trustScore);
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setTokenId('');
        setSignature('');
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setTokenId('');
      setSignature('');
      setError('');
      setSuccess(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Login with Token" size="md">
      <div className="p-6">
        {success ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700">Welcome back!</h3>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6 p-4 bg-primary-soft rounded-lg">
              <Key className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold text-ink">Token Authentication</h3>
                <p className="text-sm text-ink/60">
                  Enter your anonymous token credentials
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Token ID"
                type="text"
                placeholder="Your token ID (64 hex characters)"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
              />

              <Input
                label="Signature"
                type="text"
                placeholder="Your signature"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
              />

              <p className="text-sm text-ink/40">
                Your token was provided when you first registered. Keep it safe!
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleLogin}
                disabled={!tokenId || !signature || isLoading}
                isLoading={isLoading}
                className="flex-1"
              >
                Login
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
