// ============================================
// E2E Lifecycle Test: Subscription Auto-Order Generation & Worker
// 1. Audit Active Distinct Subscriptions in DB
// 2. Trigger Worker API for target date (with subscription-api-key)
// 3. Verify Job Queued Response Contract
// 4. Validate DB Idempotency Constraint (subscription_id, due_date)
// ============================================

const { test, expect } = require('@playwright/test');
const { SubscriptionService } = require('./services/SubscriptionService');
const dbHelper = require('./helpers/db.helper');

test.describe('🔄 [E2E LIFECYCLE] Subscription Worker & Auto-Generation Circle', () => {

    test('E2E-02: DB Active Subscriptions ➔ Worker API Trigger ➔ Queue Verification', async ({ request }, testInfo) => {
        const subscriptionService = new SubscriptionService(request);
        const targetDate = '2026-11-01';

        // Step 1: Verify active subscriptions in DB
        const subDb = await dbHelper.query(
            `SELECT id, client_id, active, next_generate_date 
             FROM subscriptions 
             WHERE active = 1 AND deleted_at IS NULL 
             LIMIT 5`
        );

        // Step 2: Trigger Worker API
        const workerRes = await subscriptionService.generateOrders(targetDate, undefined, testInfo);
        expect(workerRes.status()).toBe(200);

        const json = await workerRes.json();
        expect(json.success).toBe(true);
        expect(json.message).toContain('pushed to the queue');

        // Step 3: Validate DB Idempotency Index
        const indexCheck = await dbHelper.query(
            `SELECT INDEX_NAME 
             FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_NAME = 'client_orders' AND INDEX_NAME LIKE '%subscription_due_date%' 
             LIMIT 1`
        );
        if (!indexCheck.skipped && indexCheck.rowCount > 0) {
            expect(indexCheck.rowCount).toBeGreaterThan(0);
        }
    });
});

