// src/utils/seo.ts
/**
 * SEO utilities
 *
 * This module provides utilities for managing SEO-related elements
 * including meta tags, structured data, canonical URLs, and social media markup.
 * Designed specifically for Astro-based applications with financial content.
 */

// Assume formatCurrency is imported if needed, e.g.:
// import { formatCurrency } from './format'; // Assuming format.ts is in the same directory

export interface SeoProps {
  title: string;
  description: string;
  /** The absolute canonical URL for the current page. Required for robust SEO. */
  canonicalUrl: string; 
  image?: string; // Should be an absolute URL or path relative to siteUrl
  type?: 'website' | 'article' | 'product'; // OpenGraph type
  publishedTime?: string; // ISO 8601 format
  modifiedTime?: string;  // ISO 8601 format
  tags?: string[];
  noindex?: boolean;
  nofollow?: boolean;
  author?: string;
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
}

export interface SiteConfigForSeo {
  siteName: string;
  siteUrl: string; // Absolute base URL of the site, e.g., "https://www.properaccount.com"
  defaultImage?: string; // Absolute URL or path relative to siteUrl for a default OG/Twitter image
  twitterHandle?: string; // e.g., "@properaccount"
  locale?: string; // e.g., "en_US"
  themeColor?: string; // e.g., "#FFFFFF"
}

export interface OrganizationInfo {
  name: string;
  url: string; // Absolute URL
  logo?: string; // Absolute URL
  description?: string;
  sameAs?: string[]; // Array of absolute URLs (social profiles, etc.)
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
  url: string; // Absolute URL
  category: string; // E.g., "Mortgage Loan", "Business Line of Credit"
  provider: {
    '@type': 'Organization';
    name: string;
    url: string; // Absolute URL
  };
  interestRate?: number; // As a percentage, e.g., 5.25 for 5.25%
  feesAndCommissionsSpecification?: string; // URL or text
  amount?: {
    '@type': 'MonetaryAmount';
    minValue?: number;
    maxValue?: number;
    currency: string; // ISO 4217 currency code, e.g., "USD"
  };
  term?: {
    '@type': 'QuantitativeValue';
    value?: number; // e.g., the number of months or years
    minValue?: number;
    maxValue?: number;
    unitText?: 'MONTH' | 'YEAR'; // Standard unit codes 'MON' or 'ANN' are also common
  };
  offers?: {
    '@type': 'AggregateOffer' | 'Offer';
    lowPrice?: number;
    highPrice?: number;
    priceCurrency?: string;
    availability?: string; // E.g., "https://schema.org/InStock"
  };
  brand?: {
    '@type': 'Brand';
    name: string;
  };
}

/**
 * Generates HTML meta tags for SEO.
 * @param seo Specific SEO properties for the current page.
 * @param siteConfig Site-wide SEO configuration.
 * @param currentFullUrl The absolute URL of the current page (e.g., from Astro.url.href).
 * @returns A string of HTML meta tags.
 */
