'use client';

import { Coffee } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white/50 border-t border-ink/5 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-ink/30">
            <Coffee className="w-4 h-4" />
            <span className="text-sm font-medium">UniTea</span>
          </div>
          <p className="text-xs text-ink/20">
            Where campus whispers find their truth
          </p>
        </div>
      </div>
    </footer>
  );
}
