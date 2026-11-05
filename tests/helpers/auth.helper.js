// ============================================
// Auth & Token Management Helper - Qatarat API
// ============================================

const { QATARAT_DATA } = require('./test-data.helper');

const BASE_URL = process.env.API_BASE_URL || 'https://u3swc2lpah.execute-api.ap-southeast-5.amazonaws.com';

const DEFAULT_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

let cachedGuestToken = null;
let cachedUserToken = null;

/**
 * Get or create an anonymous guest token
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<string>}
 */
async function getGuestToken(request) {
    if (cachedGuestToken) return cachedGuestToken;

    const res = await request.post(`${BASE_URL}/api/v2/Accounts/AccessGuestUser`, {
        headers: DEFAULT_HEADERS,
    });
    
    if (res.ok()) {
        const json = await res.json().catch(() => ({}));
        cachedGuestToken = json.accessToken || json.data?.accessToken;
        return cachedGuestToken;
    }
    throw new Error(`Failed to obtain Guest token: HTTP ${res.status()}`);
}

/**
 * Get or create an authenticated user token via OTP Login
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<string>}
 */
async function getUserToken(request) {
    if (cachedUserToken) return cachedUserToken;

    // 1. Send OTP
    await request.post(`${BASE_URL}/api/v2/Accounts/SendWhatsAppOtp`, {
        headers: DEFAULT_HEADERS,
        data: QATARAT_DATA.DEFAULT_PHONE,
    }).catch(() => {});

    // 2. Login with token
    const res = await request.post(`${BASE_URL}/api/v2/Accounts/login`, {
        headers: DEFAULT_HEADERS,
        data: {
            countryCode: QATARAT_DATA.DEFAULT_PHONE.countryCode,
            mobileNumber: QATARAT_DATA.DEFAULT_PHONE.mobileNumber,
            token: QATARAT_DATA.VALID_OTP_DEFAULT,
            sendNew: true,
        },
    });

    if (res.ok()) {
        const json = await res.json().catch(() => ({}));
        cachedUserToken = json.accessToken || json.data?.accessToken;
        return cachedUserToken;
    }

    // Fallback to guest token if OTP bypass is disabled in this environment
    return getGuestToken(request);
}

module.exports = {
    BASE_URL,
    DEFAULT_HEADERS,
    getGuestToken,
    getUserToken,
};

