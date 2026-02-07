'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coffee } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import CreateRumorModal from '@/components/rumors/CreateRumorModal';

interface FloatingActionProps {
  onRumorCreated?: () => void;
}

export default function FloatingAction({ onRumorCreated }: FloatingActionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const { isAuthenticated } = useAuthStore();

  const handleClick = () => {
    setShowCreate(true);
  };

  return (
    <>
      <motion.button
        onClick={handleClick}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-accent text-white rounded-full shadow-lg shadow-accent/25 flex items-center justify-center hover:shadow-xl hover:shadow-accent/30 transition-shadow"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: 3,
          ease: 'easeInOut',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Create new rumor"
      >
        <Coffee className="w-6 h-6" />
      </motion.button>

      <CreateRumorModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onRumorCreated={onRumorCreated}
      />
    </>
  );
}
