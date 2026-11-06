// Usage: node scripts/import-wp.mjs <path-to-wordpress-export.xml>
// Writes content/posts.json, content/posts/<slug>.html, content/images.json and content/categories-review.csv.
// Category/type fixes go in content/overrides.csv (slug,category,type); they survive re-imports.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const SITE = 'https://bizrescuepro.com';
const src = process.argv[2];
if (!src) { console.error('Usage: node scripts/import-wp.mjs <export.xml>'); process.exit(1); }

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  isArray: (name) => ['item', 'category', 'wp:postmeta', 'wp:author'].includes(name),
});
const channel = parser.parse(readFileSync(src, 'utf8')).rss.channel;
const text = (v) => (v == null ? '' : typeof v === 'object' ? String(v['#text'] ?? '') : String(v));
// ISO 8601 in UTC for schema/meta; falls back to the local date if WordPress left the GMT field empty
const gmt = (utc, local) => {
  const u = text(utc);
  return u && !u.startsWith('0000') ? `${u.replace(' ', 'T')}Z` : text(local).replace(' ', 'T');
};

const authors = Object.fromEntries((channel['wp:author'] || []).map((a) => [text(a['wp:author_login']), text(a['wp:author_display_name'])]));
const attachments = new Map();
for (const it of channel.item) {
  if (text(it['wp:post_type']) === 'attachment') attachments.set(text(it['wp:post_id']), text(it['wp:attachment_url']));
}

// ---------- Classification ----------
const RULES = {
  security: ['secur', 'cyber', 'phish', 'ransomware', 'malware', 'virus', 'firewall', 'sonicwall', 'password', 'hack', 'breach', 'scam', 'fraud', 'mfa', 'two-factor', '2fa', 'authenticat', 'vpn', 'threat', 'attack', 'privacy', 'spam', 'network', 'wi-?fi', 'router'],
  backup: ['backup', 'back up', 'disaster', 'recovery', 'continuity', 'outage', 'data loss', 'restore', 'downtime', 'cloud storage', 'onedrive', 'dropbox', 'redundan'],
  email: ['e-?mail', 'outlook', 'microsoft 365', 'office 365', 'google workspace', 'gmail', 'teams', 'zoom', 'domain', 'communicat', 'voip', 'phone system', 'collaborat'],
  managed: ['managed', 'msp', 'outsourc', 'it support', 'help ?desk', 'recruit', 'hiring', 'staffing', 'jobs?\\b', 'career', 'executive search', 'talent', 'interview', 'resume', 'partner', 'consult', 'it services?', 'it compan', 'it provider', 'monitoring', 'vendor'],
};
// 'everyday' (Everyday IT) is the fallback when no rule scores at least 3.
const RX = Object.fromEntries(Object.entries(RULES).map(([k, words]) => [k, new RegExp(`\\b(?:${words.join('|')})`, 'gi')]));
const count = (rx, s) => (s.match(rx) || []).length;

function classify(title, terms, body) {
  let best = 'everyday', top = 2;
  for (const [key, rx] of Object.entries(RX)) {
    const score = count(rx, title) * 3 + count(rx, terms) * 2 + count(rx, body.slice(0, 3000));
    if (score > top) { top = score; best = key; }
  }
  return best;
}

const GUIDE = /\b(how to|how do|guide|step-by-step|steps|checklist|explained|what is|what are|introduction|beginner'?s?|complete|everything you need)\b/i;
function typeOf(title, oldCats) {
  if (GUIDE.test(title)) return 'guides';
  if (oldCats.includes('AI')) return 'news';
  return 'tips';
}

// ---------- Content cleanup ----------
const slugify = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/&#82(20|21);|&[lr]dquo;/g, '"').replace(/&#[0-9]+;|&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const images = new Set();

function localImage(url) {
  const m = url.match(/^https?:\/\/(?:www\.)?bizrescuepro\.com\/wp-content\/uploads\/(.+)$/);
  if (!m) return url;
  images.add(url);
  return `../assets/uploads/${m[1]}`;
}

function clean(html) {
  let out = html
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')
    .replace(/\s(?:style|srcset|sizes|data-[a-z-]+)="[^"]*"/gi, '')
    .replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, '<h2$1>$2</h2>')
    .replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/(src)="([^"]+)"/gi, (_, a, url) => `${a}="${localImage(url)}"`)
    .replace(/href="https?:\/\/(?:www\.)?bizrescuepro\.com\/([a-z0-9-]+)\/?"/gi, 'href="../$1/"')
    .replace(/<img(?![^>]*\bloading=)/gi, '<img loading="lazy"');

  const used = new Set();
  const toc = [];
  out = out.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (_, attrs = '', inner) => {
    const label = stripTags(inner);
    let id = (attrs.match(/\bid="([^"]+)"/) || [])[1] || slugify(label) || 'section';
    while (used.has(id)) id += '-x';
    used.add(id);
    toc.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: out.trim(), toc };
}

