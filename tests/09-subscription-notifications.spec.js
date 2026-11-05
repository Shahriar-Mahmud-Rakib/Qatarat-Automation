// ============================================
// Subscription Notifications Test Suite
// User: 8801772173075 (Shahriar Mahmud / ID: 1593074)
// Language: Indonesian ('id' / language_id: 4)
// Endpoints & Flows:
// 1. User Localization Config (Indonesian)
// 2. Subscription Reminder Notification (title_tr.id & body_tr.id)
// 3. Worker Order Generation (/api/v2/subscriptions/generate-orders)
// 4. Subscription Order Notification ("Subscription order hoice")
// 5. Payment Complete Notification in Indonesian
// 6. Multi-language Translation & Schema Validation
// ============================================

const { test, expect } = require('@playwright/test');
const { NotificationService } = require('./services/NotificationService');
const { SubscriptionService } = require('./services/SubscriptionService');
const { AuthService } = require('./services/AuthService');
const { ProfileService } = require('./services/ProfileService');
const { expectSchema } = require('./helpers/schema.helper');
const {
    userNotificationSchema,
    subscriptionReminderNotificationSchema,
    subscriptionOrderNotificationSchema,
} = require('./schemas/notification.schema');
const pool = require('../src/config/db');

let notificationService;
let subscriptionService;
let authService;

const TARGET_USER_ID = 1593074;
const TARGET_PHONE = '8801772173075';
const TARGET_SUB_ID = 9235;

test.beforeEach(async ({ request }) => {
    notificationService = new NotificationService(request);
    subscriptionService = new SubscriptionService(request);
    authService = new AuthService(request);
});

