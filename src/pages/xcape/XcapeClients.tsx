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
  <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-6">
    <Helmet>
      <title>Clients — XCAPE</title>
    </Helmet>
    {productChrome ? (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your skin library — everyone you have analysed, with their images and progress.
        </p>
      </div>
    ) : (
      <XcapePageHeader
        title="Clients"
        description="Every person analysed, with their captured images and progress."
      />
    )}
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
