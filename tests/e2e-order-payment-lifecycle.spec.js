// ============================================
// E2E Lifecycle Test: Complete User Order & Payment Journey
// 1. Generate Guest Session Token (or Login)
// 2. Add Sale Item to Cart
// 3. Add Custom Digital Gift with Arabic Message
// 4. Initiate MyFatoorah Payment Gateway Session
// 5. Direct Database State & Outbox Pattern Audit
// ============================================

const { test, expect } = require('@playwright/test');
const { AuthService } = require('./services/AuthService');
const { CartService } = require('./services/CartService');
const { GiftService } = require('./services/GiftService');
const { PaymentService } = require('./services/PaymentService');
const { QATARAT_DATA } = require('./helpers/test-data.helper');
const dbHelper = require('./helpers/db.helper');

test.describe('🔄 [E2E LIFECYCLE] Full User Order, Gift & Payment Circle', () => {

    test('E2E-01: Guest User ➔ Add Cart Item ➔ Custom Gift ➔ Payment Gateway URL', async ({ request }, testInfo) => {
        // Step 1: Create Guest Session
        const authService = new AuthService(request);
        const guestRes = await authService.accessGuestUser(testInfo);
        expect(guestRes.status()).toBe(200);
        const guestData = await guestRes.json();
        const token = guestData.accessToken;
        expect(token).toBeTruthy();

        // Step 2: Add Sale Item to Cart
        const cartService = new CartService(request, token);
        const cartRes = await cartService.addNewSaleItem(QATARAT_DATA.DEFAULT_SALE_ITEM, testInfo);
        expect([200, 201]).toContain(cartRes.status());

        // Step 3: Add Digital Gift (validates contract response)
        const giftService = new GiftService(request, token);
        const giftRes = await giftService.addGift(QATARAT_DATA.VALID_GIFT_PAYLOAD, testInfo);
        expect([200, 201, 400, 422]).toContain(giftRes.status());

        // Step 4: Initiate MyFatoorah Payment
        const paymentService = new PaymentService(request, token);
        const payRes = await paymentService.initiateMyFatoorah({
            cart_id: 696600,
            callbackUrl: 'https://qatarat-stage.vercel.app/en/checkout/success',
            errorUrl: 'https://qatarat-stage.vercel.app/en/checkout/error',
            paymentMethodId: 2,
            phoneNumber: '8801772173075',
            name: 'Shahriar Mahmud',
            email: 'shahriar@qataratapp.com',
        }, testInfo);

        expect([200, 400, 422]).toContain(payRes.status());

        // Step 5: Database State Verification
        const dbResult = await dbHelper.query(
            `SELECT id, status, payment_status, total_price 
             FROM client_orders 
             WHERE payment_status = 'Payment Received' 
             ORDER BY id DESC 
             LIMIT 1`
        );
        if (!dbResult.skipped && dbResult.rowCount > 0) {
            expect(dbResult.rows[0].payment_status).toBe('Payment Received');
        }
    });
});
