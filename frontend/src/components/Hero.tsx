'use client';

import { motion } from 'framer-motion';
import { useScrollProgress } from '@/lib/hooks/useScrollProgress';
import { useMousePosition } from '@/lib/hooks/useMousePosition';
import GlitchText from './GlitchText';
import MagneticButton from './MagneticButton';
import LivePulse from './LivePulse';

const headline = 'Something is happening on campus right now.';
const words = headline.split(' ');

export default function Hero() {
  const scrollProgress = useScrollProgress();
  const mouse = useMousePosition();

  const opacity = 1 - scrollProgress * 2.5;
  const parallaxX = (mouse.normalizedX - 0.5) * 20;
  const parallaxY = (mouse.normalizedY - 0.5) * 15;

  return (
    <section
      className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden z-0"
      style={{ opacity: Math.max(opacity, 0) }}
    >
      {/* Radial gradient background responding to cursor */}
      <div
        className="absolute inset-0 transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(ellipse 600px 400px at ${mouse.normalizedX * 100}% ${mouse.normalizedY * 100}%, rgba(230, 57, 70, 0.06) 0%, transparent 70%)`,
        }}
      />

      {/* Scanline effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute left-0 right-0 h-px bg-chalk/5"
          style={{ animation: 'scanline 8s linear infinite' }}
        />
      </div>

      {/* Top signal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-12"
      >
        <LivePulse label="CAMPUS FEED ACTIVE" />
      </motion.div>

      {/* Main headline — word-by-word stagger */}
      <motion.div
        style={{ x: parallaxX, y: parallaxY }}
        className="relative"
      >
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-chalk text-center px-6 leading-tight max-w-5xl">
          {words.map((word, i) => (
            <motion.span
              key={i}
              className="inline-block mr-[0.3em]"
              initial={{ opacity: 0, y: 50, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                delay: 0.5 + i * 0.08,
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {word === 'happening' ? (
                <GlitchText text={word} className="text-ember" as="span" />
              ) : (
                word
              )}
            </motion.span>
          ))}
        </h1>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="mt-8 text-chalk/30 text-base md:text-lg font-mono tracking-wide text-center px-4"
      >
        The truth is emergent. The whispers are real.
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2, duration: 0.6 }}
        className="mt-12"
      >
        <MagneticButton
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          className="group relative px-8 py-3 bg-ember text-chalk font-medium rounded-lg overflow-hidden transition-all hover:shadow-lg hover:shadow-ember/20"
          strength={0.4}
        >
          <span className="relative z-10 flex items-center gap-2">
            Share what you know
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            >
              &rarr;
            </motion.span>
          </span>
        </MagneticButton>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1 }}
        className="absolute bottom-12 flex flex-col items-center text-chalk/15"
      >
        <span className="text-xs font-mono tracking-widest uppercase mb-3">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="w-px h-8 bg-gradient-to-b from-chalk/20 to-transparent"
        />
      </motion.div>
    </section>
  );
}
