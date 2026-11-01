/**
 * Pre-defined Automation Templates & Dynamic Presets
 */

const TEMPLATES = {
  // 1. Same User - 50 Close Distribution Orders
  'same-user-50-close-dist': {
    name: 'same-user-50-close-dist',
    title: '50 Close Distribution Orders (Single User)',
    description: 'Generates 50 fresh Close Distribution orders under one single user session',
    type: 'orders',
    options: {
      count: 50,
      userMode: 'single',
      category: 'close-dist',
      executionMode: 'fast',
      cardType: 'myfatoorah'
    }
  },

  // 2. Multi User - 50 Close Distribution Orders
  'multi-user-50-close-dist': {
    name: 'multi-user-50-close-dist',
    title: '50 Close Distribution Orders (50 Distinct Users)',
    description: 'Generates 50 Close Distribution orders across 50 separate, unique users',
    type: 'orders',
    options: {
      count: 50,
      userMode: 'multi',
      category: 'close-dist',
      executionMode: 'fast',
      cardType: 'myfatoorah'
    }
  },

  // 3. Multi User - 50 Subscriptions Generation
  'multi-user-50-subscription': {
    name: 'multi-user-50-subscription',
    title: '50 Distinct Users Subscription Order Generation',
    description: 'Arms 50 distinct user subscriptions, triggers worker API, confirms payments, and asserts Close Dist placement',
    type: 'subscription',
    options: {
      count: 50,
      targetDate: '2026-09-28',
      filterCloseDistribution: true
    }
  },

  // 4. Same User - 10 Close Distribution Orders
  'same-user-10-close-dist': {
    name: 'same-user-10-close-dist',
    title: '10 Close Distribution Orders (Single User)',
    description: 'Generates 10 fresh Close Distribution orders under one single user session',
    type: 'orders',
    options: {
      count: 10,
      userMode: 'single',
      category: 'close-dist',
      executionMode: 'fast',
      cardType: 'myfatoorah'
    }
  },

  // 5. Multi User - 10 Close Distribution Orders
  'multi-user-10-close-dist': {
    name: 'multi-user-10-close-dist',
    title: '10 Close Distribution Orders (10 Distinct Users)',
    description: 'Generates 10 Close Distribution orders across 10 separate unique users',
    type: 'orders',
    options: {
      count: 10,
      userMode: 'multi',
      category: 'close-dist',
      executionMode: 'fast',
      cardType: 'myfatoorah'
    }
  },

  // 6. Multi User - 10 Subscriptions Generation
  'multi-user-10-subscription': {
    name: 'multi-user-10-subscription',
    title: '10 Distinct Users Subscription Order Generation',
    description: 'Arms 10 distinct user subscriptions, triggers worker API, and verifies Close Distribution + next cycle',
    type: 'subscription',
    options: {
      count: 10,
      targetDate: '2026-09-28',
      filterCloseDistribution: true
    }
  },

  // 7. Single Subscription #9216
  'single-subscription-9216': {
    name: 'single-subscription-9216',
    title: 'Single Subscription Test (#9216)',
    description: 'Runs worker cycle verification for standard test subscription #9216',
    type: 'subscription-single',
    options: {
      subscriptionId: 9216,
      targetDate: '2026-09-28'
    }
  }
};

function getTemplate(name) {
  return TEMPLATES[name] || null;
}

function listTemplates() {
  return Object.values(TEMPLATES);
}

module.exports = {
  TEMPLATES,
  getTemplate,
  listTemplates
};