export function generateMetaTags(
  seo: SeoProps,
  siteConfig: SiteConfigForSeo,
): string {
  const fullTitle = `${seo.title} | ${siteConfig.siteName}`;
  
  // Ensure image URLs are absolute
  const imageUrl = seo.image
    ? (seo.image.startsWith('http') ? seo.image : new URL(seo.image, siteConfig.siteUrl).toString())
    : siteConfig.defaultImage
      ? (siteConfig.defaultImage.startsWith('http') ? siteConfig.defaultImage : new URL(siteConfig.defaultImage, siteConfig.siteUrl).toString())
      : undefined;

  // Ensure canonicalUrl is absolute. It's now a required part of SeoProps.
  const currentCanonicalUrl = seo.canonicalUrl.startsWith('http') 
    ? seo.canonicalUrl 
    : new URL(seo.canonicalUrl, siteConfig.siteUrl).toString();

  let metaTags = `
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <link rel="canonical" href="${currentCanonicalUrl}" />
    ${siteConfig.themeColor ? `<meta name="theme-color" content="${escapeHtml(siteConfig.themeColor)}" />` : ''}

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
    ${siteConfig.locale ? `<meta property="og:locale" content="${escapeHtml(siteConfig.locale)}" />` : ''}
    ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : ''}
    ${seo.publishedTime ? `<meta property="article:published_time" content="${escapeHtml(seo.publishedTime)}" />` : ''}
    ${seo.modifiedTime ? `<meta property="article:modified_time" content="${escapeHtml(seo.modifiedTime)}" />` : ''}
    ${seo.author ? `<meta property="article:author" content="${escapeHtml(seo.author)}" />` : ''}
    ${seo.tags?.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}" />`).join('\n    ') || ''}

    <meta name="twitter:card" content="${seo.twitterCard || (imageUrl ? 'summary_large_image' : 'summary')}" />
    ${siteConfig.twitterHandle ? `<meta name="twitter:site" content="${escapeHtml(siteConfig.twitterHandle.startsWith('@') ? siteConfig.twitterHandle : '@' + siteConfig.twitterHandle)}" />` : ''}
    ${seo.author && siteConfig.twitterHandle ? `<meta name="twitter:creator" content="${escapeHtml(siteConfig.twitterHandle.startsWith('@') ? siteConfig.twitterHandle : '@' + siteConfig.twitterHandle)}" />` : ''}
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : ''}
  `;
  // Note: <meta name="author"> is less common now, article:author or specific schema is preferred.

  return metaTags.trim().replace(/^\s*[\r\n]/gm, "");
}

/**
 * Generates SEO properties for a financial product page.
 * Requires `formatCurrency` to be imported from `../utils/format.ts`.
 */
export function getFinancialProductSeo(
  product: {
    name: string;
    description: string;
    type: string; // E.g., "Mortgage", "Business Loan"
    interestRate?: number; // e.g., 5.25 for 5.25%
    termInMonths?: number;
    minAmount?: number;
    maxAmount?: number;
    slug: string; // Relative path slug, e.g., "my-product"
    currency?: string; // e.g., "USD"
  },
  siteConfig: SiteConfigForSeo,
  // Provide formatCurrency function, e.g., imported from './format'
  formatter: { formatCurrency: (value: number, currency?: string, locale?: string) => string } 
): SeoProps {
  const title = `${product.name} - ${product.type} | ${siteConfig.siteName}`;
  let description = product.description;

  if (product.interestRate) {
    description += ` Starting at ${product.interestRate.toFixed(2)}% APR.`;
  }
  if (product.minAmount !== undefined && product.maxAmount !== undefined) {
    description += ` Amounts from ${formatter.formatCurrency(product.minAmount, product.currency, siteConfig.locale)} to ${formatter.formatCurrency(product.maxAmount, product.currency, siteConfig.locale)}.`;
  } else if (product.minAmount !== undefined) {
    description += ` Amounts from ${formatter.formatCurrency(product.minAmount, product.currency, siteConfig.locale)}.`;
  }
  if (product.termInMonths) {
    description += ` Terms up to ${product.termInMonths} months.`;
  }
  
  const canonicalUrl = new URL(`/products/${product.slug}`, siteConfig.siteUrl).toString();

  return {
    title,
    description: truncateForSeo(description, 155),
    canonicalUrl,
    type: 'product',
    twitterCard: 'summary_large_image',
  };
}

/** Helper to remove undefined properties from an object before JSON.stringify */
function removeUndefinedProps(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedProps).filter(item => item !== undefined);
  }
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const cleanedValue = removeUndefinedProps(value);
    if (cleanedValue !== undefined) {
      acc[key] = cleanedValue;
    }
    return acc;
  }, {} as any);
}

/**
 * Generates JSON-LD script tag for Organization schema.
 * @param org Information about the organization.
 * @returns HTML string for the JSON-LD script.
 */
export function generateOrganizationSchema(org: OrganizationInfo): string {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: org.url, // Should be absolute
    logo: org.logo, // Should be absolute
    description: org.description,
    sameAs: org.sameAs, // Array of absolute URLs
    contactPoint: org.contactPoint,
  };
  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `.trim().replace(/^\s*[\r\n]/gm, "");
}

