'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import RumorCard from './RumorCard';
import Button from '@/components/ui/Button';
import { CATEGORIES, RUMOR_STATES } from '@/lib/constants';
import { staggerContainer, cardEntry, viewportConfig } from '@/lib/motion';
import { RefreshCw, Filter } from 'lucide-react';
import type { Rumor } from '@/lib/supabase/types';

interface RumorFeedProps {
  initialRumors?: Rumor[];
}

export default function RumorFeed({ initialRumors = [] }: RumorFeedProps) {
  const [rumors, setRumors] = useState<Rumor[]>(initialRumors);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState({
    state: '',
    category: '',
    sortBy: 'newest',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchRumors = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.state) params.set('state', filter.state);
      if (filter.category) params.set('category', filter.category);
      params.set('sortBy', filter.sortBy);

      const response = await fetch(`/api/rumors?${params}`);
      const data = await response.json();

      if (data.success) {
        setRumors(data.rumors);
      }
    } catch (error) {
      console.error('Failed to fetch rumors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRumors();
  }, [fetchRumors]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-ink">Rumor Feed</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRumors}
            isLoading={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-ink/8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                State
              </label>
              <select
                value={filter.state}
                onChange={(e) => setFilter({ ...filter, state: e.target.value })}
                className="w-full px-3 py-2 border border-ink/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">All States</option>
                {Object.entries(RUMOR_STATES).map(([key, value]) => (
                  <option key={key} value={value}>
                    {key}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Category
              </label>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="w-full px-3 py-2 border border-ink/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink/70 mb-1">
                Sort By
              </label>
              <select
                value={filter.sortBy}
                onChange={(e) => setFilter({ ...filter, sortBy: e.target.value })}
                className="w-full px-3 py-2 border border-ink/15 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="trustScore">Trust Score</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoading && rumors.length === 0 ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-ink/20 mx-auto mb-3 animate-spin" />
          <p className="text-ink/40">Loading rumors...</p>
        </div>
      ) : rumors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-ink/8">
          <p className="text-ink/40">No rumors found</p>
          <p className="text-sm text-ink/20 mt-1">Be the first to share!</p>
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="space-y-4"
        >
          {rumors.map((rumor) => (
            <motion.div key={rumor.id} variants={cardEntry}>
              <RumorCard
                id={rumor.id}
                content={rumor.content}
                category={rumor.category}
                state={rumor.state}
                trustScore={Number(rumor.frozen_trust_score ?? rumor.trust_score)}
                confirmVotes={rumor.confirm_votes}
                denyVotes={rumor.deny_votes}
                emergentTruth={rumor.emergent_truth}
                createdAt={rumor.created_at}
                onVote={fetchRumors}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
