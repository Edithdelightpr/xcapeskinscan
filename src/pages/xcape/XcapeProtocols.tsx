import { BookOpen } from 'lucide-react';
import XcapePlaceholder from '@/components/xcape/XcapePlaceholder';

/**
 * Practitioner-facing protocol browser — planned capability.
 * Clearly labelled placeholder; nothing about the analysis workflow changes.
 */
const XcapeProtocols = () => (
  <XcapePlaceholder
    icon={BookOpen}
    title="Protocols"
    description="A browsable library of treatment and home-care protocols mapped to the XCAPE Tropical Skin Analysis Standard is in preparation. Analysis, scoring and report generation continue to work exactly as before."
  />
);

export default XcapeProtocols;