/**
 * Generates JSON-LD script tag for FinancialProduct schema.
 * @param product Product details.
 * @param org Organization details (provider).
 * @returns HTML string for the JSON-LD script.
 */
export function generateFinancialProductSchema(
  product: {
    name: string;
    description: string;
    /** Absolute URL to the product page */
    url: string; 
    productType: string; // E.g., "Mortgage"
    interestRate?: number; // As a percentage e.g., 3.5 for 3.5%
    termInMonths?: number;
    minAmount?: number;
    maxAmount?: number;
    currency?: string; // ISO 4217, e.g., "USD"
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
    // Schema.org expects interestRate as a number (percentage), not string
    schema.interestRate = product.interestRate; 
  }
  if (product.minAmount !== undefined || product.maxAmount !== undefined) {
    schema.amount = {
        '@type': 'MonetaryAmount',
        currency: product.currency || 'USD',
        ...(product.minAmount !== undefined && { minValue: product.minAmount }),
        ...(product.maxAmount !== undefined && { maxValue: product.maxAmount }),
    };
    // Offer might be relevant if there are specific price points or ranges
    schema.offers = {
        '@type': 'AggregateOffer', // Or 'Offer' if a single specific offer
        ...(product.minAmount !== undefined && { lowPrice: product.minAmount }),
        ...(product.maxAmount !== undefined && { highPrice: product.maxAmount }),
        priceCurrency: product.currency || 'USD',
    };
  }
  if (product.termInMonths !== undefined) {
    schema.term = { 
        '@type': 'QuantitativeValue',
        value: product.termInMonths, 
        unitText: 'MONTH', // Or 'MON'
    };
  }

  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `.trim().replace(/^\s*[\r\n]/gm, "");
}

/**
 * Generates JSON-LD script tag for FAQPage schema.
 * @param faqs Array of question-answer pairs.
 * @returns HTML string for the JSON-LD script, or empty string if no FAQs.
 */
export function generateFaqSchema(
  faqs: Array<{ question: string; answer: string }>
): string {
  if (!faqs || faqs.length === 0) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: escapeHtml(faq.question), // Ensure question text is escaped
      acceptedAnswer: {
        '@type': 'Answer',
        text: escapeHtml(faq.answer), // Ensure answer text is escaped
      }
    }))
  };
  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `.trim().replace(/^\s*[\r\n]/gm, "");
}

/**
 * Generates JSON-LD script tag for BreadcrumbList schema.
 * @param items Array of breadcrumb items with name and optional URL.
 * @returns HTML string for the JSON-LD script, or empty string if no items.
 */
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url?: string /* Absolute URL */ }>
): string {
  if (!items || items.length === 0) return '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: escapeHtml(item.name),
      ...(item.url && { item: item.url }), // URL should be absolute
    }))
  };
  return `
    <script type="application/ld+json">
      ${JSON.stringify(removeUndefinedProps(schema))}
    </script>
  `.trim().replace(/^\s*[\r\n]/gm, "");
}

/**
 * Generates an XML sitemap string.
 * @param urls Array of URL entries for the sitemap.
 * @returns XML sitemap string.
 */
