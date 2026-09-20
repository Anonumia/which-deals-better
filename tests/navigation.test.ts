import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { moreNavigation, primaryNavigation } from '../src/config/navigation';

const header = readFileSync(new URL('../src/components/Header.astro', import.meta.url), 'utf8');

describe('responsive navigation', () => {
  it('renders exactly Compare, Stock-Up, Coupons, and More at the top level', () => expect(primaryNavigation.map((item) => item.label)).toEqual(['Compare', 'Stock-Up', 'Coupons']));
  it('places every remaining destination under More', () => expect(moreNavigation.map((item) => item.label)).toEqual(['Usage', 'Guides', 'Shopping Examples', 'Methodology', 'About', 'Contact']));
  it('does not use a hamburger or separate mobile navigation', () => {
    expect(header).not.toContain('mobile-menu-toggle');
    expect(header).not.toContain('mobile-navigation');
  });
  it('uses a real More button with connected expansion state', () => {
    expect(header).toMatch(/<button class="more-toggle"[^>]+aria-expanded="false"[^>]+aria-controls="more-menu"/);
    expect(header).toContain('id="more-menu"');
  });
  it('includes close behavior for Escape, outside click, and link selection', () => {
    expect(header).toContain("event.key !== 'Escape'");
    expect(header).toContain("document.addEventListener('click'");
    expect(header).toContain("event.target.closest('a')");
  });
});
