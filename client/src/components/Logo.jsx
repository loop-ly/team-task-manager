/** Two offset bars: a tall one beside a shorter one, like tasks moving side by side. */
export default function Logo({ light = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? '#ffffff' : '#162029'} />
        <rect x="7" y="8" width="8" height="16" rx="2.5" fill={light ? '#162029' : '#ffffff'} />
        <rect x="17" y="8" width="8" height="10" rx="2.5" fill="#6f95ff" />
      </svg>
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-ink'}`}>Tandem</span>
    </span>
  );
}
