// ============================================
// Cart & Catalog API Tests
// Endpoints: /api/v2/carts/add-new-sale-item, get-my-cart-order
// Validates item addition, quantity boundaries, pricing, and contracts
// ============================================

const { test, expect } = require('@playwright/test');
const { CartService } = require('./services/CartService');
const { getGuestToken, getUserToken } = require('./helpers/auth.helper');
const { QATARAT_DATA } = require('./helpers/test-data.helper');
const { expectSchema } = require('./helpers/schema.helper');
const { cartAddResponseSchema, getMyCartOrderSchema } = require('./schemas/cart.schema');
const { generateBoundaryCases } = require('./helpers/matrix.helper');

let cartService;
let userToken;

test.beforeAll(async ({ request }) => {
    userToken = await getUserToken(request);
});

test.beforeEach(async ({ request }) => {
    cartService = new CartService(request, userToken);
});

test.describe('🛒 [CART & CATALOG] Cart Item Management & Boundaries', () => {

    test('TC-CART-01: Add item to active cart (Contract Validation) → 200', async ({}, testInfo) => {
        const payload = {
            sale_item_id: QATARAT_DATA.DEFAULT_SALE_ITEM.sale_item_id,
            quantity: 1,
            home_icon_id: QATARAT_DATA.DEFAULT_SALE_ITEM.home_icon_id,
        };

        const res = await cartService.addNewSaleItem(payload, testInfo);
        expect([200, 201]).toContain(res.status());

        const json = await res.json().catch(() => ({}));
        expectSchema(json, cartAddResponseSchema, {
            title: 'Add Cart Item Contract',
            testInfo,
        });
    });

    test('TC-CART-02: Retrieve active cart order details → 200', async ({}, testInfo) => {
        const res = await cartService.getMyCartOrder(testInfo);
        expect([200, 204]).toContain(res.status());

        if (res.status() === 200) {
            const json = await res.json();
            expectSchema(json, getMyCartOrderSchema, {
                title: 'Get My Cart Order Contract',
                testInfo,
            });
        }
    });

    test('TC-CART-03: Security: Unauthenticated cart request must return 401', async ({ request }, testInfo) => {
        const unauthCart = new CartService(request, null);
        const res = await unauthCart.getMyCartOrder(testInfo);
        expect([401, 403]).toContain(res.status());
    });

    // Boundary Test Cases on Quantity
    const boundaryCases = generateBoundaryCases({
        sale_item_id: 95,
        quantity: 1,
        home_icon_id: 3,
    }, 'quantity', 'number');

    for (const bc of boundaryCases) {
        test(`TC-CART-BVA: [Boundary] ${bc.description}`, async ({}, testInfo) => {
            const res = await cartService.addNewSaleItem(bc.payload, testInfo);
            // System should reject negative/zero/overflow or sanitize
            expect([200, 400, 422]).toContain(res.status());
        });
    }
});

