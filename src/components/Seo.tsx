import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  jsonLd?: Record<string, any> | Record<string, any>[];
  noindex?: boolean;
  /** Override the default origin; pass '' to emit relative canonical/og URLs. */
  siteUrl?: string;
}

const SITE_URL = 'https://tropicsmedspa.com';
const DEFAULT_IMAGE = `${SITE_URL}/favicon.png`;

const Seo = ({ title, description, path = '/', image, type = 'website', jsonLd, noindex, siteUrl }: SeoProps) => {
  const url = `${siteUrl ?? SITE_URL}${path}`;
  const ogImage = image || DEFAULT_IMAGE;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
};

export default Seo;
