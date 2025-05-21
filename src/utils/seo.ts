// src/utils/seo.ts
/**
 * SEO utilities
 *
 * This module provides utilities for managing SEO-related elements
 * including meta tags, structured data, canonical URLs, and social media markup.
 * Designed specifically for Astro-based applications with financial content.
 */

export interface SeoProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  noindex?: boolean;
  nofollow?: boolean;
  author?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
}

export interface OrganizationInfo {
  name: string;
  url: string;
  logo?: string;
  description?: string;
  sameAs?: string[];
  contactPoint?: Array<{
    '@type': 'ContactPoint';
    telephone?: string;
    contactType?: string;
    areaServed?: string;
    availableLanguage?: string[];
  }>;
}

interface FinancialProductSchema {
  '@context': 'https://schema.org';
  '@type': 'FinancialProduct';
  name: string;
  description: string;
  url: string;
  category: string;
  provider: {
    '@type': 'Organization';
    name: string;
    url: string;
  };
  interestRate?: number;
  feesAndCommissionsSpecification?: string;
  amount?: {
    '@type': 'MonetaryAmount';
    minValue?: number;
    maxValue?: number;
    currency: string;
  };
  term?: {
    '@type': 'QuantitativeValue';
    // FIXED: Added 'value' property to the term type definition
    value?: number; // e.g., the number of months or years
    minValue?: number;
    maxValue?: number;
    unitText?: 'MONTH' | 'YEAR';
  };
  offers?: {
    '@type': 'AggregateOffer' | 'Offer';
    lowPrice?: number;
    highPrice?: number;
    priceCurrency?: string;
    availability?: string;
  };
  brand?: {
    '@type': 'Brand';
    name: string;
  };
}


export function generateMetaTags(
  seo: SeoProps,
  siteConfig: {
    siteName: string;
    siteUrl: string;
    defaultImage?: string;
    twitterHandle?: string;
  }
): string {
  const fullTitle = `${seo.title} | ${siteConfig.siteName}`;
  const imageUrl = seo.image
    ? new URL(seo.image, siteConfig.siteUrl).toString()
    : siteConfig.defaultImage
      ? new URL(siteConfig.defaultImage, siteConfig.siteUrl).toString()
      : undefined;

  const currentCanonicalUrl = seo.canonicalUrl
    ? new URL(seo.canonicalUrl, siteConfig.siteUrl).toString()
    : (typeof window !== 'undefined' ? window.location.href : siteConfig.siteUrl);

  let metaTags = `
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <link rel="canonical" href="${currentCanonicalUrl}" />

    ${seo.noindex || seo.nofollow ?
      `<meta name="robots" content="${[
        seo.noindex ? 'noindex' : '',
        seo.nofollow ? 'nofollow' : ''
      ].filter(Boolean).join(', ')}" />` : ''}

    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:type" content="${seo.type || 'website'}" />
    <meta property="og:site_name" content="${escapeHtml(siteConfig.siteName)}" />
    <meta property="og:url" content="${currentCanonicalUrl}" />
    ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
    ${seo.publishedTime ? `<meta property="article:published_time" content="${seo.publishedTime}" />` : ''}
    ${seo.modifiedTime ? `<meta property="article:modified_time" content="${seo.modifiedTime}" />` : ''}
    ${seo.tags?.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}" />`).join('\n    ') || ''}

    <meta name="twitter:card" content="${seo.twitterCard || (imageUrl ? 'summary_large_image' : 'summary')}" />
    ${siteConfig.twitterHandle ? `<meta name="twitter:site" content="${siteConfig.twitterHandle.startsWith('@') ? siteConfig.twitterHandle : '@' + siteConfig.twitterHandle}" />` : ''}
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}

    ${seo.author ? `<meta name="author" content="${escapeHtml(seo.author)}" />` : ''}
  `;

  return metaTags.trim().replace(/^\s*[\r\n]/gm, "");
}

export function getFinancialProductSeo(
  product: {
    name: string;
    description: string;
    type: string;
    interestRate?: number;
    termInMonths?: number;
    minAmount?: number;
    maxAmount?: number;
    slug: string;
    currency?: string;
  },
  siteConfig: {
    siteName: string;
    siteUrl: string;
  }
): SeoProps {
  const title = `${product.name} - ${product.type} | ${siteConfig.siteName}`;
  let description = product.description;

  if (product.interestRate) {
    description += ` Starting at ${product.interestRate.toFixed(2)}% APR.`;
  }
  if (product.minAmount && product.maxAmount) {
    description += ` Amounts from ${formatCurrency(product.minAmount, product.currency)} to ${formatCurrency(product.maxAmount, product.currency)}.`;
  }
  if (product.termInMonths) {
    description += ` Terms up to ${product.termInMonths} months.`;
  }

  return {
    title,
    description: truncateForSeo(description, 155),
    canonicalUrl: `${siteConfig.siteUrl}/products/${product.slug}`,
    type: 'product',
    twitterCard: 'summary_large_image',
  };
}

export function generateOrganizationSchema(org: OrganizationInfo): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url,
    logo: org.logo,
    description: org.description,
    sameAs: org.sameAs,
    contactPoint: org.contactPoint,
  };
  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `;
}

