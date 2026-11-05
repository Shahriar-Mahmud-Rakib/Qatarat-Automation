// ============================================
// Auth & Unique Phone Service (Service Object Model)
// Endpoints: /api/v2/Accounts/AccessGuestUser, SendWhatsAppOtp, login
// ============================================

const { BaseService } = require('./BaseService');

class AuthService extends BaseService {
    /**
     * Create an anonymous guest user session
     */
    async accessGuestUser(testInfo = null) {
        return this.post('/api/v2/Accounts/AccessGuestUser', undefined, {
            testInfo,
            title: 'Generate Guest Session Token',
        });
    }

    /**
     * Send WhatsApp OTP (Role-Aware: user | driver | admin)
     */
    async sendWhatsAppOtp(payload, testInfo = null) {
        return this.post('/api/v2/Accounts/SendWhatsAppOtp', payload, {
            testInfo,
            title: `Dispatch WhatsApp OTP [Role: ${payload?.role || 'user'}]`,
        });
    }

    /**
     * Verify OTP and complete login
     */
    async login(payload, testInfo = null) {
        return this.post('/api/v2/Accounts/login', payload, {
            testInfo,
            title: `Verify OTP & User Login (${payload?.countryCode || ''}${payload?.mobileNumber || ''})`,
        });
    }

    /**
     * Admin Portal Auth Login
     */
    async adminLogin(payload, testInfo = null) {
        const adminUrl = 'https://stage-admin-api.qataratapp.com/admin/v2/auth/login';
        return this.post(adminUrl, payload, {
            testInfo,
            title: 'Admin Portal Login',
        });
    }
}

module.exports = {
    AuthService,
};

