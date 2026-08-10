import { Helmet } from 'react-helmet-async';
import AdminProducts from '@/components/admin/AdminProducts';
import XcapePageHeader from '@/components/xcape/XcapePageHeader';

/** XCAPE Products & Ingredients — existing product catalog module, unchanged. */
const XcapeAdminProducts = () => (
  <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto space-y-5">
    <Helmet>
      <title>Products &amp; Ingredients — XCAPE</title>
    </Helmet>
    <XcapePageHeader
      title="Products & Ingredients"
      description="Product catalog used for treatment and home-care selection inside assessments."
    />
    <AdminProducts />
  </div>
);

export default XcapeAdminProducts;
