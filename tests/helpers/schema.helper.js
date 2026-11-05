// ============================================
// JSON Schema Validation Helper (AJV Engine)
// Provides compile, validate, and human-readable assertion with testInfo attachment
// ============================================

const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    strict: false,
});
addFormats(ajv);

/**
 * Validate data against a JSON schema
 * @param {Object} data - The actual response data (JSON)
 * @param {Object} schema - The expected JSON schema
 * @param {Object} [options]
 * @param {string} [options.title='Schema Validation'] - Step title
 * @param {import('@playwright/test').TestInfo} [options.testInfo] - Playwright testInfo for attachment
 * @returns {{ valid: boolean, errors: Array, formattedErrors: string }}
 */
function validateSchema(data, schema, options = {}) {
    const validate = ajv.compile(schema);
    const valid = validate(data);

    let formattedErrors = '';
    if (!valid && validate.errors) {
        formattedErrors = validate.errors
            .map(err => `• Path: "${err.instancePath || '/'}" -> ${err.message} (${JSON.stringify(err.params)})`)
            .join('\n');
    }

    if (options.testInfo) {
        options.testInfo.attach(`📐 [SCHEMA VALIDATION] ${options.title || 'Response Contract'}`, {
            body: JSON.stringify({
                status: valid ? 'PASSED' : 'FAILED',
                errors: validate.errors || null,
                validatedData: data,
            }, null, 2),
            contentType: 'application/json',
        });
    }

    return {
        valid,
        errors: validate.errors || [],
        formattedErrors,
    };
}

/**
 * Expect schema to be valid; throws detailed assertion error on mismatch
 */
function expectSchema(data, schema, options = {}) {
    const result = validateSchema(data, schema, options);
    if (!result.valid) {
        const msg = `❌ JSON Schema Validation Failed for ${options.title || 'Response'}:\n${result.formattedErrors}\n\nActual Data:\n${JSON.stringify(data, null, 2)}`;
        throw new Error(msg);
    }
    return true;
}

module.exports = {
    ajv,
    validateSchema,
    expectSchema,
};

