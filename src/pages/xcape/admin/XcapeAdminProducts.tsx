import { Helmet } from 'react-helmet-async';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminProducts from '@/components/admin/AdminProducts';
import KitCustomizationManager from '@/components/xcape/admin/KitCustomizationManager';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';

/** XCAPE Products & Ingredients — existing product catalog module plus the
 *  kit & customization mapping that links the catalogue to the XCAPE
 *  customization protocol. */
const XcapeAdminProducts = () => (
  <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-5">
    <Helmet>
      <title>Products &amp; Ingredients — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Products & Ingredients"
      description="Product catalog used for treatment and home-care selection inside assessments, plus the XCAPE kit and customization mapping."
    />
    <Tabs defaultValue="catalogue">
      <TabsList>
        <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
        <TabsTrigger value="customization">Kits &amp; Customization</TabsTrigger>
      </TabsList>
      <TabsContent value="catalogue" className="pt-4">
        <AdminProducts />
      </TabsContent>
      <TabsContent value="customization" className="pt-4">
        <KitCustomizationManager />
      </TabsContent>
    </Tabs>
  </div>
);

export default XcapeAdminProducts;
