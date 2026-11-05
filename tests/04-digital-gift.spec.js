// ============================================
// Digital Gift API Tests
// Endpoint: /api/v2/latest-gift/Add
// Validates gift recipient, custom message, XSS and SQL injection security
// ============================================

const { test, expect } = require('@playwright/test');
const { GiftService } = require('./services/GiftService');
const { getUserToken } = require('./helpers/auth.helper');
const { QATARAT_DATA, SQL_INJECTION_PAYLOADS, XSS_PAYLOADS } = require('./helpers/test-data.helper');

let giftService;
let userToken;

test.beforeAll(async ({ request }) => {
    userToken = await getUserToken(request);
});

test.beforeEach(async ({ request }) => {
    giftService = new GiftService(request, userToken);
});

test.describe('🎁 [DIGITAL GIFTS] Gift Customization & Security Vectors', () => {

    test('TC-GIFT-01: Add valid digital gift with Arabic message → 200/422', async ({}, testInfo) => {
        const payload = QATARAT_DATA.VALID_GIFT_PAYLOAD;
        const res = await giftService.addGift(payload, testInfo);
        expect([200, 201, 400, 422]).toContain(res.status());
    });

    test('TC-GIFT-02: Security: XSS payload in gift message must be sanitized/neutralized', async ({}, testInfo) => {
        for (const xss of XSS_PAYLOADS.slice(0, 3)) {
            const res = await giftService.addGift({
                ...QATARAT_DATA.VALID_GIFT_PAYLOAD,
                message: xss,
            }, testInfo);

            expect([200, 400, 422]).toContain(res.status());
            const text = await res.text();
            // Stored XSS check: script tags should never be executed
            expect(text).not.toContain('<script>alert');
        }
    });

    test('TC-GIFT-03: Security: SQL injection in receiverName must not crash backend', async ({}, testInfo) => {
        for (const sqli of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
            const res = await giftService.addGift({
                ...QATARAT_DATA.VALID_GIFT_PAYLOAD,
                receiverName: sqli,
            }, testInfo);

            expect([200, 400, 422]).toContain(res.status());
        }
    });
});
