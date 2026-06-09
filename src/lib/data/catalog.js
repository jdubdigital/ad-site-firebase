export const sizes = ['300x250', '728x90', '160x600', '300x600', '970x250', '468x60'];

export const categories = [
  'Retail',
  'Finance',
  'Entertainment',
  'Hospitality',
  'SaaS',
  'Travel',
  'Food & Beverage',
  'Automotive',
  'Healthcare',
  'Beauty',
  'Fashion',
  'Gaming',
  'Casino',
  'Sports',
  'Education',
  'Real Estate',
  'Insurance',
  'Telecom',
  'Technology',
  'Consumer Goods',
  'Luxury',
  'Events',
  'Nonprofit',
  'Government',
  'Energy',
  'Fitness',
  'Home & Garden',
  'Parenting',
  'B2B',
  'Recruiting',
  'Streaming',
  'Music',
  'Movies',
  'Restaurants',
  'CPG',
  'Pharma',
  'Apparel',
  'Other'
];

export const primaryCategories = categories.slice(0, 8);
export const extraCategories = categories.slice(8);

export const mediums = ['Web', 'Social', 'Digital', 'Email', 'Billboard', 'Print', 'In-App', 'Other'];

export const adTypes = [
  { value: 'image', label: 'Image' },
  { value: 'gif', label: 'GIF' },
  { value: 'video', label: 'Video' },
  { value: 'html5', label: 'HTML5 ZIP' }
];

export const users = [
  {
    slug: 'northstar-creative',
    name: 'Northstar Creative',
    type: 'Agency',
    location: 'New York, NY',
    specialty: 'Retail campaigns',
    description:
      'An independent creative shop focused on high-converting retail campaigns, seasonal promotions, and polished display systems.'
  },
  {
    slug: 'mohegan-sun',
    name: 'Mohegan Sun',
    type: 'Brand',
    location: 'Uncasville, CT',
    specialty: 'Entertainment and hospitality',
    description:
      'A destination brand sharing display creative for entertainment, dining, hospitality, and event-driven campaigns.'
  },
  {
    slug: 'pixel-lane-studio',
    name: 'Pixel Lane Studio',
    type: 'Agency',
    location: 'Austin, TX',
    specialty: 'Motion banners',
    description:
      'A boutique studio specializing in animated HTML5 concepts, paid social adaptations, and modular banner systems.'
  },
  {
    slug: 'avery-chen',
    name: 'Avery Chen',
    type: 'Individual',
    location: 'Seattle, WA',
    specialty: 'Freelance art direction',
    description:
      'A freelance art director sharing selected concepts, experimental layouts, and personal ad studies.'
  },
  {
    slug: 'brightbank',
    name: 'BrightBank',
    type: 'Brand',
    location: 'Chicago, IL',
    specialty: 'Financial services',
    description:
      'A financial services brand posting transparent examples of trust-led acquisition and product education ads.'
  },
  {
    slug: 'slate-signal',
    name: 'Slate & Signal',
    type: 'Agency',
    location: 'Los Angeles, CA',
    specialty: 'Performance creative',
    description:
      'A performance creative agency building compact, testable display ads for finance, ecommerce, and subscription brands.'
  }
];

export const defaultDashboardProfile = {
  name: 'New User',
  type: 'Individual',
  email: 'you@example.com',
  description: 'Add a short public profile summary for your creative work and shared ads.',
  avatarUrl: '',
  userSlug: 'new-user'
};

export function createMockAds() {
  const types = ['image', 'gif', 'video'];

  return Array.from({ length: 40 }, (_, index) => {
    const user = users[index % users.length];

    return {
      id: index + 1,
      title: `Ad #${index + 1}`,
      category: categories[index % categories.length],
      medium: mediums[index % mediums.length],
      tags: index % 3 === 0 ? 'Animated' : 'Static',
      size: sizes[index % sizes.length],
      userSlug: user.slug,
      userName: user.name,
      userType: user.type,
      likes: (index * 7) % 40,
      liked: false,
      type: types[index % types.length],
      submittedAt: new Date(Date.UTC(2025, 0, index + 1)).toISOString()
    };
  });
}