export function generateSitemap(
  urls: Array<{
    loc: string; // Absolute URL
    lastmod?: string; // YYYY-MM-DD
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number; // 0.0 to 1.0
  }>
): string {
  const xmlItems = urls.map(url => {
    let urlEntry = `<url><loc>${escapeHtml(url.loc)}</loc>`;
    if (url.lastmod) urlEntry += `<lastmod>${escapeHtml(url.lastmod)}</lastmod>`;
    if (url.changefreq) urlEntry += `<changefreq>${escapeHtml(url.changefreq)}</changefreq>`;
    if (url.priority !== undefined && url.priority >= 0 && url.priority <= 1) {
      urlEntry += `<priority>${url.priority.toFixed(1)}</priority>`;
    }
    urlEntry += `</url>`;
    return urlEntry;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${xmlItems}</urlset>`;
}

/**
 * Generates a robots.txt content string.
 * @param options Configuration for robots.txt directives.
 * @returns robots.txt content string.
 */
export function generateRobotsTxt(
  options: {
    sitemapUrl?: string; // Absolute URL to sitemap.xml
    disallow?: Array<{ userAgent?: string; path: string | string[] }>;
    allow?: Array<{ userAgent?: string; path: string | string[] }>;
    crawlDelay?: { userAgent?: string; delaySeconds: number };
  } = {}
): string {
  let content = '';
  
  // Group rules by User-Agent
  const rulesByAgent: Record<string, { allow: string[], disallow: string[], crawlDelay?: number }> = {};

  const addRule = (type: 'allow' | 'disallow', agent: string, path: string) => {
    if (!rulesByAgent[agent]) rulesByAgent[agent] = { allow: [], disallow: [] };
    rulesByAgent[agent][type].push(path);
  };

  options.disallow?.forEach(rule => {
    const agent = rule.userAgent || '*';
    (Array.isArray(rule.path) ? rule.path : [rule.path]).forEach(p => addRule('disallow', agent, p));
  });

  options.allow?.forEach(rule => {
    const agent = rule.userAgent || '*';
    (Array.isArray(rule.path) ? rule.path : [rule.path]).forEach(p => addRule('allow', agent, p));
  });
  
  if (options.crawlDelay) {
    const agent = options.crawlDelay.userAgent || '*';
    if (!rulesByAgent[agent]) rulesByAgent[agent] = { allow: [], disallow: [] };
    rulesByAgent[agent].crawlDelay = options.crawlDelay.delaySeconds;
  }

  // Default User-agent if no specific rules are provided for '*'
  if (!rulesByAgent['*'] && Object.keys(rulesByAgent).length > 0) {
     content += 'User-agent: *\nDisallow:\n\n'; // Default allow all for unspecified agents if other agents are specified
  } else if (!rulesByAgent['*']) {
     rulesByAgent['*'] = {allow: [], disallow: []}; // Ensure '*' agent exists if no rules at all
  }


  for (const agent in rulesByAgent) {
    content += `User-agent: ${agent}\n`;
    rulesByAgent[agent].disallow.forEach(path => content += `Disallow: ${path}\n`);
    rulesByAgent[agent].allow.forEach(path => content += `Allow: ${path}\n`);
    if (rulesByAgent[agent].crawlDelay !== undefined) {
      content += `Crawl-delay: ${rulesByAgent[agent].crawlDelay}\n`;
    }
    content += '\n';
  }
  
  if (options.sitemapUrl) {
    content += `Sitemap: ${options.sitemapUrl}\n`;
  }

  return content.trim();
}

/**
 * Helper function to create a site-wide SEO configuration object.
 * This can be used by Astro layouts or components to access default SEO values.
 */
export function createSiteSeoConfig(
  config: SiteConfigForSeo & { organization?: OrganizationInfo }
): SiteConfigForSeo & { organization?: OrganizationInfo; getFullUrl: (path: string) => string; } {
  return {
    ...config,
    defaultImage: config.defaultImage ? (config.defaultImage.startsWith('http') ? config.defaultImage : new URL(config.defaultImage, config.siteUrl).toString()) : undefined,
    getFullUrl: (path: string) => (path.startsWith('http') ? path : new URL(path.startsWith('/') ? path : `/${path}`, config.siteUrl).toString()),
  };
}

/** Basic HTML escaping utility */
function escapeHtml(str: string | undefined | null): string {
  if (str === undefined || str === null) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Truncates text for SEO descriptions, trying to end on a word boundary. */
export function truncateForSeo(text: string | undefined | null, maxLength = 160): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  // Trim to maxLength to ensure it's not over, then find last space
  let truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // If a space is found and it's not too early in the string, truncate at the space
  if (lastSpace > 0 && lastSpace > maxLength * 0.75) { // Heuristic: ensure reasonable length before ellipsis
    truncated = truncated.substring(0, lastSpace);
  } else {
    // If no good space, or too short, just cut and add ellipsis
    truncated = truncated.substring(0, maxLength - 1); 
  }
  return truncated + '…';
}

/** Creates a URL-friendly slug from a string. */
export function createSlug(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFKD') // Normalize accented characters
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}