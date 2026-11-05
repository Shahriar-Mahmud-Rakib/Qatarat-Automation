// ============================================
// Allure Diagnostic Step Logger Helper
// Attaches rich JSON request & response details to Playwright / Allure report
// ============================================

/**
 * Attach request and response details to testInfo for Allure reporting
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {Object} details
 */
async function attachApiStep(testInfo, details = {}) {
    if (!testInfo) return;

    const {
        title = 'API Step',
        method = 'GET',
        url = '',
        status = 200,
        headers = {},
        requestPayload = null,
        responseBody = null,
        duration = 0,
    } = details;

    const attachmentContent = {
        title,
        timestamp: new Date().toISOString(),
        request: {
            method: method.toUpperCase(),
            url,
            headers,
            payload: requestPayload,
        },
        response: {
            status,
            body: responseBody,
        },
        durationMs: duration,
    };

    try {
        await testInfo.attach(`📡 [HTTP ${status}] ${method.toUpperCase()} ${url.replace(/^https?:\/\/[^\/]+/, '')}`, {
            body: JSON.stringify(attachmentContent, null, 2),
            contentType: 'application/json',
        });
    } catch (e) {
        // Suppress attachment errors in headless non-testInfo contexts
    }
}

module.exports = {
    attachApiStep,
};

