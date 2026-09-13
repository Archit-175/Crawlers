import { mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const output = 'public/legacy';
mkdirSync(output, { recursive: true });
const files = [
  'Country',
  'Gallary',
  'Quiz',
  'parallex',
  'index.html',
  'body.css',
  'header.css',
  'loading.css',
  'loading.js',
  'map.js',
  'search-box.js',
  '1.svg',
  '2.svg',
  '3.svg',
  '4.svg',
  'icon.ico',
];
for (const file of files) cpSync(file, join(output, file), { recursive: true });
function rewrite(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) rewrite(path);
    else if (
      /\.(html|css|js)$/.test(entry.name) &&
      !path.includes('libs') &&
      !path.endsWith('jQuery.js')
    ) {
      let text = readFileSync(path, 'utf8');
      text = text.replace(
        /(["'(])\/(?!\/|api\/)(Country|country|Gallary|Quiz|parallex|index\.html|body\.css|header\.css|loading\.css|loading\.js|map\.js|search-box\.js|[1-4]\.svg|icon\.ico)/g,
        (_, quote, name) => `${quote}/legacy/${name === 'country' ? 'Country' : name}`,
      );
      if (entry.name.endsWith('.html'))
        text = text.replace(
          '</body>',
          '<a href="/" style="position:fixed;bottom:18px;right:18px;z-index:99999;padding:12px 18px;background:#c4ee84;color:#102719;border-radius:8px;font:600 14px system-ui">Open research workspace &#8599;</a></body>',
        );
      writeFileSync(path, text);
    }
  }
}
rewrite(output);
console.log('Original site copied to /legacy/; source files preserved.');
