import { AlertTriangle } from 'lucide-react';
import XcapePlaceholder from '@/components/xcape/XcapePlaceholder';

/** Contraindications — planned capability, clearly labelled. */
const XcapeAdminContraindications = () => (
  <XcapePlaceholder
    icon={AlertTriangle}
    title="Contraindications"
    description="Contraindication mapping across products, ingredients and protocols arrives with the recommendation-criteria layer. Client safety and intake data continues to be captured unchanged in the existing assessment workflow."
  />
);

export default XcapeAdminContraindications;
