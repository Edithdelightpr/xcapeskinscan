import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import tropicsLogo from '@/assets/tropics-logo.jpeg';

const TopNav = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tropicsLogo} alt="Tropics MedSpa" className="h-10 w-auto rounded" />
          <span className="text-lg font-bold tracking-wide text-foreground font-display">
            Tropics MedSpa
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-muted-foreground tracking-widest uppercase font-sans">
            Skin Intelligence System
          </span>
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-surface transition-all border border-border/40"
          >
            <Lock className="w-3 h-3" />
            Staff
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
