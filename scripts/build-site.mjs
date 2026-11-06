// Builds the deployable site into dist/: static pages, one page per post at /<slug>/, blog list data and sitemap.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { SITE, OG_IMAGE, staticPageHead, articleJsonLd, htaccess, indexablePages } from './seo.mjs';

const PAGE = 20;
const posts = JSON.parse(readFileSync('content/posts.json', 'utf8'));
const template = readFileSync('scripts/templates/article.html', 'utf8');

const CATS = { security: 'Cybersecurity', backup: 'Backup & Continuity', email: 'Email & Accounts', everyday: 'Everyday IT', managed: 'Managed IT' };
const TYPES = { news: 'News', tips: 'Tip', guides: 'Guide' };
const SERVICES = {
  'it-support': ['IT Support & Maintenance', 'Fast help when something stops working, and regular upkeep so it happens less.'],
  email: ['Business Email & Communication', 'Professional email and accounts that belong to the business.'],
  security: ['Cybersecurity & Network Protection', 'Fewer weak spots in your accounts, devices and network.'],
  backup: ['Backup & Business Continuity', 'Records that come back when a computer or server fails.'],
  monitoring: ['Infrastructure Monitoring & Optimization', 'Issues spotted earlier, and a monthly view of how your technology is doing.'],
  managed: ['Managed IT Services', 'One accountable team instead of scattered fixes.'],
};
const HELPS = { security: ['security', 'managed'], backup: ['backup', 'monitoring'], email: ['email', 'security'], everyday: ['it-support', 'monitoring'], managed: ['managed', 'it-support'] };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const human = (d) => new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(new Date(d));
const absImage = (p) => p && (p.startsWith('../') ? `${SITE}/${p.slice(3)}` : p);

// ---------- Static files ----------
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/data', { recursive: true });
for (const f of readdirSync('.').filter((f) => f.endsWith('.html'))) {
  writeFileSync(`dist/${f}`, staticPageHead(f, readFileSync(f, 'utf8'), { services: SERVICES }));
}
cpSync('css/styles.css', 'dist/css/styles.css');
cpSync('js', 'dist/js', { recursive: true });
// Source JPGs in assets/img/ stay out of the build; the pages use the WebP versions in assets/img/photos/
if (existsSync('assets')) cpSync('assets', 'dist/assets', { recursive: true, filter: (src) => !/(^|[\\/])assets[\\/]img[\\/][^\\/]+\.jpe?g$/i.test(src) });

const reserved = new Set(['css', 'js', 'assets', 'data', 'blog']);
for (const p of posts) if (reserved.has(p.slug)) throw new Error(`Post slug "${p.slug}" clashes with a site folder`);

// ---------- Post pages ----------
const byCat = {};
posts.forEach((p) => (byCat[p.category] ||= []).push(p));

function relatedFor(post) {
  const list = byCat[post.category];
  const i = list.indexOf(post);
  const picks = [...list.slice(i + 1), ...list.slice(0, i)].slice(0, 3);
  return picks.map((r) => `          <li>
            <a href="../${r.slug}/" class="group block h-full border-t-2 border-forest bg-offwhite p-5 transition-colors hover:bg-white">
              <p class="label">${esc(CATS[r.category])} &nbsp;/&nbsp; ${TYPES[r.type]}</p>
              <h3 class="mt-2 text-lg leading-snug transition-colors group-hover:text-green">${esc(r.title)}</h3>
              <p class="mt-2 text-sm leading-relaxed text-sage">${esc(r.excerpt)}</p>
            </a>
          </li>`).join('\n');
}

function tocFor(post) {
  if (post.toc.length < 2) return '';
  const items = post.toc.map((t) => `<li><a href="#${t.id}">${esc(t.label)}</a></li>`).join('');
  return `<nav class="toc lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" aria-label="In this article" data-toc><p class="label mb-2">In this article</p><ul class="border-t border-line">${items}</ul></nav>`;
}

function helpsFor(post) {
  return HELPS[post.category].map((key) => {
    const [name, line] = SERVICES[key];
    return `              <li class="grid gap-3 border-b border-line py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6">
                <p><strong class="font-medium">${esc(name)}.</strong> ${esc(line)}</p>
                <a class="link-u gap-2 whitespace-nowrap" href="../services.html#${key}">How it works <span aria-hidden="true">&rarr;</span></a>
              </li>`;
  }).join('\n');
}

for (const post of posts) {
  const canonical = `${SITE}/${post.slug}/`;
  const image = post.image && existsSync(decodeURIComponent(post.image.slice(3))) ? absImage(post.image) : null;
  // Drop images whose file was never recovered (already broken on the old WordPress site)
  const body = readFileSync(`content/posts/${post.slug}.html`, 'utf8')
    .replace(/<img[^>]*src="\.\.\/(assets\/uploads\/[^"]+)"[^>]*>/g, (tag, p) => (existsSync(decodeURIComponent(p)) ? tag : ''));
  const wordCount = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  const jsonld = articleJsonLd(post, { canonical, image, section: CATS[post.category], wordCount });

  const vars = {
    // Keep the browser/search title near 60 characters: long headlines drop the brand suffix
    pageTitle: esc(post.title.length <= 45 ? `${post.title} | Biz Rescue Pro` : post.title),
    title: esc(post.title),
    description: esc(post.excerpt),
    excerpt: esc(post.excerpt),
    canonical,
    ogImage: image
      ? `<meta property="og:image" content="${esc(image)}">`
      : `<meta property="og:image" content="${OG_IMAGE.url}">\n  <meta property="og:image:width" content="${OG_IMAGE.width}">\n  <meta property="og:image:height" content="${OG_IMAGE.height}">`,
    jsonld,
    publishedISO: post.publishedUtc,
    dateModifiedISO: post.modifiedUtc,
    tagsMeta: post.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n  '),
    categoryKey: post.category,
    categoryLabel: esc(CATS[post.category]),
    typeLabel: TYPES[post.type],
    readMins: post.readMins,
    dateISO: post.date,
    dateHuman: human(post.date),
    author: esc(post.author),
    toc: tocFor(post),
    body,
    helps: helpsFor(post),
    contactTopic: encodeURIComponent(SERVICES[HELPS[post.category][0]][0]),
    related: relatedFor(post),
  };
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
  mkdirSync(`dist/${post.slug}`, { recursive: true });
  writeFileSync(`dist/${post.slug}/index.html`, html);
}

