// ============================================
// Matrix & Corner-Case Data Generator Helper
// Automates generation of test cases for Required Fields, Boundary Values & Type Mismatches
// ============================================

const { BOUNDARY, INVALID_TYPES } = require('./test-data.helper');

/**
 * Generate test payloads missing one required field at a time
 * @param {Object} validBasePayload - A valid full payload
 * @param {string[]} requiredFields - List of required field keys
 * @returns {Array<{ field: string, payload: Object, description: string }>}
 */
function generateMissingFieldCases(validBasePayload, requiredFields = []) {
    return requiredFields.map(field => {
        const payload = { ...validBasePayload };
        delete payload[field];
        return {
            field,
            payload,
            description: `Missing required field: "${field}"`,
        };
    });
}

/**
 * Generate test payloads with empty / null / whitespace values
 * @param {Object} validBasePayload
 * @param {string[]} fieldsToTest
 * @returns {Array<{ field: string, type: string, payload: Object, description: string }>}
 */
function generateEmptyAndWhitespaceCases(validBasePayload, fieldsToTest = []) {
    const cases = [];
    for (const field of fieldsToTest) {
        // 1. Empty string
        cases.push({
            field,
            type: 'EMPTY_STRING',
            payload: { ...validBasePayload, [field]: BOUNDARY.EMPTY_STRING },
            description: `Empty string on field: "${field}"`,
        });

        // 2. Whitespace only
        cases.push({
            field,
            type: 'WHITESPACE_ONLY',
            payload: { ...validBasePayload, [field]: BOUNDARY.WHITESPACE_ONLY },
            description: `Whitespace-only on field: "${field}"`,
        });

        // 3. Null value
        cases.push({
            field,
            type: 'NULL_VALUE',
            payload: { ...validBasePayload, [field]: null },
            description: `Null value on field: "${field}"`,
        });
    }
    return cases;
}

/**
 * Generate test payloads with invalid data types for specified fields
 * @param {Object} validBasePayload
 * @param {Object<string, 'string'|'number'|'boolean'|'array'|'object'>} fieldTypeMap
 */
function generateInvalidTypeCases(validBasePayload, fieldTypeMap = {}) {
    const cases = [];
    for (const [field, expectedType] of Object.entries(fieldTypeMap)) {
        if (expectedType === 'string') {
            cases.push({
                field,
                value: INVALID_TYPES.NUMBER_AS_PHONE,
                payload: { ...validBasePayload, [field]: INVALID_TYPES.NUMBER_AS_PHONE },
                description: `Number instead of String on "${field}"`,
            });
            cases.push({
                field,
                value: INVALID_TYPES.ARRAY_AS_STRING,
                payload: { ...validBasePayload, [field]: INVALID_TYPES.ARRAY_AS_STRING },
                description: `Array instead of String on "${field}"`,
            });
            cases.push({
                field,
                value: INVALID_TYPES.OBJECT_AS_STRING,
                payload: { ...validBasePayload, [field]: INVALID_TYPES.OBJECT_AS_STRING },
                description: `Object instead of String on "${field}"`,
            });
        } else if (expectedType === 'number') {
            cases.push({
                field,
                value: 'invalid_number',
                payload: { ...validBasePayload, [field]: 'invalid_number' },
                description: `String instead of Number on "${field}"`,
            });
            cases.push({
                field,
                value: [1, 2, 3],
                payload: { ...validBasePayload, [field]: [1, 2, 3] },
                description: `Array instead of Number on "${field}"`,
            });
        }
    }
    return cases;
}

/**
 * Generate boundary test cases for strings or numbers
 */
function generateBoundaryCases(validBasePayload, field, type = 'string') {
    const cases = [];
    if (type === 'string') {
        cases.push({
            field,
            payload: { ...validBasePayload, [field]: BOUNDARY.MAX_STRING_1000 },
            description: `Extreme 1000 chars length on "${field}"`,
        });
        cases.push({
            field,
            payload: { ...validBasePayload, [field]: BOUNDARY.SPECIAL_CHARS },
            description: `Special characters injection on "${field}"`,
        });
        cases.push({
            field,
            payload: { ...validBasePayload, [field]: BOUNDARY.UNICODE_STRING },
            description: `Arabic Unicode characters on "${field}"`,
        });
    } else if (type === 'number') {
        cases.push({
            field,
            payload: { ...validBasePayload, [field]: BOUNDARY.NEGATIVE_NUMBER },
            description: `Negative value (-1) on "${field}"`,
        });
        cases.push({
            field,
            payload: { ...validBasePayload, [field]: BOUNDARY.ZERO },
            description: `Zero value on "${field}"`,
        });
        cases.push({
            field,
            payload: { ...validBasePayload, [field]: BOUNDARY.LARGE_NUMBER },
            description: `Extreme large number on "${field}"`,
        });
    }
    return cases;
}

module.exports = {
    generateMissingFieldCases,
    generateEmptyAndWhitespaceCases,
    generateInvalidTypeCases,
    generateBoundaryCases,
};

