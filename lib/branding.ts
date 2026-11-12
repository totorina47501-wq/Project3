// Source unique de l'identité publique MentionCheck.
export const BRAND = {
  legalName: 'MentionCheckCorp',
  publicName: 'MentionCheck',
  tagline: "L'IA qui check vos mentions légales avant publication.",
  domain: 'mentioncheck.app',
  handles: {
    instagram: '@mentioncheck',
    tiktok: '@mentioncheck',
    linkedin: '@mentioncheck',
  },
  mia: {
    name: 'Mia',
    greeting:
      'Bonjour, je suis Mia. Collez-moi une publication, je vous dis en 3 secondes si elle est conforme.',
    signature: 'Mia — votre assistante MentionCheck',
  },
  colors: {
    primary: '#0F172A',
    accent: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  plans: {
    solo: { name: 'Solo', priceMonthlyEur: 9, socialAccounts: 3, checksMonthly: 30, rewritesMonthly: 5 },
    pro: { name: 'Pro', priceMonthlyEur: 19, fairUseChecksMonthly: 500 },
    studio: { name: 'Studio', priceMonthlyEur: 49, fairUseChecksMonthly: 2000 },
  },
} as const;
