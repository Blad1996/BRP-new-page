// SEO for the build: business data, page meta tags, JSON-LD (schema.org) and the Apache .htaccess.
export const SITE = 'https://bizrescuepro.com';
export const OG_IMAGE = { url: `${SITE}/assets/img/og/og-default.jpg`, width: 1200, height: 630, alt: 'A farmer working on a laptop in his barn, supported by Biz Rescue Pro' };

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;
const AREA = [
  { '@type': 'City', name: 'Toronto' },
  { '@type': 'AdministrativeArea', name: 'Greater Toronto Area' },
  { '@type': 'State', name: 'Ontario' },
];

export const organization = {
  '@type': 'ProfessionalService',
  '@id': ORG_ID,
  name: 'Biz Rescue Pro',
  url: `${SITE}/`,
  description: 'Managed IT support, cybersecurity, backup and business email for small businesses and farms in the Greater Toronto Area and across Ontario.',
  slogan: 'The right technology, at every stage of your growth.',
  email: 'info@bizrescuepro.com',
  telephone: '+1-855-462-5346',
  logo: { '@type': 'ImageObject', url: `${SITE}/assets/img/logo-square.png`, width: 512, height: 512 },
  image: OG_IMAGE.url,
  address: {
    '@type': 'PostalAddress',
    streetAddress: '30 Bertrand Ave, Unit B106',
    addressLocality: 'Scarborough',
    addressRegion: 'ON',
    postalCode: 'M1L 2P5',
    addressCountry: 'CA',
  },
  areaServed: AREA,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: '+1-855-462-5346',
    email: 'info@bizrescuepro.com',
    areaServed: 'CA',
    availableLanguage: ['en'],
  },
  knowsAbout: ['IT support', 'Managed IT services', 'Cybersecurity', 'Network security', 'Data backup', 'Business continuity', 'Microsoft 365', 'Google Workspace', 'Business email'],
};

const website = { '@type': 'WebSite', '@id': SITE_ID, url: `${SITE}/`, name: 'Biz Rescue Pro', inLanguage: 'en-CA', publisher: { '@id': ORG_ID } };

const breadcrumbs = (url, items) => ({
  '@type': 'BreadcrumbList',
  '@id': `${url}#breadcrumb`,
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});

export const json = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// ---------- Static pages ----------
const PAGES = {
  'index.html': { path: '/', type: 'WebPage', crumb: null },
  'services.html': { path: '/services.html', type: 'WebPage', crumb: 'Services' },
  'about.html': { path: '/about.html', type: 'AboutPage', crumb: 'About' },
  'blog.html': { path: '/blog.html', type: 'CollectionPage', crumb: 'Blog' },
  'contact.html': { path: '/contact.html', type: 'ContactPage', crumb: 'Contact' },
  'privacy.html': { path: '/privacy.html', type: 'WebPage', crumb: 'Privacy Policy' },
};
export const indexablePages = Object.values(PAGES).map((p) => `${SITE}${p.path}`);

