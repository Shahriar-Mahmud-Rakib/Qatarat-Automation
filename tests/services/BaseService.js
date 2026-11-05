// ============================================
// Base API Service (Service Object Model Pattern)
// Encapsulates HTTP client, URL construction, Headers & Allure attachments
// ============================================

const { BASE_URL, DEFAULT_HEADERS } = require('../helpers/auth.helper');
const { attachApiStep } = require('../helpers/allure.helper');

class BaseService {
    /**
     * @param {import('@playwright/test').APIRequestContext} request - Playwright API request context
     * @param {string|null} [token=null] - Bearer token if authenticated
     * @param {string} [baseUrl=BASE_URL] - Base API URL
     */
    constructor(request, token = null, baseUrl = BASE_URL) {
        this.request = request;
        this.token = token;
        this.baseUrl = baseUrl;
    }

    /**
     * Get default headers including auth if token is present
     * @param {Object} [customHeaders={}]
     */
    getHeaders(customHeaders = {}) {
        const headers = {
            ...DEFAULT_HEADERS,
            ...customHeaders,
        };
        if (this.token && !headers.Authorization && !headers.authorization) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }

    /**
     * Internal HTTP request execution with automatic Allure attachment
     */
    async executeRequest(method, endpoint, { data, params, headers, testInfo, title } = {}) {
        let url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        if (params) {
            const query = new URLSearchParams(params).toString();
            url += (url.includes('?') ? '&' : '?') + query;
        }

        const mergedHeaders = this.getHeaders(headers);
        const options = { headers: mergedHeaders };
        if (data !== undefined) {
            options.data = data;
        }

        const start = Date.now();
        let response;
        switch (method.toUpperCase()) {
            case 'GET':
                response = await this.request.get(url, options);
                break;
            case 'POST':
                response = await this.request.post(url, options);
                break;
            case 'PUT':
                response = await this.request.put(url, options);
                break;
            case 'PATCH':
                response = await this.request.patch(url, options);
                break;
            case 'DELETE':
                response = await this.request.delete(url, options);
                break;
            default:
                throw new Error(`Unsupported HTTP method: ${method}`);
        }
        const duration = Date.now() - start;

        // Rich Allure Attachment
        let responseBody = null;
        try {
            responseBody = await response.json();
        } catch (e) {
            responseBody = await response.text().catch(() => null);
        }

        if (testInfo) {
            await attachApiStep(testInfo, {
                title: title || `${method.toUpperCase()} ${endpoint}`,
                method,
                url,
                status: response.status(),
                headers: mergedHeaders,
                requestPayload: data,
                responseBody,
                duration,
            });
        }

        return response;
    }

    async get(endpoint, options = {}) {
        return this.executeRequest('GET', endpoint, options);
    }

    async post(endpoint, data, options = {}) {
        return this.executeRequest('POST', endpoint, { ...options, data });
    }

    async put(endpoint, data, options = {}) {
        return this.executeRequest('PUT', endpoint, { ...options, data });
    }

    async patch(endpoint, data, options = {}) {
        return this.executeRequest('PATCH', endpoint, { ...options, data });
    }

    async delete(endpoint, options = {}) {
        return this.executeRequest('DELETE', endpoint, options);
    }
}

module.exports = {
    BaseService,
};

