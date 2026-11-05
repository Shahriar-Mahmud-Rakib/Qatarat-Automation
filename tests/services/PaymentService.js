// ============================================
// Payment Gateways & Reconcile Service (Service Object Model)
// Endpoints: /api/v2/web-payments/initiate/myfatoorah
// ============================================

const { BaseService } = require('./BaseService');

class PaymentService extends BaseService {
    /**
     * Initiate payment session with MyFatoorah
     */
    async initiateMyFatoorah(payload, testInfo = null) {
        return this.post('/api/v2/web-payments/initiate/myfatoorah', payload, {
            testInfo,
            title: `Initiate MyFatoorah Payment (Cart: ${payload?.cart_id || 'N/A'})`,
        });
    }
}

module.exports = {
    PaymentService,
};