export function staticPageHead(file, html, { services = {}, posts = [] } = {}) {
  const page = PAGES[file];
  if (!page) return html;
  const url = `${SITE}${page.path}`;
  const title = unesc((html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'Biz Rescue Pro');
  const description = unesc((html.match(/name="description" content="([^"]*)"/) || [])[1] || '');

  const webpage = {
    '@type': page.type,
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: 'en-CA',
    isPartOf: { '@id': SITE_ID },
    about: { '@id': ORG_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: OG_IMAGE.url },
    ...(page.crumb && { breadcrumb: { '@id': `${url}#breadcrumb` } }),
  };
  const graph = [organization, website, webpage];
  if (page.crumb) graph.push(breadcrumbs(url, [['Home', `${SITE}/`], [page.crumb, url]]));

  if (file === 'services.html') {
    for (const [anchor, [name, description]] of Object.entries(services)) {
      graph.push({ '@type': 'Service', '@id': `${url}#${anchor}`, name, serviceType: name, description, url: `${url}#${anchor}`, provider: { '@id': ORG_ID }, areaServed: AREA });
    }
  }
  if (file === 'blog.html') {
    graph.push({
      '@type': 'Blog',
      '@id': `${url}#blog`,
      name: 'Biz Rescue Pro blog',
      url,
      description,
      inLanguage: 'en-CA',
      publisher: { '@id': ORG_ID },
      blogPost: posts.slice(0, 20).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/${p.slug}/`, datePublished: p.date })),
    });
    webpage.mainEntity = { '@id': `${url}#blog` };
  }

  const tags = [
    `<link rel="canonical" href="${url}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Biz Rescue Pro">',
    '<meta property="og:locale" content="en_CA">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${OG_IMAGE.url}">`,
    `<meta property="og:image:width" content="${OG_IMAGE.width}">`,
    `<meta property="og:image:height" content="${OG_IMAGE.height}">`,
    `<meta property="og:image:alt" content="${esc(OG_IMAGE.alt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': graph })}</script>`,
  ];
  return html.replace('</head>', `  ${tags.join('\n  ')}\n</head>`);
}

// ---------- Articles ----------
export function articleJsonLd(post, { canonical, image, section, wordCount }) {
  const graph = [
    {
      '@type': 'BlogPosting',
      '@id': `${canonical}#article`,
      headline: post.title.slice(0, 110),
      description: post.excerpt,
      url: canonical,
      mainEntityOfPage: canonical,
      datePublished: post.publishedUtc,
      dateModified: post.modifiedUtc,
      inLanguage: 'en-CA',
      articleSection: section,
      ...(post.tags.length && { keywords: post.tags.join(', ') }),
      wordCount,
      image: image || OG_IMAGE.url,
      author: { '@type': 'Person', name: post.author },
      publisher: { '@id': ORG_ID },
      isPartOf: { '@id': `${SITE}/blog.html#blog` },
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
    },
    breadcrumbs(canonical, [['Home', `${SITE}/`], ['Blog', `${SITE}/blog.html`], [post.title, canonical]]),
    organization,
  ];
  return json({ '@context': 'https://schema.org', '@graph': graph });
}

// ---------- .htaccess (Hostinger / Apache / LiteSpeed) ----------
export function htaccess(posts) {
  const shortlinks = posts
    .filter((p) => p.id)
    .map((p) => `RewriteCond %{QUERY_STRING} ^p=${p.id}$\nRewriteRule ^$ /${p.slug}/? [R=301,L]`)
    .join('\n');
  return `# Generated by scripts/build-site.mjs
Options -Indexes
DirectoryIndex index.html
ErrorDocument 404 /404.html

<IfModule mod_rewrite.c>
RewriteEngine On

# One canonical host: https://bizrescuepro.com
RewriteCond %{HTTPS} off [OR]
RewriteCond %{HTTP_HOST} ^www\\. [NC]
RewriteRule ^ https://bizrescuepro.com%{REQUEST_URI} [R=301,L]

# /index.html and /<slug>/index.html -> clean URL
RewriteCond %{THE_REQUEST} \\s/+(.*/)?index\\.html[\\s?] [NC]
RewriteRule ^(.*/)?index\\.html$ /$1 [R=301,L]

# Old WordPress archives and feeds -> blog
RewriteRule ^(category|tag|author)(/.*)?$ /blog.html [R=301,L]
RewriteRule ^(feed|comments/feed)/?$ /blog.html [R=301,L]
RewriteRule ^page/[0-9]+/?$ /blog.html [R=301,L]
RewriteRule ^[a-z0-9-]+/feed/?$ /blog.html [R=301,L]

# Browsers ask for /favicon.ico by default
RewriteRule ^favicon\\.ico$ /assets/img/favicon-32.png [L]

# Old WordPress media -> migrated copies
RewriteRule ^wp-content/uploads/(.*)$ /assets/uploads/$1 [R=301,L]

# Old WordPress shortlinks (/?p=ID) -> article
${shortlinks}
</IfModule>

<IfModule mod_deflate.c>
AddOutputFilterByType DEFLATE text/html text/css text/plain text/xml application/javascript application/json application/xml image/svg+xml
</IfModule>

<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType text/html "access plus 0 seconds"
ExpiresByType text/css "access plus 7 days"
ExpiresByType application/javascript "access plus 7 days"
ExpiresByType image/webp "access plus 1 year"
ExpiresByType image/jpeg "access plus 1 year"
ExpiresByType image/png "access plus 1 year"
ExpiresByType image/gif "access plus 1 year"
ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
`;
}
