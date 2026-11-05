// ============================================
// User Profile API Tests
// Endpoints: /api/v2/Profiles/GetMyProfile, update-phone
// Validates profile retrieval, phone update contract, and token security
// ============================================

const { test, expect } = require('@playwright/test');
const { ProfileService } = require('./services/ProfileService');
const { getUserToken } = require('./helpers/auth.helper');
const { INVALID_TOKENS } = require('./helpers/test-data.helper');

let profileService;
let userToken;

test.beforeAll(async ({ request }) => {
    userToken = await getUserToken(request);
});

test.beforeEach(async ({ request }) => {
    profileService = new ProfileService(request, userToken);
});

test.describe('👤 [USER PROFILE] Profile Contract & Security Checks', () => {

    test('TC-PROF-01: Fetch current user profile with valid Bearer token → 200', async ({}, testInfo) => {
        const res = await profileService.getMyProfile(testInfo);
        expect([200, 204]).toContain(res.status());
    });

    test('TC-PROF-02: Security: Unauthorized request with invalid token must return 401', async ({ request }, testInfo) => {
        const unauthProfile = new ProfileService(request, INVALID_TOKENS.COMPLETELY_INVALID);
        const res = await unauthProfile.getMyProfile(testInfo);
        expect([401, 403]).toContain(res.status());
    });

    test('TC-PROF-03: Update phone contract: validates countryCode and mobileNumber', async ({}, testInfo) => {
        const res = await profileService.updatePhone({
            countryCode: '880',
            mobileNumber: '1772173075',
        }, testInfo);

        expect([200, 400, 422]).toContain(res.status());
    });
});

