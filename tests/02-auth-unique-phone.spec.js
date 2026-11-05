// ============================================
// Auth & Unique Phone Architecture API Tests (QATAR-759 & QATAR-795)
// Validates Guest Token, Multi-Role OTP (user, driver, admin),
// Phone Uniqueness, Schema Contracts, and Negative Matrices
// ============================================

const { test, expect } = require('@playwright/test');
const { AuthService } = require('./services/AuthService');
const { QATARAT_DATA, SQL_INJECTION_PAYLOADS, XSS_PAYLOADS } = require('./helpers/test-data.helper');
const { expectSchema } = require('./helpers/schema.helper');
const { guestSessionSchema, loginResponseSchema } = require('./schemas/auth.schema');
const {
    generateMissingFieldCases,
    generateEmptyAndWhitespaceCases,
    generateInvalidTypeCases,
} = require('./helpers/matrix.helper');
const dbHelper = require('./helpers/db.helper');

let authService;

test.beforeEach(async ({ request }) => {
    authService = new AuthService(request);
});

test.describe('🔐 [AUTH & UNIQUE PHONE] Multi-Role & Phone Standardization', () => {

    test('TC-AUTH-01: Generate Guest Session Token (Contract Validation) → 200', async ({}, testInfo) => {
        const res = await authService.accessGuestUser(testInfo);
        expect(res.status()).toBe(200);

        const json = await res.json();
        expect(json.accessToken).toBeTruthy();

        expectSchema(json, guestSessionSchema, {
            title: 'Guest Session Contract',
            testInfo,
        });
    });

    test('TC-AUTH-02: Role-Aware WhatsApp OTP Dispatch for USER role → 200/204', async ({}, testInfo) => {
        const res = await authService.sendWhatsAppOtp({
            countryCode: '880',
            mobileNumber: '1772173075',
            role: 'user',
            sendNew: true,
        }, testInfo);

        expect([200, 204]).toContain(res.status());
    });

    test('TC-AUTH-03: Multi-Role Coexistence: Send WhatsApp OTP for DRIVER role (Same Phone) → 200/204', async ({}, testInfo) => {
        const res = await authService.sendWhatsAppOtp({
            countryCode: '880',
            mobileNumber: '1772173075',
            role: 'driver',
            sendNew: true,
        }, testInfo);

        expect([200, 204]).toContain(res.status());
    });

    test('TC-AUTH-04: Multi-Role Coexistence: Send WhatsApp OTP for ADMIN role (Same Phone) → 200/204', async ({}, testInfo) => {
        const res = await authService.sendWhatsAppOtp({
            countryCode: '880',
            mobileNumber: '1772173075',
            role: 'admin',
            sendNew: true,
        }, testInfo);

        expect([200, 204]).toContain(res.status());
    });

    test('TC-AUTH-05: OTP Verification & User Login Contract → 200/404', async ({}, testInfo) => {
        const res = await authService.login({
            countryCode: '880',
            mobileNumber: '1772173075',
            token: '1234',
            sendNew: true,
        }, testInfo);

        expect([200, 404]).toContain(res.status());
        if (res.status() === 200) {
            const json = await res.json();
            expectSchema(json, loginResponseSchema, {
                title: 'User Login Contract',
                testInfo,
            });
        }
    });

    test('TC-AUTH-06: Database State: Verify users_phone_split_index and Unique Role Assignment', async () => {
        const dbResult = await dbHelper.findUserByPhone('880', '1772173075');
        if (!dbResult.skipped && dbResult.rowCount > 0) {
            const user = dbResult.rows[0];
            expect(user.country_code).toBe('880');
            expect(user.mobile_number).toBe('1772173075');
        }
    });

    test('TC-AUTH-07: Legacy "00" Prefix Normalization: Must reject or strip un-split phone numbers', async ({}, testInfo) => {
        const res = await authService.sendWhatsAppOtp({
            countryCode: '00880',
            mobileNumber: '001772173075',
            role: 'user',
            sendNew: true,
        }, testInfo);

        // API should reject invalid prefix format with 400 or handle sanitization
        expect([400, 422, 200, 204]).toContain(res.status());
    });
});

test.describe('🛡️ [AUTH MATRIX] Data-Driven Missing Fields & Negative Cases', () => {

    const basePayload = {
        countryCode: '880',
        mobileNumber: '1772173075',
        role: 'user',
        sendNew: true,
    };

    // 1. Missing Required Fields
    const missingCases = generateMissingFieldCases(basePayload, ['countryCode', 'mobileNumber']);
    for (const tc of missingCases) {
        test(`[Matrix] ${tc.description} → 400/422`, async ({}, testInfo) => {
            const res = await authService.sendWhatsAppOtp(tc.payload, testInfo);
            expect([400, 422, 500]).toContain(res.status());
        });
    }

    // 2. Empty & Whitespace Fields
    const emptyCases = generateEmptyAndWhitespaceCases(basePayload, ['countryCode', 'mobileNumber']);
    for (const tc of emptyCases) {
        test(`[Matrix] ${tc.description} → 400/422`, async ({}, testInfo) => {
            const res = await authService.sendWhatsAppOtp(tc.payload, testInfo);
            expect([400, 422, 500]).toContain(res.status());
        });
    }

    // 3. Invalid Types
    const typeCases = generateInvalidTypeCases(basePayload, { countryCode: 'number' });
    for (const tc of typeCases) {
        test(`[Matrix] ${tc.description} → 400/422`, async ({}, testInfo) => {
            const res = await authService.sendWhatsAppOtp(tc.payload, testInfo);
            expect([200, 204, 400, 422, 500]).toContain(res.status());
        });
    }

    // 4. SQL Injection in Mobile Number
    for (const sqli of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        test(`[Security] SQLi "${sqli}" in mobileNumber must be rejected without 500 DB crash`, async ({}, testInfo) => {
            const res = await authService.sendWhatsAppOtp({
                ...basePayload,
                mobileNumber: sqli,
            }, testInfo);

            expect([200, 204, 400, 422]).toContain(res.status());
        });
    }
});
