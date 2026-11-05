// ============================================
// System & Gateway Health Service (Service Object Model)
// Endpoint: /ping
// ============================================

const { BaseService } = require('./BaseService');

class SystemService extends BaseService {
    /**
     * Check API gateway connection and server health
     */
    async ping(testInfo = null) {
        return this.get('/ping', {
            testInfo,
            title: 'Health Check Ping (/ping)',
        });
    }
}

module.exports = {
    SystemService,
};

