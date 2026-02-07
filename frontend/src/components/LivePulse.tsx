'use client';

export default function LivePulse({ label = 'LIVE' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-ember">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ember opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-ember" />
      </span>
      {label}
    </span>
  );
}