export function generateFinancialProductSchema(
  product: {
    name: string;
    description: string;
    url: string;
    productType: string;
    interestRate?: number;
    termInMonths?: number;
    minAmount?: number;
    maxAmount?: number;
    currency?: string;
    brandName?: string;
  },
  org: OrganizationInfo
): string {
  const schema: FinancialProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: product.name,
    description: product.description,
    url: product.url,
    category: product.productType,
    provider: {
      '@type': 'Organization',
      name: org.name,
      url: org.url,
    },
  };

  if (product.brandName) {
    schema.brand = { '@type': 'Brand', name: product.brandName };
  }
  if (product.interestRate !== undefined) {
    schema.interestRate = product.interestRate;
  }
  if (product.minAmount !== undefined || product.maxAmount !== undefined) {
    schema.amount = {
        '@type': 'MonetaryAmount',
        currency: product.currency || 'USD',
        ...(product.minAmount !== undefined && { minValue: product.minAmount }),
        ...(product.maxAmount !== undefined && { maxValue: product.maxAmount }),
    };
    schema.offers = {
        '@type': 'AggregateOffer',
        lowPrice: product.minAmount,
        highPrice: product.maxAmount,
        priceCurrency: product.currency || 'USD',
    };
  }
  if (product.termInMonths !== undefined) {
    schema.term = { // This object now matches the FinancialProductSchema.term type
        '@type': 'QuantitativeValue',
        value: product.termInMonths, // 'value' is now an accepted property
        unitText: 'MONTH',
    };
  }

  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `;
}

export function generateFaqSchema(
  faqs: Array<{ question: string; answer: string }>
): string {
  if (!faqs || faqs.length === 0) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: escapeHtml(faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: escapeHtml(faq.answer),
      }
    }))
  };
  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `;
}

export function generateBreadcrumbSchema(
  items: Array<{ name: string; url?: string }>
): string {
  if (!items || items.length === 0) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: escapeHtml(item.name),
      ...(item.url && { item: item.url }),
    }))
  };
  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `;
}

export function generateSitemap(
  urls: Array<{
    loc: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
  }>
): string {
  const xmlItems = urls.map(url => {
    let urlEntry = `
    <url>
      <loc>${escapeHtml(url.loc)}</loc>`;
    if (url.lastmod) urlEntry += `
      <lastmod>${url.lastmod}</lastmod>`;
    if (url.changefreq) urlEntry += `
      <changefreq>${url.changefreq}</changefreq>`;
    if (url.priority !== undefined) urlEntry += `
      <priority>${url.priority.toFixed(1)}</priority>`;
    urlEntry += `
    </url>`;
    return urlEntry;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
    ${xmlItems.replace(/\n\s*/g, '')}
  </urlset>`;
}

export function generateRobotsTxt(
  options: {
    sitemapUrl?: string;
    disallow?: Array<{ userAgent?: string, path: string | string[] }>;
    allow?: Array<{ userAgent?: string, path: string | string[] }>;
    crawlDelay?: { userAgent?: string, delaySeconds: number };
  } = {}
): string {
  let content = '';
  const defaultUserAgent = options.disallow?.find(r => !r.userAgent || r.userAgent === '*') ||
                         options.allow?.find(r => !r.userAgent || r.userAgent === '*')
                         ? '' : 'User-agent: *\n';
  content += defaultUserAgent;

  options.disallow?.forEach(rule => {
    const ua = rule.userAgent && rule.userAgent !== '*' ? `User-agent: ${rule.userAgent}\n` : '';
    const paths = Array.isArray(rule.path) ? rule.path : [rule.path];
    content += `${ua}${paths.map(p => `Disallow: ${p}`).join('\n')}\n`;
  });

  options.allow?.forEach(rule => {
    const ua = rule.userAgent && rule.userAgent !== '*' ? `User-agent: ${rule.userAgent}\n` : '';
    const paths = Array.isArray(rule.path) ? rule.path : [rule.path];
    content += `${ua}${paths.map(p => `Allow: ${p}`).join('\n')}\n`;
  });

  if (options.crawlDelay) {
     content += `${options.crawlDelay.userAgent ? `User-agent: ${options.crawlDelay.userAgent}\n` : ''}Crawl-delay: ${options.crawlDelay.delaySeconds}\n`;
  }

  if (options.sitemapUrl) {
    content += `\nSitemap: ${options.sitemapUrl}\n`;
  }

  return content.trim();
}

export function createSeoConfig(
  defaultProps: {
    siteName: string;
    siteUrl: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultImage?: string;
    twitterHandle?: string;
    locale?: string;
    themeColor?: string;
    organization?: OrganizationInfo;
  }
): Record<string, any> {
  return {
    siteName: defaultProps.siteName,
    siteUrl: defaultProps.siteUrl,
    defaultTitle: defaultProps.defaultTitle || defaultProps.siteName,
    defaultDescription: defaultProps.defaultDescription || '',
    defaultImage: defaultProps.defaultImage,
    twitterHandle: defaultProps.twitterHandle,
    locale: defaultProps.locale || 'en_US',
    themeColor: defaultProps.themeColor,
    organization: defaultProps.organization,
    getFullUrl: (path: string) => new URL(path, defaultProps.siteUrl).toString(),
  };
}

function escapeHtml(str: string | undefined | null): string {
  if (str === undefined || str === null) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function truncateForSeo(text: string | undefined | null, length = 160): string {
  if (!text) return '';
  if (text.length <= length) return text;
  const truncated = text.substring(0, length);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > length * 0.75 && lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '…';
  }
  return truncated.substring(0, length -1) + '…';
}

export function createSlug(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function removeUndefinedProps(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedProps).filter(item => item !== undefined);
  }
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = removeUndefinedProps(value);
    }
    return acc;
  }, {} as any);
}

function formatCurrency(value: number, currencyCode: string = 'USD', locale: string = 'en-US'): string {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(value);
}