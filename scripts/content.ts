import { readdirSync, readFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { load } from 'cheerio';
import type { Forest, Question, GalleryImage } from '../shared/types';
const forests: Forest[] = [];
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
for (const countryFolder of readdirSync('Country', { withFileTypes: true }).filter((file) =>
  file.isDirectory(),
)) {
  const country = countryFolder.name.replace(/ forests?/i, '');
  const base = join('Country', countryFolder.name);
  for (const folder of readdirSync(base, { withFileTypes: true }).filter((file) =>
    file.isDirectory(),
  )) {
    for (const file of readdirSync(join(base, folder.name)).filter((file) =>
      file.endsWith('.html'),
    )) {
      const path = join(base, folder.name, file);
      const $ = load(readFileSync(path, 'utf8'));
      const sections = $('.description')
        .toArray()
        .map((node) => ({
          title: clean($(node).find('.title').text()),
          text: clean($(node).find('.information').text()),
          image: $(node).find('img').attr('src')?.trim() ?? '',
        }))
        .filter((section) => section.text);
      const title = clean($('.maintitle').first().text() || $('title').text());
      forests.push({
        id: file
          .replace(/\.html$/, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-'),
        country,
        title,
        subtitle: clean($('.destitle').first().text()),
        image: sections[0]?.image ?? '',
        sections,
        legacyUrl: '/legacy/' + path.replace(/\\/g, '/'),
      });
    }
  }
}
const questions = runInNewContext(
  `${readFileSync('Quiz/questions.js', 'utf8')}\n; questions`,
  Object.create(null),
  { timeout: 1000 },
) as Question[];
// Clarify the comparison already made by the original quiz's answer options.
for (const question of questions)
  if (question.question === 'Which country has the highest percentage of forest cover?')
    question.question = 'Among these countries, which has the highest percentage of forest cover?';
const galleryDoc = load(readFileSync('Gallary/Gallary.html', 'utf8'));
const gallery: GalleryImage[] = galleryDoc('.slider-img')
  .toArray()
  .map((node, index) => ({
    id: String(index + 1),
    title: clean(
      galleryDoc(node).find('h1').first().text() || galleryDoc(node).find('h2').first().text(),
    ),
    url: galleryDoc(node).find('img').attr('src')?.trim() ?? '',
  }))
  .filter((image) => image.url && image.title);
mkdirSync('public/fonts', { recursive: true });
cpSync('parallex/fonts/raleway-regular.woff2', 'public/fonts/raleway-regular.woff2');
writeFileSync('public/library.json', JSON.stringify({ forests, questions, gallery }, null, 2));
console.log(
  `Preserved ${forests.length} forest articles and ${questions.length} quiz questions and ${gallery.length} gallery images.`,
);
