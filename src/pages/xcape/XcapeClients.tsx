import { Helmet } from 'react-helmet-async';
import AdminClientRecords from '@/components/admin/AdminClientRecords';
import TeamCapturedLeads from '@/components/xcape/TeamCapturedLeads';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';

/**
 * XCAPE Clients — reuses the existing client records module unchanged.
 * Client profiles open at their existing /admin/clients/:id deep links.
 */
const XcapeClients = () => (
  <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-5">
    <Helmet>
      <title>Clients — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Clients"
      description="Client records with their assessments, media and reports."
    />
    <TeamCapturedLeads />
    <AdminClientRecords />
  </div>
);

export default XcapeClients;
