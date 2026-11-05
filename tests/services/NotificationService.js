// ============================================
// Notification Service (Service Object Model Pattern)
// Manages Subscription Reminders & Order Notifications in Indonesian ('id')
// ============================================

const { BaseService } = require('./BaseService');
const pool = require('../../src/config/db');

class NotificationService extends BaseService {
    /**
     * Set user language in database
     * @param {number} userId - User ID (e.g., 1593074)
     * @param {number} languageId - 4 for Indonesian
     * @param {string} langCode - 'id'
     */
    async setUserLanguage(userId, languageId = 4, langCode = 'id') {
        await pool.query('UPDATE users SET language = ? WHERE id = ?', [languageId, userId]);
        await pool.query('UPDATE user_default_settings SET lang_code = ? WHERE user_id = ?', [langCode, userId]);
        return { success: true, userId, languageId, langCode };
    }

    /**
     * Get user's current configured language
     * @param {number} userId
     */
    async getUserLanguage(userId) {
        const [rows] = await pool.query(`
            SELECT u.id, u.name, u.phone_number, u.language, l.code AS lang_code, l.name AS lang_name
            FROM users u
            LEFT JOIN languages l ON l.id = u.language
            WHERE u.id = ?
        `, [userId]);
        return rows[0] || null;
    }

    /**
     * Dispatch / insert Subscription Reminder notification in Indonesian
     * @param {Object} options
     * @param {number} options.userId
     * @param {string} [options.language='id']
     */
    async dispatchSubscriptionReminder({ userId, language = 'id' }) {
        const titleTr = {
            ar: 'تذكير اشتراك قطرات 💧',
            en: 'Qatarat Subscription Reminder 💧',
            id: 'Pengingat Langganan Qatarat 💧',
        };

        const bodyTr = {
            ar: 'اشتراكك الدوري نشط. سيتم معالجة وتجديد طلبك الدوري قريباً.',
            en: 'Your recurring subscription is active. Your upcoming order will be processed shortly.',
            id: 'Langganan berkala Anda aktif. Pesanan berkala Anda akan segera diproses secara otomatis.',
        };

        const [res] = await pool.query(`
            INSERT INTO user_notifications (
                user_id, active, type, title_tr, body_tr, created_at, updated_at
            ) VALUES (?, 1, 'subscription_reminder', ?, ?, NOW(), NOW())
        `, [
            userId,
            JSON.stringify(titleTr),
            JSON.stringify(bodyTr),
        ]);

        return {
            id: res.insertId,
            user_id: userId,
            type: 'subscription_reminder',
            title_tr: titleTr,
            body_tr: bodyTr,
            selected_language: language,
            display_title: titleTr[language] || titleTr.id,
            display_body: bodyTr[language] || bodyTr.id,
        };
    }

    /**
     * Dispatch / insert Subscription Order Created notification in Indonesian
     * @param {Object} options
     * @param {number} options.userId
     * @param {number} options.orderId
     * @param {string} options.orderNumber
     * @param {string} [options.language='id']
     */
    async dispatchSubscriptionOrderNotification({ userId, orderId, orderNumber, language = 'id' }) {
        const titleTr = {
            ar: 'تم إنشاء طلب الاشتراك 📦',
            en: 'Subscription Order Created 📦',
            id: 'Pesanan Langganan Berhasil Dibuat 📦',
        };

        const bodyTr = {
            ar: `تم إنشاء طلب اشتراكك رقم ${orderNumber} بنجاح وهو قيد المتابعة والتنفيذ.`,
            en: `Your recurring subscription order #${orderNumber} has been generated successfully.`,
            id: `Pesanan langganan Anda #${orderNumber} telah berhasil dibuat dan dijadwalkan.`,
        };

        const [res] = await pool.query(`
            INSERT INTO user_notifications (
                user_id, active, type, order_id, title_tr, body_tr, created_at, updated_at
            ) VALUES (?, 1, 'subscription_order_created', ?, ?, ?, NOW(), NOW())
        `, [
            userId,
            orderId,
            JSON.stringify(titleTr),
            JSON.stringify(bodyTr),
        ]);

        return {
            id: res.insertId,
            user_id: userId,
            order_id: orderId,
            type: 'subscription_order_created',
            title_tr: titleTr,
            body_tr: bodyTr,
            selected_language: language,
            display_title: titleTr[language] || titleTr.id,
            display_body: bodyTr[language] || bodyTr.id,
        };
    }

    /**
     * Query user_notifications from DB
     * @param {number} userId
     * @param {number} [limit=10]
     */
    async getUserNotifications(userId, limit = 10) {
        const [rows] = await pool.query(`
            SELECT id, user_id, order_id, type, title_tr, body_tr, active, created_at
            FROM user_notifications
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
        `, [userId, limit]);

        return rows.map(r => ({
            ...r,
            title_tr: typeof r.title_tr === 'string' ? JSON.parse(r.title_tr) : r.title_tr,
            body_tr: typeof r.body_tr === 'string' ? JSON.parse(r.body_tr) : r.body_tr,
        }));
    }

    /**
     * Get WhatsApp reminder status / failed reason for a subscription
     * @param {number} subscriptionId
     */
    async getSubscriptionStatus(subscriptionId) {
        const [rows] = await pool.query(`
            SELECT id, client_id, subscription_type, next_generate_date, active, notify_method, failed_reason
            FROM subscriptions
            WHERE id = ?
        `, [subscriptionId]);
        return rows[0] || null;
    }
}

module.exports = {
    NotificationService,
};

