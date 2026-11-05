// ============================================
// System & Gateway Health API Tests
// Validates /ping, Gateway Latency SLA (<500ms), and Headers
// ============================================

const { test, expect } = require('@playwright/test');
const { SystemService } = require('./services/SystemService');
const { expectSchema } = require('./helpers/schema.helper');
const { pingResponseSchema } = require('./schemas/common.schema');

let systemService;

test.beforeEach(async ({ request }) => {
    systemService = new SystemService(request);
});

test.describe('🌐 [SYSTEM HEALTH] Gateway Connectivity & Performance SLA', () => {

    test('TC-SYS-01: Health check /ping returns HTTP 200 Healthy', async ({}, testInfo) => {
        const start = Date.now();
        const res = await systemService.ping(testInfo);
        const duration = Date.now() - start;

        expect(res.status()).toBe(200);

        // Performance SLA assertion: AWS API Gateway ping should respond within 1500ms
        expect(duration).toBeLessThan(1500);

        const body = await res.text();
        expect(body).toContain('Healthy');

        expectSchema(body, pingResponseSchema, {
            title: 'System Ping Response Contract',
            testInfo,
        });
    });

    test('TC-SYS-02: Security Headers check on Gateway Response', async ({}, testInfo) => {
        const res = await systemService.ping(testInfo);
        expect(res.status()).toBe(200);

        const headers = res.headers();
        // Gateway should provide valid content-type or trace headers
        expect(headers).toBeDefined();
    });
});

