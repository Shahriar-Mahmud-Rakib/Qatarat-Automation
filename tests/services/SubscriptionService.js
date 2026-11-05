// ============================================
// Subscriptions & Worker Service (Service Object Model)
// Endpoint: /api/v2/subscriptions/generate-orders
// ============================================

const { BaseService } = require('./BaseService');
const { QATARAT_DATA } = require('../helpers/test-data.helper');

class SubscriptionService extends BaseService {
    /**
     * Trigger background subscription orders generation worker
     * @param {string} [date] - Target generation date YYYY-MM-DD
     * @param {string} [apiKey] - subscription-api-key header
     * @param {import('@playwright/test').TestInfo} [testInfo]
     */
    async generateOrders(date = null, apiKey = QATARAT_DATA.SUBSCRIPTION_API_KEY, testInfo = null) {
        const params = date ? { date } : {};
        const headers = apiKey ? { 'subscription-api-key': apiKey } : {};

        return this.get('/api/v2/subscriptions/generate-orders', {
            params,
            headers,
            testInfo,
            title: `Trigger Subscription Worker [Date: ${date || 'Today'}]`,
        });
    }
}

module.exports = {
    SubscriptionService,
};

