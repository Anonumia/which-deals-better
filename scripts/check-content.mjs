import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve('dist');
const read = path => readFileSync(path, 'utf8');
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const pages = walk(root).filter(path => path.endsWith('.html'));
const expected = [
  '/guides/', '/guides/how-to-compare-unit-prices/', '/guides/bigger-vs-smaller-package/',
  '/guides/multipacks-bogo-multibuy/', '/guides/sale-price-vs-unit-price/', '/how-we-calculate/',
];
const adRoutes = new Set(['/', ...expected.filter(route => route !== '/guides/')]);
const home = read(join(root, 'index.html'));
const hasAds = home.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js');
const hasAnalytics = home.includes('www.googletagmanager.com/gtag/js');
const titles = new Set();
const descriptions = new Set();
const sitemap = read(join(root, 'sitemap-0.xml'));
for (const route of expected) {
  assert.ok(existsSync(join(root, route, 'index.html')), 'Missing page: ' + route);
  assert.ok(sitemap.includes('https://whichdealsbetter.com' + route + '</loc>'), 'Missing sitemap URL: ' + route);
}
for (const path of pages) {
  const html = read(path);
  const relative = path.slice(root.length).replaceAll('\\', '/');
  const route = relative === '/index.html' ? '/' : relative.replace(/index\.html$/, '');
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title && !titles.has(title), 'Missing/duplicate title: ' + route);
  assert.ok(description && !descriptions.has(description), 'Missing/duplicate description: ' + route);
  titles.add(title); descriptions.add(description);
  assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, 'H1 count: ' + route);
  assert.ok(html.includes('rel="canonical" href="https://whichdealsbetter.com' + (route === '/404.html' ? '/404' : route) + '"'), 'Canonical: ' + route);
  assert.equal(html.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'), hasAds && adRoutes.has(route), 'Ad policy: ' + route);
  assert.equal(html.includes('www.googletagmanager.com/gtag/js'), hasAnalytics, 'Analytics: ' + route);
  for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
    assert.ok(href && !href.startsWith('javascript:'), 'Invalid link: ' + route);
    const url = new URL(href, 'https://whichdealsbetter.com' + route);
    if (url.origin !== 'https://whichdealsbetter.com') continue;
    const target = join(root, decodeURIComponent(url.pathname), url.pathname.endsWith('/') ? 'index.html' : '');
    assert.ok(existsSync(target), 'Broken link from ' + route + ': ' + href);
    if (url.hash) assert.ok(read(target).includes('id="' + decodeURIComponent(url.hash.slice(1)) + '"'), 'Broken fragment: ' + href);
  }
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/)?.[1] || '';
  const text = main.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ');
  assert.ok(!/lorem ipsum|TODO|TBD|reading time|\d+ min read/i.test(text), 'Placeholder/reading label: ' + route);
  if (route.startsWith('/guides/') && route !== '/guides/') {
    console.log(route + ': approximately ' + text.trim().split(/\s+/).length + ' words');
  }
}
assert.ok(!/Disallow:\s*\/(?:guides|how-we-calculate)/i.test(read(join(root, 'robots.txt'))), 'Blocked content');
console.log('PASS: ' + pages.length + ' pages; unique metadata, H1s, canonicals, internal links, sitemap, ads (' + hasAds + '), and analytics (' + hasAnalytics + ').');

