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
        let res = await this.get('/ping', {
            testInfo,
            title: 'Health Check Ping (/ping)',
        });
        if (res.status() === 404) {
            // ws01dev.prowhats.com exposes root health check at /
            res = await this.get('/', {
                testInfo,
                title: 'Health Check Ping (/)',
            });
        }
        return res;
    }
}

module.exports = {
    SystemService,
};

