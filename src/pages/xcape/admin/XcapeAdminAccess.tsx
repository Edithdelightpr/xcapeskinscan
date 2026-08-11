import { Helmet } from 'react-helmet-async';
import AdminRoles from '@/components/admin/AdminRoles';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import XcapePendingTeamApprovals from '@/components/xcape/admin/XcapePendingTeamApprovals';

/** XCAPE Access Management — existing staff roles module, plus Team approvals. */
const XcapeAdminAccess = () => (
  <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-5">
    <Helmet>
      <title>Access Management — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Access Management"
      description="Staff accounts, role assignments and access requests."
    />
    <XcapePendingTeamApprovals />
    <AdminRoles />
  </div>
);


export default XcapeAdminAccess;