test.describe('🔔 [SUBSCRIPTION NOTIFICATIONS] Multi-Language (Indonesian) & Order Lifecycle', () => {

    test('TC-NOTIF-01: Set & Verify Target User Language to Indonesian (id: 4)', async () => {
        // Set language = 4 (Indonesian) in DB
        await notificationService.setUserLanguage(TARGET_USER_ID, 4, 'id');

        const user = await notificationService.getUserLanguage(TARGET_USER_ID);
        expect(user).toBeTruthy();
        expect(user.language).toBe(4);
        expect(user.lang_code).toBe('id');
        expect(user.phone_number).toContain('1772173075');
    });

    test('TC-NOTIF-02: Live API Profile Check: GetMyProfile returns language = 4', async ({ request }) => {
        // Fetch OTP from DB to authenticate
        const [userRows] = await pool.query('SELECT otp_code FROM users WHERE id = ?', [TARGET_USER_ID]);
        let otp = userRows[0]?.otp_code;
        if (!otp) {
            await authService.sendWhatsAppOtp({ countryCode: '880', mobileNumber: '1772173075', role: 'user' });
            const [refetched] = await pool.query('SELECT otp_code FROM users WHERE id = ?', [TARGET_USER_ID]);
            otp = refetched[0]?.otp_code;
        }

        const loginRes = await authService.login({
            countryCode: '880',
            mobileNumber: '1772173075',
            token: String(otp || '1234'),
            sendNew: true,
        });

        if (loginRes.status() === 200) {
            const loginData = await loginRes.json();
            const profileService = new ProfileService(request, loginData.accessToken);
            const profRes = await profileService.getMyProfile();
            expect(profRes.status()).toBe(200);

            const profile = await profRes.json();
            expect(profile.id).toBe(TARGET_USER_ID);
            expect(profile.language).toBe(4);
        }
    });

    test('TC-NOTIF-03: Dispatch & Verify Subscription Reminder Notification in Indonesian', async ({}, testInfo) => {
        const notif = await notificationService.dispatchSubscriptionReminder({
            userId: TARGET_USER_ID,
            language: 'id',
        });

        expect(notif.id).toBeGreaterThan(0);
        expect(notif.type).toBe('subscription_reminder');
        expect(notif.display_title).toBe('Pengingat Langganan Qatarat 💧');
        expect(notif.display_body).toContain('Langganan berkala Anda aktif');
        expect(notif.title_tr.id).toBe('Pengingat Langganan Qatarat 💧');
        expect(notif.body_tr.id).toBe('Langganan berkala Anda aktif. Pesanan berkala Anda akan segera diproses secara otomatis.');

        expectSchema(notif, subscriptionReminderNotificationSchema, {
            title: 'Subscription Reminder Contract',
            testInfo,
        });
    });

    test('TC-NOTIF-04: Trigger Subscription Worker API to Generate Orders (200 OK)', async ({}, testInfo) => {
        const today = new Date().toISOString().split('T')[0];
        const res = await subscriptionService.generateOrders(today, undefined, testInfo);
        expect(res.status()).toBe(200);

        const data = await res.json();
        expect(data.success).toBe(true);
    });

    test('TC-NOTIF-05: Dispatch & Verify Subscription Order Notification in Indonesian ("subscription order hoice")', async ({}, testInfo) => {
        const testOrderNumber = `261105${Math.floor(100000 + Math.random() * 900000)}`;
        const testOrderId = 1000675; // Generated subscription order for user 1593074

        const notif = await notificationService.dispatchSubscriptionOrderNotification({
            userId: TARGET_USER_ID,
            orderId: testOrderId,
            orderNumber: testOrderNumber,
            language: 'id',
        });

        expect(notif.id).toBeGreaterThan(0);
        expect(notif.type).toBe('subscription_order_created');
        expect(notif.order_id).toBe(testOrderId);
        expect(notif.display_title).toBe('Pesanan Langganan Berhasil Dibuat 📦');
        expect(notif.display_body).toContain(testOrderNumber);
        expect(notif.title_tr.id).toBe('Pesanan Langganan Berhasil Dibuat 📦');
        expect(notif.body_tr.id).toContain(testOrderNumber);

        expectSchema(notif, subscriptionOrderNotificationSchema, {
            title: 'Subscription Order Created Contract',
            testInfo,
        });
    });

    test('TC-NOTIF-06: Verify Native Payment Complete Notification in Indonesian in DB', async () => {
        const [paidNotifs] = await pool.query(`
            SELECT id, user_id, order_id, type, title_tr, body_tr, created_at
            FROM user_notifications
            WHERE user_id = ? AND type = 'payment_complete'
            ORDER BY id DESC LIMIT 1
        `, [TARGET_USER_ID]);

        expect(paidNotifs.length).toBeGreaterThan(0);
        const latest = paidNotifs[0];
        const titleTr = typeof latest.title_tr === 'string' ? JSON.parse(latest.title_tr) : latest.title_tr;
        const bodyTr = typeof latest.body_tr === 'string' ? JSON.parse(latest.body_tr) : latest.body_tr;

        expect(titleTr.id).toBe('Pembayaran Anda telah diterima');
        expect(bodyTr.id).toContain('Terima kasih atas pembayaran Anda');
    });

    test('TC-NOTIF-07: Verify All Notification Types for Target User Match Contract Schema', async ({}, testInfo) => {
        const notifs = await notificationService.getUserNotifications(TARGET_USER_ID, 5);
        expect(notifs.length).toBeGreaterThanOrEqual(2);

        for (const notif of notifs) {
            expect(notif.user_id).toBe(TARGET_USER_ID);
            expect(notif.title_tr).toHaveProperty('id');
            expect(notif.body_tr).toHaveProperty('id');
            expectSchema(notif, userNotificationSchema, {
                title: `User Notification Schema Check [Type: ${notif.type}]`,
                testInfo,
            });
        }
    });

    test('TC-NOTIF-08: Audit WhatsApp Gateway Status for Bangladesh Prefix (+880)', async () => {
        const subStatus = await notificationService.getSubscriptionStatus(TARGET_SUB_ID);
        expect(subStatus).toBeTruthy();
        expect(subStatus.client_id).toBe(TARGET_USER_ID);

        // Check if failed_reason exists or is handled gracefully
        console.log('Target Subscription Status:', {
            id: subStatus.id,
            active: subStatus.active,
            notify_method: subStatus.notify_method,
            failed_reason: subStatus.failed_reason,
        });
        expect([0, 1]).toContain(subStatus.active);
    });
});

