module.exports = {
  command: 'npx playwright test',
  targets: {
    default: {
      environment: 'Local',
      collections: ['saucedemo-auth'],
    },
  },
  filters: {
    urlPatterns: ['fonts.googleapis.com', 'fonts.gstatic.com', 'analytics', 'googletagmanager'],
    methods: ['OPTIONS'],
  },
};
