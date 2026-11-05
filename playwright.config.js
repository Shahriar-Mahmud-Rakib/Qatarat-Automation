// @ts-check
require('dotenv').config();
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 60000,
    retries: 0,
    workers: 2,
    maxFailures: 0,
    reporter: [
        ['list'],
        ['allure-playwright', {
            detail: true,
            outputFolder: 'allure-results',
            suiteTitle: false
        }],
        ['html', { open: 'never' }]
    ],
    use: {
        baseURL: process.env.API_BASE_URL || 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com',
        extraHTTPHeaders: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        screenshot: 'off',
        video: 'off',
        trace: 'off',
    },
});

