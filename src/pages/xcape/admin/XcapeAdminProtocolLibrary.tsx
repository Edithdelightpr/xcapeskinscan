import { LibraryBig } from 'lucide-react';
import XcapePlaceholder from '@/components/xcape/XcapePlaceholder';

/** Protocol Library — planned capability, clearly labelled. */
const XcapeAdminProtocolLibrary = () => (
  <XcapePlaceholder
    icon={LibraryBig}
    title="Protocol Library"
    description="Structured treatment and home-care protocols mapped to the XCAPE scoring bands will be managed here. This module is not yet active; current treatment and home-care direction handling inside the assessment is unchanged."
  />
);

export default XcapeAdminProtocolLibrary;
