export default function Logo({ light = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-[17px] font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'} ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-signal-700 shadow-glow">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 h-[18px] w-[18px]" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 17l5-5 4 4 7-8" /><path d="M15 8h5v5" />
        </svg>
      </span>
      <span>Adaptive<span className={light ? 'text-emerald-300' : 'text-brand'}>Intelligence</span></span>
    </span>
  );
}
