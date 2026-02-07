'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useAuthStore, useUIStore } from '@/lib/store';
import Button from '@/components/ui/Button';
import TrustScore from '@/components/ui/TrustScore';
import RegisterModal from '@/components/auth/RegisterModal';
import LoginModal from '@/components/auth/LoginModal';
import { useHeaderScroll } from '@/lib/hooks/useHeaderScroll';
import { Coffee, User, LogOut, Key, UserPlus } from 'lucide-react';

interface HeaderProps {
  onRumorCreated?: () => void;
}

export default function Header({ onRumorCreated }: HeaderProps) {
  const [showRegister, setShowRegister] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const scrolled = useHeaderScroll(50);
  const logoControls = useAnimation();
  const lastTimestampRef = useRef(0);

  const { isAuthenticated, tokenId, trustScore, logout } = useAuthStore();
  const lastActivityTimestamp = useUIStore((s) => s.lastActivityTimestamp);

  useEffect(() => {
    if (lastActivityTimestamp > lastTimestampRef.current && lastTimestampRef.current > 0) {
      logoControls.start({
        rotate: [0, -10, 10, -5, 0],
        transition: { duration: 0.5 },
      });
    }
    lastTimestampRef.current = lastActivityTimestamp;
  }, [lastActivityTimestamp, logoControls]);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 backdrop-blur-md border-b border-ink/5 shadow-sm'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div animate={logoControls}>
                <Coffee className="w-8 h-8 text-primary" />
              </motion.div>
              <div>
                <h1 className="text-xl font-bold text-ink">UniTea</h1>
                <p className="text-xs text-ink/40">Anonymous Campus Rumors</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ink/5 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-xs text-ink/40">Trust Score</p>
                      <p className="text-sm font-semibold text-ink">{trustScore.toFixed(1)}</p>
                    </div>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-ink/8 py-2 z-50">
                      <div className="px-4 py-3 border-b border-ink/5">
                        <p className="text-sm font-medium text-ink">Anonymous User</p>
                        <p className="text-xs text-ink/40 truncate">
                          {tokenId?.substring(0, 16)}...
                        </p>
                      </div>
                      <div className="px-4 py-3 border-b border-ink/5">
                        <p className="text-xs text-ink/40 mb-1">Your Trust Score</p>
                        <TrustScore score={trustScore} showLabel />
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLogin(true)}
                    className="text-ink/60"
                  >
                    <Key className="w-4 h-4 mr-1" />
                    Login
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowRegister(true)}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Register
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
      />
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
      />

      {showUserMenu && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </>
  );
}
