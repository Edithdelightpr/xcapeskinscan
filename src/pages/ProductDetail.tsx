import { useParams, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PublicTopNav from '@/components/PublicTopNav';
import PublicFooter from '@/components/public/PublicFooter';
import Seo from '@/components/Seo';
import PublicProductDetail from '@/components/public/products/PublicProductDetail';
import { usePublicProductBySlug } from '@/hooks/useProducts';
import PageReveal from '@/components/public/PageReveal';

const ProductDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading } = usePublicProductBySlug(slug);

  return (
    <PageReveal>
    <div className="min-h-screen gradient-primary">
      {product && (
        <Seo
          title={`${product.name} | Tropics Med Spa Abuja`}
          description={(product.description || `Buy ${product.name} from Tropics Med Spa — medical-grade skincare in Abuja.`).slice(0, 158)}
          path={`/products/${product.public_slug ?? slug ?? ''}`}
          image={product.image_url || undefined}
          type="product"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description || undefined,
            image: product.image_url || undefined,
            brand: { '@type': 'Brand', name: 'Tropics Med Spa' },
            offers: product.selling_price != null ? {
              '@type': 'Offer',
              priceCurrency: 'NGN',
              price: String(product.promo_price ?? product.selling_price),
              availability: 'https://schema.org/InStock',
              url: `https://tropicsmedspa.com/products/${product.public_slug ?? slug ?? ''}`,
            } : undefined,
          }}
        />
      )}
      <PublicTopNav />
      <main className="pt-20 min-h-[60vh]">
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
          </div>
        ) : !product ? (
          <div className="max-w-xl mx-auto text-center py-24 px-6 space-y-4">
            <h1 className="text-2xl font-display font-bold">Product not found</h1>
            <p className="text-sm text-muted-foreground">This product may no longer be available.</p>
            <Link to="/tropixa" className="inline-block text-sm font-semibold text-primary hover:underline">
              Back to menu
            </Link>
          </div>
        ) : (
          <PublicProductDetail product={product} />
        )}
      </main>
      <PublicFooter />
    </div>
    </PageReveal>
  );
};

export default ProductDetail;