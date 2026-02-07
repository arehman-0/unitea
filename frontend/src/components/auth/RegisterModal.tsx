'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useAuthStore } from '@/lib/store';
import { generateBlindedToken } from '@/lib/crypto';
import { Shield, Mail, Key, CheckCircle } from 'lucide-react';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'email' | 'signing' | 'complete';

export default function RegisterModal({ isOpen, onClose }: RegisterModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const setCredentials = useAuthStore((state) => state.setCredentials);

  const handleRegister = async () => {
    setError('');
    setIsLoading(true);

    try {
      setStep('signing');
      const keyResponse = await fetch('/api/auth/public-key');
      const keyData = await keyResponse.json();

      if (!keyData.success) {
        throw new Error(keyData.error || 'Failed to get public key');
      }

      const { tokenId, blindedToken, client } = await generateBlindedToken(
        keyData.publicKey.n,
        keyData.publicKey.e
      );

      const signResponse = await fetch('/api/auth/blind-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blindedToken, email }),
      });
      const signData = await signResponse.json();

      if (!signData.success) {
        throw new Error(signData.error || 'Failed to sign token');
      }

      const signature = client.unblindSignature(signData.blindedSignature);

      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId, signature }),
      });
      const registerData = await registerResponse.json();

      if (!registerData.success) {
        throw new Error(registerData.error || 'Failed to register');
      }

      setCredentials(tokenId, signature);
      setStep('complete');

      setTimeout(() => {
        onClose();
        setStep('email');
        setEmail('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setStep('email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setStep('email');
      setEmail('');
      setError('');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Anonymous Registration" size="md">
      <div className="p-6">
        {step === 'email' && (
          <>
            <div className="flex items-center gap-3 mb-6 p-4 bg-primary-soft rounded-lg">
              <Shield className="w-8 h-8 text-primary" />
              <div>
                <h3 className="font-semibold text-ink">Privacy Protected</h3>
                <p className="text-sm text-ink/60">
                  Your email and token are mathematically unlinkable
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="University Email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error}
              />

              <p className="text-sm text-ink/40">
                Valid domains: @university.edu, @uni.edu, @student.edu, @edu.pk
              </p>

              <div className="bg-base rounded-lg p-4 text-sm text-ink/60">
                <h4 className="font-semibold mb-2 text-ink/70">How it works:</h4>
                <ol className="list-decimal list-inside space-y-1">
                  <li>We verify your university email</li>
                  <li>You receive an anonymous token</li>
                  <li>Your email and token cannot be linked</li>
                  <li>Use your token to post and vote anonymously</li>
                </ol>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleRegister}
                disabled={!email || isLoading}
                isLoading={isLoading}
                className="flex-1"
              >
                Register
              </Button>
            </div>
          </>
        )}

        {step === 'signing' && (
          <div className="text-center py-8">
            <div className="animate-pulse flex flex-col items-center">
              <div className="flex items-center justify-center gap-4 mb-6">
                <Mail className="w-8 h-8 text-primary" />
                <div className="w-8 h-1 bg-primary/30 rounded animate-pulse" />
                <Key className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-lg font-semibold text-ink mb-2">Creating Anonymous Token</h3>
              <p className="text-ink/40">Using blind signature protocol...</p>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-700 mb-2">
              Registration Complete!
            </h3>
            <p className="text-ink/40">
              You can now post and vote anonymously
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
