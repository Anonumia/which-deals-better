import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mobileNavigation, moreNavigation, primaryNavigation } from '../src/config/navigation';

const header = readFileSync(new URL('../src/components/Header.astro', import.meta.url), 'utf8');
const expected = ['Compare', 'Coupons', 'Stock-Up', 'Usage', 'Guides', 'Methodology', 'About', 'Contact'];

describe('responsive navigation', () => {
  it('keeps the expected desktop destinations', () => expect([...primaryNavigation, ...moreNavigation].map((item) => item.label)).toEqual(expected));
  it('renders every destination directly in the mobile menu', () => expect(mobileNavigation.map((item) => item.label)).toEqual(expected));
  it('keeps Methodology, About, and Contact in desktop More', () => expect(moreNavigation.map((item) => item.label)).toEqual(['Methodology', 'About', 'Contact']));
  it('uses a real mobile button with connected expansion state', () => {
    expect(header).toMatch(/<button class="mobile-menu-toggle"[^>]+aria-expanded="false"[^>]+aria-controls="mobile-navigation"/);
    expect(header).toContain('id="mobile-navigation"');
  });
  it('uses a real desktop More button with connected expansion state', () => {
    expect(header).toMatch(/<button class="more-toggle"[^>]+aria-expanded="false"[^>]+aria-controls="desktop-more-menu"/);
    expect(header).toContain('id="desktop-more-menu"');
  });
  it('includes close behavior for Escape, outside click, and mobile link selection', () => {
    expect(header).toContain("event.key !== 'Escape'");
    expect(header).toContain("document.addEventListener('click'");
    expect(header).toContain("event.target.closest('a')");
  });
});
