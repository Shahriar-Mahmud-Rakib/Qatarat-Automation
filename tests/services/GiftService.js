// ============================================
// Digital Gift Service (Service Object Model)
// Endpoint: /api/v2/latest-gift/Add
// ============================================

const { BaseService } = require('./BaseService');

class GiftService extends BaseService {
    /**
     * Add digital gift customization to active cart/order
     */
    async addGift(payload, testInfo = null) {
        return this.post('/api/v2/latest-gift/Add', payload, {
            testInfo,
            title: `Add Digital Gift (${payload?.receiver_name || 'Gift'})`,
        });
    }
}

module.exports = {
    GiftService,
};

