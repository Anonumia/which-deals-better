export const primaryNavigation = [
  { href: '/', label: 'Compare' },
  { href: '/coupon-comparator/', label: 'Coupons' },
  { href: '/stock-up-calculator/', label: 'Stock-Up' },
  { href: '/usage-tracker/', label: 'Usage' },
  { href: '/guides/', label: 'Guides' },
] as const;

export const moreNavigation = [
  { href: '/methodology/', label: 'Methodology' },
  { href: '/about/', label: 'About' },
  { href: '/contact/', label: 'Contact' },
] as const;

export const mobileNavigation = [...primaryNavigation, ...moreNavigation] as const;
