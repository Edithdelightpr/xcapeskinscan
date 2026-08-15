import { Helmet } from 'react-helmet-async';
import AdminClientRecords from '@/components/admin/AdminClientRecords';
import TeamCapturedLeads from '@/components/xcape/TeamCapturedLeads';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import XcapeClientLibrary from '@/components/xcape/clients/XcapeClientLibrary';
import { useAuth } from '@/hooks/useAuth';
import { usesProductChrome } from '@/lib/xcapeExperience';

/**
 * XCAPE Clients — reuses the existing client records module unchanged.
 * Client profiles open at their existing /admin/clients/:id deep links.
 */
const XcapeClients = () => {
  const { isAdmin, accountType } = useAuth();
  const productChrome = usesProductChrome(accountType, isAdmin);
  return (
  <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-5">
    <Helmet>
      <title>Clients — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Clients"
      description="Your skin library — every person you have analysed, with their captured images and progress."
    />
    {productChrome ? (
      <XcapeClientLibrary />
    ) : (
      <>
        <TeamCapturedLeads />
        <AdminClientRecords />
      </>
    )}
  </div>
  );
};

export default XcapeClients;
