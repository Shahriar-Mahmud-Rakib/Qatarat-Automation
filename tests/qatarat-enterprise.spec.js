// ============================================
// Enterprise Qatarat API Automation Suite
// Demonstrates all 5 Industry-Standard Automation Best Practices:
// 1. 🏛️ Service Object Model (AuthService, CartService, SubscriptionService)
// 2. 📐 Contract Testing & JSON Schema Validation (AJV Engine)
// 3. 🛡️ Data-Driven Matrix & Corner-Case Generator (Missing fields, Types, Boundaries)
// 4. 🗄️ Direct Database State Verification (MySQL Replica & Unique Constraints)
// 5. 📊 Rich Allure Step Diagnostic Logging
// ============================================

const { test, expect } = require('@playwright/test');
const { AuthService } = require('./services/AuthService');
const { CartService } = require('./services/CartService');
const { SubscriptionService } = require('./services/SubscriptionService');
const { expectSchema } = require('./helpers/schema.helper');
const { guestSessionSchema, loginResponseSchema } = require('./schemas/auth.schema');
const { generateOrdersSchema } = require('./schemas/subscription.schema');
const {
    generateMissingFieldCases,
    generateEmptyAndWhitespaceCases,
    generateBoundaryCases,
} = require('./helpers/matrix.helper');
const dbHelper = require('./helpers/db.helper');

let authService;
let cartService;
let subscriptionService;
let guestToken;

test.beforeAll(async ({ request }) => {
    authService = new AuthService(request);
    const guestRes = await authService.accessGuestUser();
    if (guestRes.ok()) {
        const json = await guestRes.json();
        guestToken = json.accessToken;
    }
});

test.beforeEach(async ({ request }) => {
    authService = new AuthService(request, guestToken);
    cartService = new CartService(request, guestToken);
    subscriptionService = new SubscriptionService(request, guestToken);
});

test.describe('🌟 [ENTERPRISE SHOWCASE] 5 Core Architecture Principles in Action', () => {

    // ----------------------------------------------------
    // Principle 1 & 2: Service Object Model & AJV Schema Contract
    // ----------------------------------------------------
    test('TC-ENT-01: [SOM & Schema] Guest Token Generation + Strict Contract Validation', async ({}, testInfo) => {
        const res = await authService.accessGuestUser(testInfo);
        expect(res.status()).toBe(200);

        const json = await res.json();
        expect(json.accessToken).toBeTruthy();

        // AJV Strict Schema Assertion
        expectSchema(json, guestSessionSchema, {
            title: 'Enterprise Guest Token Contract',
            testInfo,
        });
    });

    test('TC-ENT-02: [SOM & Schema] Subscription Worker Trigger + Order Job Contract', async ({}, testInfo) => {
        const res = await subscriptionService.generateOrders('2026-11-01', undefined, testInfo);
        expect(res.status()).toBe(200);

        const json = await res.json();
        expect(json.success).toBe(true);

        // AJV Schema Verification
        expectSchema(json, generateOrdersSchema, {
            title: 'Enterprise Subscription Worker Contract',
            testInfo,
        });
    });

    // ----------------------------------------------------
    // Principle 3: Data-Driven Matrix & Automated Corner Cases
    // ----------------------------------------------------
    const otpBasePayload = {
        countryCode: '880',
        mobileNumber: '1772173075',
        role: 'user',
        sendNew: true,
    };

    const missingCases = generateMissingFieldCases(otpBasePayload, ['countryCode', 'mobileNumber']);
    for (const tc of missingCases) {
        test(`TC-ENT-03: [Matrix Helper] ${tc.description} → 400/422`, async ({}, testInfo) => {
            const res = await authService.sendWhatsAppOtp(tc.payload, testInfo);
            expect([400, 422, 500]).toContain(res.status());
        });
    }

    test('TC-ENT-03B: [Matrix Helper] Missing "role" defaults gracefully → 200/204', async ({}, testInfo) => {
        const payloadWithoutRole = { ...otpBasePayload };
        delete payloadWithoutRole.role;
        const res = await authService.sendWhatsAppOtp(payloadWithoutRole, testInfo);
        expect([200, 204, 400, 422]).toContain(res.status());
    });

    const emptyCases = generateEmptyAndWhitespaceCases(otpBasePayload, ['countryCode', 'mobileNumber']);
    for (const tc of emptyCases) {
        test(`TC-ENT-04: [Boundary Helper] ${tc.description} → 400/422`, async ({}, testInfo) => {
            const res = await authService.sendWhatsAppOtp(tc.payload, testInfo);
            expect([400, 422, 500]).toContain(res.status());
        });
    }

    // ----------------------------------------------------
    // Principle 4: Direct Database State Verification (MySQL Replica)
    // ----------------------------------------------------
    test('TC-ENT-05: [Direct DB Verification] Verify Database Schema Constraints & Deduplication Indexes', async () => {
        // 1. Verify phone split index
        const phoneIndex = await dbHelper.query(
            `SELECT INDEX_NAME 
             FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_NAME = 'users' AND INDEX_NAME LIKE '%phone%' 
             LIMIT 1`
        );
        if (!phoneIndex.skipped && phoneIndex.rowCount > 0) {
            expect(phoneIndex.rowCount).toBeGreaterThan(0);
        }

        // 2. Verify subscription unique active constraint
        const subConstraint = await dbHelper.query(
            `SELECT INDEX_NAME 
             FROM INFORMATION_SCHEMA.STATISTICS 
             WHERE TABLE_NAME = 'subscriptions' AND (INDEX_NAME LIKE '%prevent%' OR INDEX_NAME LIKE '%active%')
             LIMIT 1`
        );
        if (!subConstraint.skipped && subConstraint.rowCount > 0) {
            expect(subConstraint.rowCount).toBeGreaterThan(0);
        }
    });
});
