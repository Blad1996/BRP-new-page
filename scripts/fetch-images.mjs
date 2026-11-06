// Downloads the WordPress images listed in content/images.json into assets/uploads/ (skips files already there).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const urls = JSON.parse(readFileSync('content/images.json', 'utf8'));
const target = (url) => 'assets/uploads/' + decodeURIComponent(url.split('/wp-content/uploads/')[1]);
const queue = urls.filter((u) => !existsSync(target(u)));
const failed = [];
let done = 0;

async function worker() {
  while (queue.length) {
    const url = queue.shift();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      mkdirSync(dirname(target(url)), { recursive: true });
      writeFileSync(target(url), Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      failed.push(`${url} (${e.message})`);
    }
    if (++done % 50 === 0) console.log(`${done} downloaded`);
  }
}

await Promise.all(Array.from({ length: 6 }, worker));
console.log(`Done. ${done - failed.length} saved, ${failed.length} failed.`);
if (failed.length) writeFileSync('content/images-failed.txt', failed.join('\n'));
