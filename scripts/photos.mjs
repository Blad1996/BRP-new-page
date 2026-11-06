// Converts the source JPGs in assets/img/ to WebP in assets/img/photos/<name>-800.webp and -1600.webp.
// To swap a photo, change its source file here and run `npm run photos`.
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const SRC = 'assets/img';
const OUT = 'assets/img/photos';
const WIDTHS = [800, 1600, 2400];

const PHOTOS = {
  'home-hero': 'smiling-man-using-laptop-in-chicken-farm-setting.jpg',
  'problem-slow': 'frustrated-man-working-at-desk-with-computer-2026-09-23-19-37-55-utc.jpg',
  'problem-backups': 'laptop-computer-with-stack-of-paperwork-on-desk-2026-09-23-20-21-54-utc.jpg',
  'problem-email': 'Farmer Holding Phone in Cowshed.jpg',
  'problem-network': 'network-switch-with-cables-connected-for-data-tran.jpg',
  'problem-access': 'farmer-shakes-hands-with-apple-orchard-owner.jpg',
  'problem-router': 'modern-shelf-with-tech-and-decorative-elements.jpg',
  'problem-wifi': 'ceiling-mounted-wireless-access-point-with-green.JPG',
  'problem-locked': 'laptop-on-table-with-login-screen-displayed.JPG',
  'problem-planning': 'woman-reviewing-documents-in-bright-kitchen.jpg',
  'services-hero': 'office-colleagues-collaborating-on-a-computer.jpg',
  'service-support': 'tech-professionals-repairing-and-troubleshooting.jpg',
  'service-email': 'professional-man-uses-smartphone-at-his-desk.jpg',
  'service-security': 'Workplace Laptop with Paperwork and Folders.jpg',
  'service-backup': 'close-up-of-connecting-an-external-hard-drive-to.jpg',
  'service-monitoring': 'business-meeting-in-office-with-charts-and-laptop.jpg',
  'service-managed': 'business-professionals-discussing-documents.jpg',
  'about-hero': 'man-repairing-computer-with-laptop-in-office.jpg',
  'about-farm': 'technology-is-a-great-asset-W7UML2Y.jpg',
  'about-greenhouse': 'agronomist-inspecting-plant-growth-using-tablet.jpg',
  'about-distributor': 'box-computer-and-logistics-with-man-in-distributio.jpg',
  'about-office': 'colleagues-working-with-laptop-at-office-6767X2S.jpg',
};

mkdirSync(OUT, { recursive: true });
for (const [name, file] of Object.entries(PHOTOS)) {
  for (const w of WIDTHS) {
    const out = `${OUT}/${name}-${w}.webp`;
    if (existsSync(out) && !process.argv.includes('--force')) continue;
    await sharp(`${SRC}/${file}`).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 82, smartSubsample: true, effort: 5 }).toFile(out);
  }
  console.log(`${name} <- ${file}`);
}

// Default social sharing image (Open Graph / Twitter), 1200x630 JPG for the widest support
mkdirSync('assets/img/og', { recursive: true });
await sharp(`${OUT}/home-hero-2400.webp`).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 84, mozjpeg: true }).toFile('assets/img/og/og-default.jpg');
console.log('og-default.jpg');

// Icons from the brand SVGs: PNG favicon, Apple touch icon, and a square logo for schema.org (Google)
if (existsSync(`${SRC}/favicon.svg`)) {
  const icon = (size, bg) => {
    const img = sharp(`${SRC}/favicon.svg`, { density: 600 }).resize(size, size, { fit: 'contain', background: bg });
    return (bg.alpha === 0 ? img : img.flatten({ background: bg })).png();
  };
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  const white = { r: 255, g: 255, b: 255, alpha: 1 };
  await icon(32, clear).toFile(`${SRC}/favicon-32.png`);
  await sharp(`${SRC}/favicon.svg`, { density: 600 }).resize(140, 140, { fit: 'contain', background: white })
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: white }).flatten({ background: white }).png().toFile(`${SRC}/apple-touch-icon.png`);
  await icon(512, white).toFile(`${SRC}/logo-square.png`);
  console.log('favicon-32.png, apple-touch-icon.png, logo-square.png');
} else {
  console.log(`Missing ${SRC}/favicon.svg: icons not generated`);
}
