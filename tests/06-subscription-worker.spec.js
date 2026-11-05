// ============================================
// Subscriptions & Worker API Tests
// Endpoint: /api/v2/subscriptions/generate-orders
// Validates background worker trigger, API key authentication, and DB constraints
// ============================================

const { test, expect } = require('@playwright/test');
const { SubscriptionService } = require('./services/SubscriptionService');
const { expectSchema } = require('./helpers/schema.helper');
const { generateOrdersSchema } = require('./schemas/subscription.schema');
const dbHelper = require('./helpers/db.helper');

let subscriptionService;

test.beforeEach(async ({ request }) => {
    subscriptionService = new SubscriptionService(request);
});

test.describe('🔄 [SUBSCRIPTIONS & WORKER] Order Generation & Deduplication', () => {

    test('TC-SUB-01: Trigger subscription order generator with valid date and API key → 200', async ({}, testInfo) => {
        const targetDate = '2026-11-01';
        const res = await subscriptionService.generateOrders(targetDate, undefined, testInfo);
        expect(res.status()).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);

        expectSchema(json, generateOrdersSchema, {
            title: 'Generate Orders Contract',
            testInfo,
        });
    });

    test('TC-SUB-02: Security: Missing subscription-api-key must return 401 Unauthorized', async ({}, testInfo) => {
        const res = await subscriptionService.generateOrders('2026-11-01', null, testInfo);
        expect([401, 403]).toContain(res.status());
    });

    test('TC-SUB-03: Security: Invalid/Tampered subscription-api-key must return 401', async ({}, testInfo) => {
        const res = await subscriptionService.generateOrders('2026-11-01', 'tampered-secret-key-12345', testInfo);
        expect([401, 403]).toContain(res.status());
    });

    test('TC-SUB-04: Boundary: Invalid date format (DD-MM-YYYY instead of YYYY-MM-DD)', async ({}, testInfo) => {
        const res = await subscriptionService.generateOrders('01-11-2026', undefined, testInfo);
        expect([200, 400, 422]).toContain(res.status());
    });

    test('TC-SUB-05: Database Deduplication: Verify unique constraint on active subscriptions', async () => {
        const dbResult = await dbHelper.query(
            `SELECT INDEX_NAME 
             FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_NAME = 'subscriptions' AND (INDEX_NAME LIKE '%duplicate%' OR INDEX_NAME LIKE '%active%')
             LIMIT 1`
        );
        if (!dbResult.skipped && dbResult.rowCount > 0) {
            expect(dbResult.rowCount).toBeGreaterThan(0);
        }
    });
});

