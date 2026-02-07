'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Stats from '@/components/Stats';
import RumorFeed from '@/components/rumors/RumorFeed';
import Sidebar from '@/components/Sidebar';
import FloatingAction from '@/components/FloatingAction';
import Footer from '@/components/Footer';

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRumorCreated = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <Hero />

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8 -mt-24">
        <div className="mb-8">
          <Stats />
        </div>

        <div className="flex gap-8">
          <div className="flex-1 min-w-0">
            <RumorFeed key={refreshKey} />
          </div>
          <Sidebar />
        </div>
      </main>

      <FloatingAction onRumorCreated={handleRumorCreated} />
      <Footer />
    </div>
  );
}
