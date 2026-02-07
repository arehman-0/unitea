'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Badge from '@/components/ui/Badge';
import { TrendingUp, Zap, CheckCircle } from 'lucide-react';
import { fadeInUp, viewportConfig } from '@/lib/motion';
import type { Rumor } from '@/lib/supabase/types';

export default function Sidebar() {
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [stats, setStats] = useState<{ rumors?: { byState?: Record<string, number> } } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rumorsRes, statsRes] = await Promise.all([
          fetch('/api/rumors?sortBy=newest&limit=20'),
          fetch('/api/admin/status'),
        ]);
        const rumorsData = await rumorsRes.json();
        const statsData = await statsRes.json();

        if (rumorsData.success) setRumors(rumorsData.rumors || []);
        if (statsData.success) setStats(statsData);
      } catch {
        // silent
      }
    };
    fetchData();
  }, []);

  const trending = rumors
    .filter((r) => r.confirm_votes + r.deny_votes > 0)
    .sort((a, b) => (b.confirm_votes + b.deny_votes) - (a.confirm_votes + a.deny_votes))
    .slice(0, 5);

  const categories = rumors.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const confirmed = rumors
    .filter((r) => r.emergent_truth === 'CONFIRMED')
    .slice(0, 3);

  return (
    <aside className="hidden md:block w-72 lg:w-80 shrink-0">
      <div className="sticky top-20 space-y-6">
        {/* Trending Topics */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="bg-white rounded-xl border border-ink/8 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-ink text-sm">Trending</h3>
          </div>
          {trending.length > 0 ? (
            <ul className="space-y-3">
              {trending.map((r) => (
                <li key={r.id} className="text-sm text-ink/70 leading-snug line-clamp-2">
                  {r.content}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/30">No trending rumors yet</p>
          )}
        </motion.div>

        {/* Momentum Tags */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="bg-white rounded-xl border border-ink/8 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-ink text-sm">Categories</h3>
          </div>
          {topCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {topCategories.map(([cat, count]) => (
                <Badge key={cat} variant="default" size="sm">
                  {cat} ({count})
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink/30">No categories yet</p>
          )}
        </motion.div>

        {/* Recently Confirmed */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="bg-white rounded-xl border border-ink/8 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-ink text-sm">Recently Confirmed</h3>
          </div>
          {confirmed.length > 0 ? (
            <ul className="space-y-3">
              {confirmed.map((r) => (
                <li key={r.id} className="text-sm text-ink/70 leading-snug line-clamp-2">
                  {r.content}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/30">No confirmed rumors yet</p>
          )}
        </motion.div>
      </div>
    </aside>
  );
}
