import { Helmet } from 'react-helmet-async';
import AdminTeam from '@/components/admin/AdminTeam';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';

/** XCAPE Practitioners — existing team management module, unchanged. */
const XcapeAdminPractitioners = () => (
  <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
    <Helmet>
      <title>Practitioners — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Practitioners"
      description="Practitioner and staff records."
    />
    <AdminTeam />
  </div>
);

export default XcapeAdminPractitioners;
