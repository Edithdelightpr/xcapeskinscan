import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useXcapeSections } from '@/hooks/useXcapeSections';
import { SECTION_LABELS, type SectionKey } from '@/lib/permissions';

interface Props {
  section: SectionKey;
  children: ReactNode;
}

/**
 * Route gate for XCAPE workspace destinations. Admins and staff without a
 * JobRole bundle pass through (legacy behaviour); staff with a bundle only
 * see the sections their role grants.
 */
const XcapeSectionGate = ({ section, children }: Props) => {
  const sections = useXcapeSections();

  if (sections && !sections.has(section)) {
    return (
      <div className="px-4 sm:px-6 py-16 max-w-xl mx-auto">
        <div className="glass rounded-2xl p-10 text-center space-y-4">
          <Lock className="w-10 h-10 mx-auto text-muted-foreground/50" />
          <h1 className="font-display font-bold text-2xl text-foreground">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            {SECTION_LABELS[section] ?? 'This area'} isn’t included in your current role.
            Contact an administrator if you need access.
          </p>
          <Link to="/xcape/analysis" className="inline-block text-sm text-primary hover:underline">
            Back to XCAPE
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default XcapeSectionGate;
