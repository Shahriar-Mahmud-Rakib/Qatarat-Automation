// ============================================
// User Profile Service (Service Object Model)
// Endpoints: /api/v2/Profiles/GetMyProfile, update-phone
// ============================================

const { BaseService } = require('./BaseService');

class ProfileService extends BaseService {
    /**
     * Retrieve authenticated client profile details
     */
    async getMyProfile(testInfo = null) {
        return this.get('/api/v2/Profiles/GetMyProfile', {
            testInfo,
            title: 'Fetch Current User Profile',
        });
    }

    /**
     * Update client registered phone number
     */
    async updatePhone(payload, testInfo = null) {
        return this.post('/api/v2/Profiles/update-phone', payload, {
            testInfo,
            title: 'Update Client Phone Number',
        });
    }
}

module.exports = {
    ProfileService,
};

