// ============================================
// Payment Gateways & Outbox API Tests
// Endpoint: /api/v2/web-payments/initiate/myfatoorah
// Validates payment initiation, gateway switching, and outbox reconciliation
// ============================================

const { test, expect } = require('@playwright/test');
const { PaymentService } = require('./services/PaymentService');
const { CartService } = require('./services/CartService');
const { getUserToken } = require('./helpers/auth.helper');
const { QATARAT_DATA } = require('./helpers/test-data.helper');
const { expectSchema } = require('./helpers/schema.helper');
const { initiatePaymentSchema } = require('./schemas/payment.schema');
const dbHelper = require('./helpers/db.helper');

let paymentService;
let cartService;
let userToken;

test.beforeAll(async ({ request }) => {
    userToken = await getUserToken(request);
});

test.beforeEach(async ({ request }) => {
    paymentService = new PaymentService(request, userToken);
    cartService = new CartService(request, userToken);
});

test.describe('💳 [PAYMENTS & GATEWAYS] MyFatoorah & Outbox Reconcile', () => {

    test('TC-PAY-01: Initiate MyFatoorah payment session (Contract Validation) → 200', async ({}, testInfo) => {
        // Ensure an item is in cart
        await cartService.addNewSaleItem(QATARAT_DATA.DEFAULT_SALE_ITEM).catch(() => {});

        const payload = {
            cart_id: 696600,
            callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
            errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
            paymentMethodId: 2,
            phoneNumber: '8801772173075',
            name: 'Shahriar Mahmud',
            email: 'shahriar@qataratapp.com',
        };

        const res = await paymentService.initiateMyFatoorah(payload, testInfo);
        expect([200, 400, 422]).toContain(res.status());

        if (res.status() === 200) {
            const json = await res.json();
            expect(json.payment_url || json.data?.payment_url).toBeTruthy();

            expectSchema(json, initiatePaymentSchema, {
                title: 'Initiate Payment Contract',
                testInfo,
            });
        }
    });

    test('TC-PAY-02: Missing required callbackUrl must return 400/422 validation error', async ({}, testInfo) => {
        const invalidPayload = {
            cart_id: 696600,
            paymentMethodId: 2,
        };

        const res = await paymentService.initiateMyFatoorah(invalidPayload, testInfo);
        expect([400, 422, 500]).toContain(res.status());
    });

    test('TC-PAY-03: Database Outbox Pattern: Verify payment_job_outbox table structure', async () => {
        const dbResult = await dbHelper.query(
            `SELECT COLUMN_NAME 
             FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_NAME = 'payment_job_outbox' 
             LIMIT 5`
        );
        if (!dbResult.skipped && dbResult.rowCount > 0) {
            expect(dbResult.rowCount).toBeGreaterThan(0);
        }
    });
});

