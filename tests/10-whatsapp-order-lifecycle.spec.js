// ============================================
// WhatsApp Ordering & 1-Click Checkout Lifecycle Spec
// Endpoint: /api/whatsapp/order
// WebApp Direct Checkout: https://qatarat-stage.vercel.app/en/checkout?token=...
// ============================================

const { test, expect } = require('@playwright/test');
const { WhatsAppOrderService } = require('./services/WhatsAppOrderService');
const { expectSchema } = require('./helpers/schema.helper');
const {
    listPackagesResponseSchema,
    createDraftOrderResponseSchema,
} = require('./schemas/whatsapp-order.schema');
const pool = require('../src/config/db');

let waOrderService;

test.beforeEach(async ({ request }) => {
    waOrderService = new WhatsAppOrderService(request);
});

test.describe('📱 [WHATSAPP ORDERING] Chatbot Draft & 1-Click Checkout Links', () => {

    test('TC-WA-01: List available WhatsApp packages and validate schema contract → 200', async ({}, testInfo) => {
        const res = await waOrderService.listPackages({}, testInfo);
        expect(res.status()).toBe(200);

        const data = await res.json();
        expect(data.status).toBe(true);
        expect(data.action).toBe('list_packages');
        expect(data.data.length).toBeGreaterThanOrEqual(10);

        expectSchema(data, listPackagesResponseSchema, {
            title: 'WhatsApp List Packages Contract',
            testInfo,
        });
    });

    test('TC-WA-02: Create WhatsApp draft order for Mosques Water (50 Cartons) → 200', async ({}, testInfo) => {
        const res = await waOrderService.createDraftOrder({
            phone: '+8801772173075',
            path: 'mosques',
            service: 'water',
            quantity: 50,
            sessionId: `wa_test_${Date.now()}`,
        }, testInfo);

        expect(res.status()).toBe(200);
        const data = await res.json();

        expect(data.status).toBe(true);
        expect(data.action).toBe('create_draft');
        expect(data.order_summary.path).toBe('mosques');
        expect(data.order_summary.service).toBe('water');
        expect(data.order_summary.quantity).toBe(50);
        expect(data.order_summary.total_cost).toBeGreaterThan(0);
        expect(data.checkout_url).toContain('qatarat-stage.vercel.app');
        expect(data.checkout_url).toContain('token=');
        expect(data.checkout_url).toContain(`order_number=${data.order_number}`);

        expectSchema(data, createDraftOrderResponseSchema, {
            title: 'WhatsApp Create Draft Contract',
            testInfo,
        });
    });

    test('TC-WA-03: Create WhatsApp draft order for Grand Mosque Meals (100 Meals) → 200', async ({}, testInfo) => {
        const res = await waOrderService.createDraftOrder({
            phone: '+8801634319696',
            path: 'grand_mosque',
            service: 'meals',
            quantity: 100,
            sessionId: `wa_test_meals_${Date.now()}`,
        }, testInfo);

        expect(res.status()).toBe(200);
        const data = await res.json();

        expect(data.status).toBe(true);
        expect(data.order_summary.path).toBe('grand_mosque');
        expect(data.order_summary.service).toBe('meals');
        expect(data.order_summary.quantity).toBe(100);
        expect(data.checkout_url).toContain('qatarat-stage.vercel.app');
    });

    test('TC-WA-04: Verify 1-Click Checkout Token format & Auto-login claims', async ({}, testInfo) => {
        const res = await waOrderService.createDraftOrder({
            phone: '+8801772173075',
            path: 'mosques',
            service: 'water',
            quantity: 20,
        }, testInfo);

        const data = await res.json();
        const url = new URL(data.checkout_url);
        const token = url.searchParams.get('token');
        const orderNumber = url.searchParams.get('order_number');
        const uid = url.searchParams.get('uid');

        expect(token).toBeTruthy();
        expect(orderNumber).toBe(data.order_number);
        expect(uid).toBe(data.order_uid);

        // Decode JWT payload without signature verification
        const parts = token.split('.');
        expect(parts.length).toBe(3);
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));

        expect(payload.type).toBe('whatsapp_checkout');
        expect(payload.order_number).toBe(data.order_number);
        expect(payload.order_uid).toBe(data.order_uid);
        expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    test('TC-WA-05: Boundary & Validation: Invalid path must return 400 Bad Request', async ({}, testInfo) => {
        const res = await waOrderService.executeRequest('POST', '/api/whatsapp/order', {
            data: {
                action: 'create_draft',
                session_id: 'wa_test_validation_session',
                phone: '+8801772173075',
                path: 'invalid_destination',
                service: 'water',
                quantity: 10,
            },
            testInfo,
            title: 'Validation: Reject Invalid Path',
        });

        expect(res.status()).toBe(400);
        const json = await res.json();
        expect(json.status).toBe(false);
        expect(json.error_code).toBe('INVALID_PATH');
    });

    test('TC-WA-06: Database State: Verify draft order inserted into client_orders', async () => {
        const res = await waOrderService.createDraftOrder({
            phone: '+8801772173075',
            path: 'mosques',
            service: 'water',
            quantity: 10,
        });

        const data = await res.json();
        const [orders] = await pool.query(
            'SELECT id, number, uid, client_order_status, cost FROM client_orders WHERE id = ?',
            [data.draft_id]
        );

        expect(orders.length).toBe(1);
        expect(orders[0].number).toBe(data.order_number);
        expect(orders[0].uid).toBe(data.order_uid);
        expect(orders[0].client_order_status).toBe(1); // Draft / In Cart
        expect(Number(orders[0].cost)).toBe(Number(data.order_summary.total_cost));
    });
});
