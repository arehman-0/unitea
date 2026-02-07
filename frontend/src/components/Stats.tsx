'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Card, { CardBody } from '@/components/ui/Card';
import { fadeInUp, viewportConfig } from '@/lib/motion';
import { Users, MessageSquare, ThumbsUp, Shield } from 'lucide-react';

interface SystemStats {
  users: {
    totalUsers: number;
    averageTrustScore: string;
  };
  rumors: {
    total: number;
    byState: {
      NEUTRAL: number;
      PROBATION: number;
      EMERGENT_TRUTH: number;
      FINALIZED: number;
    };
  };
  votes: {
    total: number;
    confirm: number;
    deny: number;
  };
}

export default function Stats() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/status');
        const data = await response.json();
        if (data.success) {
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const statItems = [
    {
      icon: Users,
      label: 'Users',
      value: stats.users.totalUsers,
      subtext: `Avg trust: ${stats.users.averageTrustScore}`,
      color: 'text-primary',
      bgColor: 'bg-primary-soft',
    },
    {
      icon: MessageSquare,
      label: 'Rumors',
      value: stats.rumors.total,
      subtext: `${stats.rumors.byState.NEUTRAL} pending`,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      icon: ThumbsUp,
      label: 'Votes',
      value: stats.votes.total,
      subtext: `${stats.votes.confirm} confirm`,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      icon: Shield,
      label: 'Finalized',
      value: stats.rumors.byState.FINALIZED,
      subtext: `${stats.rumors.byState.PROBATION} under review`,
      color: 'text-primary',
      bgColor: 'bg-primary-soft',
    },
  ];

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardBody className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.bgColor}`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{item.value}</p>
              <p className="text-xs text-ink/50">{item.label}</p>
              <p className="text-xs text-ink/30">{item.subtext}</p>
            </div>
          </CardBody>
        </Card>
      ))}
    </motion.div>
  );
}