function excerptOf(html) {
  const first = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || html;
  const t = stripTags(first);
  if (t.length <= 170) return t;
  return t.slice(0, 170).replace(/\s+\S*$/, '') + '...';
}

// ---------- Overrides ----------
const overrides = {};
if (existsSync('content/overrides.csv')) {
  for (const line of readFileSync('content/overrides.csv', 'utf8').split(/\r?\n/).slice(1)) {
    const [slug, category, type] = line.split(',').map((s) => s.trim());
    if (slug) overrides[slug] = { category, type };
  }
}

// ---------- Import ----------
rmSync('content/posts', { recursive: true, force: true });
mkdirSync('content/posts', { recursive: true });

const posts = [];
for (const it of channel.item) {
  if (text(it['wp:post_type']) !== 'post' || text(it['wp:status']) !== 'publish') continue;
  const slug = decodeURIComponent(text(it['wp:post_name']));
  const title = text(it.title).trim();
  const cats = (it.category || []).filter((c) => c['@_domain'] === 'category').map(text);
  const tags = (it.category || []).filter((c) => c['@_domain'] === 'post_tag').map(text);
  const raw = text(it['content:encoded']);
  const { html, toc } = clean(raw);
  const plain = stripTags(html);
  const meta = Object.fromEntries((it['wp:postmeta'] || []).map((m) => [text(m['wp:meta_key']), text(m['wp:meta_value'])]));
  const thumb = attachments.get(meta._thumbnail_id);

  const o = overrides[slug] || {};
  posts.push({
    id: Number(text(it['wp:post_id'])),
    slug,
    title,
    date: text(it['wp:post_date']).replace(' ', 'T'),
    modified: text(it['wp:post_modified']).replace(' ', 'T'),
    publishedUtc: gmt(it['wp:post_date_gmt'], it['wp:post_date']),
    modifiedUtc: gmt(it['wp:post_modified_gmt'], it['wp:post_modified']),
    author: authors[text(it['dc:creator'])] || 'Biz Rescue Pro',
    category: o.category || classify(title, [...cats, ...tags].join(' '), plain),
    type: o.type || typeOf(title, cats),
    oldCategories: cats,
    tags,
    excerpt: excerptOf(html),
    readMins: Math.max(1, Math.round(plain.split(' ').length / 220)),
    image: thumb ? localImage(thumb) : null,
    toc,
  });
  writeFileSync(`content/posts/${slug}.html`, html);
}

posts.sort((a, b) => b.date.localeCompare(a.date));
writeFileSync('content/posts.json', JSON.stringify(posts, null, 1));
writeFileSync('content/images.json', JSON.stringify([...images].sort(), null, 1));

const csv = ['slug,category,type,title,old_categories'];
for (const p of posts) csv.push([p.slug, p.category, p.type, `"${p.title.replace(/"/g, '""')}"`, `"${p.oldCategories.join('; ')}"`].join(','));
writeFileSync('content/categories-review.csv', '﻿' + csv.join('\n'));

const tally = (k) => Object.entries(posts.reduce((m, p) => ((m[p[k]] = (m[p[k]] || 0) + 1), m), {})).map(([a, b]) => `${a}: ${b}`).join(', ');
console.log(`Imported ${posts.length} posts. Images referenced: ${images.size}`);
console.log(`Categories -> ${tally('category')}`);
console.log(`Types -> ${tally('type')}`);
