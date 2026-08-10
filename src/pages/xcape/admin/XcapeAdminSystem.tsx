import { Helmet } from 'react-helmet-async';
import AdminActivityLog from '@/components/admin/AdminActivityLog';
import AdminSystemHealth from '@/components/admin/AdminSystemHealth';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** XCAPE Audit & System — existing activity log and system health modules. */
const XcapeAdminSystem = () => (
  <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-5">
    <Helmet>
      <title>Audit &amp; System — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Audit & System"
      description="Platform activity audit trail and system health."
    />
    <Tabs defaultValue="activity">
      <TabsList className="bg-card/80 border border-border/40">
        <TabsTrigger value="activity">Activity log</TabsTrigger>
        <TabsTrigger value="health">System health</TabsTrigger>
      </TabsList>
      <TabsContent value="activity" className="mt-4">
        <AdminActivityLog />
      </TabsContent>
      <TabsContent value="health" className="mt-4">
        <AdminSystemHealth />
      </TabsContent>
    </Tabs>
  </div>
);

export default XcapeAdminSystem;
