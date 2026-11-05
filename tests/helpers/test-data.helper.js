// ============================================
// Shared Test Data Helper - Qatarat API Automation
// ============================================
// Security payloads, boundary values, invalid types, and test fixtures
// ============================================

// ---------- SQL Injection Payloads ----------
const SQL_INJECTION_PAYLOADS = [
    "' OR '1'='1",
    "' OR 1=1--",
    "'; DROP TABLE client_orders;--",
    "' UNION SELECT id,name FROM users--",
    "1' AND SLEEP(2)--",
    "admin'--",
    "' OR 'x'='x",
    "\" OR \"\"=\"",
    "1; SELECT * FROM information_schema.tables",
];

// ---------- XSS Payloads ----------
const XSS_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '"><script>alert(1)</script>',
    "javascript:alert('XSS')",
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}',
    '"><img src=x onerror=alert(document.cookie)>',
];

// ---------- Boundary Values ----------
const BOUNDARY = {
    EMPTY_STRING: '',
    SINGLE_CHAR: 'a',
    TWO_CHARS: 'ab',
    MAX_STRING_255: 'a'.repeat(255),
    MAX_STRING_1000: 'a'.repeat(1000),
    NEGATIVE_NUMBER: -1,
    ZERO: 0,
    LARGE_NUMBER: 999999999,
    FLOAT_NUMBER: 1.5,
    UNICODE_STRING: 'قطرات مكة المكرمة - سقيا الماء في المسجد الحرام',
    SPECIAL_CHARS: "!@#$%^&*()_+{}[]|:;\"'<>?,./`~",
    WHITESPACE_ONLY: '   ',
    NEWLINE_STRING: 'test\ninjection',
    NULL_BYTE: 'test\x00null',
};

// ---------- Invalid Data Types ----------
const INVALID_TYPES = {
    NUMBER_AS_PHONE: 1772173075,
    ARRAY_AS_STRING: ['test', 'array'],
    OBJECT_AS_STRING: { key: 'value' },
    BOOLEAN_AS_STRING: true,
    NULL_VALUE: null,
};

// ---------- Fake / Invalid Tokens ----------
const INVALID_TOKENS = {
    COMPLETELY_INVALID: 'invalid-token-xyz',
    MALFORMED_JWT: 'eyJhbGciOiJIUzI1NiJ9.invalid.payload',
    EMPTY: '',
    FAKE_JWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
              '.eyJzdWIiOiI5OTk5OTkiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0' +
              '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    SQL_INJECT: "' OR 1=1--",
    XSS: '<script>alert(1)</script>',
    NUMERIC: 123456,
    TOO_SHORT: 'abc',
    BEARER_MISSING: 'eyTokenWithoutBearer',
};

// ---------- Fake / Non-existent IDs ----------
const FAKE_IDS = {
    NON_EXISTENT: 999999999,
    NEGATIVE: -1,
    ZERO: 0,
    STRING_ID: 'abc',
    SQL: "1; DROP TABLE client_orders",
    XSS: '<script>alert(1)</script>',
};

// ---------- Qatarat Domain Specific Test Fixtures ----------
const QATARAT_DATA = {
    DEFAULT_PHONE: {
        countryCode: '880',
        mobileNumber: '1772173075',
        role: 'user',
        sendNew: true,
    },
    SAUDI_PHONE: {
        countryCode: '966',
        mobileNumber: '501234567',
        role: 'user',
        sendNew: true,
    },
    DRIVER_PHONE: {
        countryCode: '880',
        mobileNumber: '1772173075',
        role: 'driver',
        sendNew: true,
    },
    ADMIN_PHONE: {
        countryCode: '880',
        mobileNumber: '1772173075',
        role: 'admin',
        sendNew: true,
    },
    VALID_OTP_DEFAULT: '1234',
    DEFAULT_SALE_ITEM: {
        sale_item_id: 95,
        quantity: 1,
        home_icon_id: 3,
    },
    VALID_GIFT_PAYLOAD: {
        receiverName: 'Sara Mohammad',
        senderName: 'Ahmed',
        countryCode: '966',
        mobileNumber: '551234567',
        phoneNumber: '+966551234567',
        cart_id: 696600,
        category_id: 2,
        template_id: 10,
        message: 'هدية صدقة جارية - سقيا الماء',
    },
    SUBSCRIPTION_API_KEY: process.env.SUBSCRIPTION_API_KEY || 'qatarat-subscription-generate-api-key-dev',
};

module.exports = {
    SQL_INJECTION_PAYLOADS,
    XSS_PAYLOADS,
    BOUNDARY,
    INVALID_TYPES,
    INVALID_TOKENS,
    FAKE_IDS,
    QATARAT_DATA,
};
