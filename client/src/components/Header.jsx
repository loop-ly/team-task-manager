import { Link } from 'react-router-dom';
import Avatar from './ui/Avatar';
import Logo from './Logo';

export default function Header({ user, onLogout }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-8">
        <Link to="/" aria-label="Tandem home">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Avatar name={user.name} />
            <span className="hidden max-w-[12rem] truncate text-sm font-semibold sm:inline">{user.name}</span>
          </div>
          <button type="button" className="btn-secondary px-3 py-1.5" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
