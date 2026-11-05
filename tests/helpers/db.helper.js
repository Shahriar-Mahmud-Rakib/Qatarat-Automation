// ============================================
// Database Verification Helper (MySQL / Qatarat Replica)
// Direct DB state queries, consistency checks & test audit
// ============================================

require('dotenv').config();
const pool = require('../../src/config/db');

/**
 * Execute a parameterized SQL query on Qatarat DB
 * @param {string} text - SQL Query text
 * @param {any[]} [params=[]] - Query parameters
 * @returns {Promise<{ rows: any[], rowCount: number, duration: number, skipped: boolean }>}
 */
async function query(text, params = []) {
    try {
        const start = Date.now();
        const [rows] = await pool.query(text, params);
        const duration = Date.now() - start;
        return {
            rows: Array.isArray(rows) ? rows : [rows],
            rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0,
            duration,
            skipped: false
        };
    } catch (err) {
        console.warn('⚠️ [DB Helper] Query warning/error:', err.message);
        return { rows: [], rowCount: 0, skipped: true, error: err.message };
    }
}

/**
 * Find user by phone countryCode and mobileNumber
 */
async function findUserByPhone(countryCode, mobileNumber) {
    return query(
        `SELECT id, name, country_code, mobile_number, deleted_at 
         FROM users 
         WHERE country_code = ? AND mobile_number = ? 
         LIMIT 1`,
        [countryCode, mobileNumber]
    );
}

/**
 * Check if a client has multiple active subscriptions (QATAR-759 Deduplication Rule)
 */
async function checkDuplicateActiveSubscriptions(clientId) {
    return query(
        `SELECT client_id, COUNT(*) as active_count
         FROM subscriptions
         WHERE client_id = ? AND active = 1 AND deleted_at IS NULL
         GROUP BY client_id`,
        [clientId]
    );
}

/**
 * Verify close distribution 5-point predicate for an order
 */
async function verifyCloseDistributionPredicate(orderId) {
    return query(
        `SELECT o.id, o.need_delivery, o.driver_id, o.payment_status, o.suborder_status, o.material_distribution_type
         FROM client_orders o
         WHERE o.id = ?
         LIMIT 1`,
        [orderId]
    );
}

/**
 * Close database pool gracefully
 */
async function closePool() {
    try {
        await pool.end();
    } catch (err) {}
}

module.exports = {
    pool,
    query,
    findUserByPhone,
    checkDuplicateActiveSubscriptions,
    verifyCloseDistributionPredicate,
    closePool,
};

