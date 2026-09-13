import { load } from 'cheerio';
import type { Extracted } from '../../shared/types';
import { normalizeUrl } from './security';
export function extract(html: string, url: string): Extracted {
  const $ = load(html);
  const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
  const resolve = (value?: string) => {
    try {
      return value ? normalizeUrl(value, url) : null;
    } catch {
      return null;
    }
  };
  const links = [
    ...new Set(
      $('a[href]')
        .toArray()
        .slice(0, 5000)
        .map((node) => resolve($(node).attr('href')))
        .filter((x): x is string => !!x),
    ),
  ];
  const images = $('img[src]')
    .toArray()
    .slice(0, 100)
    .flatMap((node) => {
      const src = resolve($(node).attr('src'));
      return src ? [{ url: src, alt: clean($(node).attr('alt') ?? '').slice(0, 500) }] : [];
    });
  const structuredData = $('script[type="application/ld+json"]')
    .toArray()
    .slice(0, 10)
    .flatMap((node) => {
      try {
        const text = $(node).text();
        return text.length <= 20000 ? [JSON.parse(text) as unknown] : [];
      } catch {
        return [];
      }
    });
  const title = clean($('title').first().text()).slice(0, 500);
  const description = clean($('meta[name="description"]').attr('content') ?? '').slice(0, 2000);
  const canonical = resolve($('link[rel="canonical"]').attr('href'));
  const language = $('html').attr('lang')?.slice(0, 30) ?? '';
  $('script,style,noscript,template,svg').remove();
  const headings = $('h1,h2,h3,h4,h5,h6')
    .toArray()
    .slice(0, 100)
    .map((node) => ({ level: node.tagName, text: clean($(node).text()).slice(0, 500) }));
  $('br').replaceWith(' ');
  $('p,div,li,section,h1,h2,h3,h4,h5,h6').append(' ');
  const text = clean(($('main').length ? $('main').first() : $('body')).text()).slice(0, 150000);
  return {
    title,
    description,
    headings,
    text,
    links,
    images,
    canonical,
    language,
    wordCount: text ? text.split(/\s+/u).length : 0,
    structuredData,
  };
}
export function sitemapLocations(xml: string): { pages: string[]; maps: string[] } {
  const $ = load(xml, { xmlMode: true });
  return {
    pages: $('urlset > url > loc')
      .toArray()
      .slice(0, 500)
      .map((node) => $(node).text().trim()),
    maps: $('sitemapindex > sitemap > loc')
      .toArray()
      .slice(0, 5)
      .map((node) => $(node).text().trim()),
  };
}
