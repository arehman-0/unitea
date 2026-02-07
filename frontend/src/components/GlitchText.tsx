'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

interface GlitchTextProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'span' | 'p';
  glitchOnHover?: boolean;
}

export default function GlitchText({
  text,
  className = '',
  as: Tag = 'span',
  glitchOnHover = true,
}: GlitchTextProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.span
      className={`relative inline-block ${className}`}
      onMouseEnter={() => glitchOnHover && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Tag className="relative z-10">{text}</Tag>
      {isHovered && (
        <>
          <Tag
            className="absolute inset-0 text-ember z-0"
            style={{
              animation: 'glitch-1 0.3s linear infinite',
            }}
            aria-hidden
          >
            {text}
          </Tag>
          <Tag
            className="absolute inset-0 text-mystic z-0"
            style={{
              animation: 'glitch-2 0.3s linear infinite',
            }}
            aria-hidden
          >
            {text}
          </Tag>
        </>
      )}
    </motion.span>
  );
}