// ---------- Blog list ----------
// base is '' for dist/ (the live site) and 'dist/' for the copy of blog.html in the project root
const row = (p, base) => `          <li>
            <a href="${base}${p.slug}/" class="post-row">
              <p class="label md:col-span-3"><time datetime="${p.date.slice(0, 10)}">${human(p.date)}</time><span class="block text-forest">${esc(CATS[p.category])} &nbsp;/&nbsp; ${TYPES[p.type]}</span></p>
              <div class="md:col-span-8"><h3>${esc(p.title)}</h3><p class="mt-2 max-w-2xl text-sm leading-relaxed text-sage">${esc(p.excerpt)}</p></div>
              <span class="arrow hidden text-right md:col-span-1 md:block" aria-hidden="true">&rarr;</span>
            </a>
          </li>`;

const [latest, ...rest] = posts;
const featured = (base) => `<article class="group relative mt-8 grid gap-6 bg-forest p-6 text-offwhite sm:p-10 lg:grid-cols-12 lg:items-center" data-reveal>
          <div class="lg:col-span-7">
            <p class="mb-3 inline-block bg-offwhite px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-forest">Latest</p>
            <p class="label"><time datetime="${latest.date.slice(0, 10)}">${human(latest.date)}</time> &nbsp;/&nbsp; ${esc(CATS[latest.category])} &nbsp;/&nbsp; ${TYPES[latest.type]}</p>
            <h2 class="mt-3 text-3xl leading-tight sm:text-[2.6rem]"><a href="${base}${latest.slug}/" class="after:absolute after:inset-0">${esc(latest.title)}</a></h2>
          </div>
          <div class="lg:col-span-4 lg:col-start-9">
            <p class="text-lg leading-relaxed text-offwhite/85">${esc(latest.excerpt)}</p>
            <span class="mt-5 inline-flex items-center gap-2 text-sm font-medium underline decoration-1 underline-offset-[6px]">Read the article <span class="transition-transform group-hover:translate-x-1" aria-hidden="true">&rarr;</span></span>
          </div>
        </article>`;

const between = (html, name, content) => html.replace(new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`), `$1\n${content}\n        $2`);
const source = readFileSync('blog.html', 'utf8');
const blogFor = (base) => between(between(source, 'featured', featured(base)), 'posts', rest.slice(0, PAGE).map((p) => row(p, base)).join('\n'))
  .replace(/(data-post-count>)[^<]*/, `$1${rest.length} articles`);
// Loaded as a script (not fetched) so the blog filters also work when the file is opened from disk
const list = JSON.stringify(rest.map((p) => ({ s: p.slug, t: p.title, d: p.date.slice(0, 10), c: p.category, y: p.type, e: p.excerpt }))).replace(/</g, '\\u003c');

writeFileSync('dist/blog.html', staticPageHead('blog.html', blogFor(''), { posts: rest }));
writeFileSync('dist/data/posts.js', `window.BRP_POSTS=${list};\n`);
// Root copy, so the blog also shows its articles when browsing the project folder (articles open from dist/)
writeFileSync('blog.html', blogFor('dist/'));
mkdirSync('data', { recursive: true });
writeFileSync('data/posts.js', `window.BRP_POST_BASE='dist/';window.BRP_POSTS=${list};\n`);

// ---------- Sitemap ----------
const today = new Date().toISOString().slice(0, 10);
const pages = indexablePages;
const urls = [
  ...pages.map((loc) => `<url><loc>${loc}</loc><lastmod>${loc.endsWith('/blog.html') ? posts[0].modified.slice(0, 10) : today}</lastmod></url>`),
  ...posts.map((p) => `<url><loc>${SITE}/${p.slug}/</loc><lastmod>${p.modified.slice(0, 10)}</lastmod></url>`),
];
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync('dist/.htaccess', htaccess(posts));

// ---------- Preview build (GitHub Pages) ----------
// SITE_PREVIEW=1 keeps search engines out of the preview copy; PAGES_BASE is the subpath (e.g. /BRP-new-page).
if (process.env.SITE_PREVIEW) {
  const base = (process.env.PAGES_BASE || '').replace(/\/$/, '');
  let n = 0;
  for (const f of readdirSync('dist', { recursive: true })) {
    if (!String(f).endsWith('.html')) continue;
    const file = `dist/${String(f).replace(/\\/g, '/')}`;
    const html = readFileSync(file, 'utf8');
    let out = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">');
    if (out === html && !/name="robots"/.test(html)) out = html.replace('</head>', '  <meta name="robots" content="noindex, nofollow">\n</head>');
    if (out !== html) { writeFileSync(file, out); n++; }
  }
  // 404.html uses root-absolute paths; on Pages the site lives under /<repo>/
  if (base) writeFileSync('dist/404.html', readFileSync('dist/404.html', 'utf8').replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`));
  writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
  rmSync('dist/.htaccess', { force: true });
  console.log(`Preview build: noindex on ${n} pages, base path "${base || '/'}"`);
}

console.log(`Built ${posts.length} posts + ${pages.length} pages into dist/`);
