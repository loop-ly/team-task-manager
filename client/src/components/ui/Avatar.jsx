import { avatarColor, initials } from '../../utils/format';

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
};

/** Round badge with the person's initials. */
export default function Avatar({ name, size = 'md', className = '' }) {
  return (
    <span
      title={name}
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white ${SIZES[size]} ${avatarColor(name)} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
