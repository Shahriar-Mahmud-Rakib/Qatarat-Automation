// ============================================
// WhatsApp Order Service (Service Object Model)
// Endpoint: /api/whatsapp/order
// Provides WhatsApp Chatbot Ordering & Direct 1-Click Checkout Links
// ============================================

const { BaseService } = require('./BaseService');

class WhatsAppOrderService extends BaseService {
    /**
     * List all available packages for WhatsApp ordering
     * @param {Object} [filter={}] - Optional filter { path, service }
     * @param {import('@playwright/test').TestInfo} [testInfo]
     */
    async listPackages(filter = {}, testInfo = null) {
        return this.post('/api/whatsapp/order', {
            action: 'list_packages',
            ...filter,
        }, {
            testInfo,
            title: 'WhatsApp Ordering: List Available Packages',
        });
    }

    /**
     * Create a WhatsApp draft order with 1-click direct checkout link
     * @param {Object} options
     * @param {string} options.phone - Customer phone (+8801772173075 or +8801634319696)
     * @param {'mosques'|'grand_mosque'} options.path - Distribution destination
     * @param {'water'|'meals'} options.service - Service type
     * @param {number} options.quantity - Quantity (e.g. 5, 10, 20, 50, 100)
     * @param {string} [options.sessionId] - WhatsApp session identifier
     * @param {import('@playwright/test').TestInfo} [testInfo]
     */
    async createDraftOrder({ phone, path, service, quantity, sessionId = null }, testInfo = null) {
        const payload = {
            action: 'create_draft',
            session_id: sessionId || `wa_session_${Date.now()}`,
            phone,
            path,
            service,
            quantity: Number(quantity),
        };

        return this.post('/api/whatsapp/order', payload, {
            testInfo,
            title: `WhatsApp Ordering: Create Draft Order [${path} / ${service} / qty: ${quantity}]`,
        });
    }

    /**
     * Normalizes phone number to standard E.164 (+prefix) for WhatsApp API
     * @param {string} phone
     */
    normalizePhone(phone) {
        const clean = phone.replace(/[^\d+]/g, '');
        if (clean.startsWith('+')) return clean;
        if (clean.startsWith('00')) return `+${clean.substring(2)}`;
        if (clean.startsWith('01') && clean.length === 11) return `+88${clean}`; // Bangladesh default 01...
        if (clean.startsWith('880')) return `+${clean}`;
        if (clean.startsWith('966')) return `+${clean}`;
        if (clean.startsWith('05') && clean.length === 10) return `+966${clean.substring(1)}`; // Saudi default
        return `+${clean}`;
    }
}

module.exports = {
    WhatsAppOrderService,
};
