import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';
import XcapeSkinJourney from '@/components/xcape/journey/XcapeSkinJourney';
import ClientProfile from '@/pages/ClientProfile';

/**
 * `/xcape/clients/:id`
 *
 * Affiliate / CDP accounts get the XCAPE Skin Journey (product presentation
 * over the same RLS-scoped data). Administrators keep the operational
 * MedSpa client profile they rely on backstage.
 */
const XcapeClientJourney = () => {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, accountType } = useAuth();
  if (!usesProductChrome(accountType, isAdmin)) return <ClientProfile />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Skin Journey — XCAPE</title>
      </Helmet>
      {id && <XcapeSkinJourney clientId={id} />}
    </div>
  );
};

export default XcapeClientJourney;
