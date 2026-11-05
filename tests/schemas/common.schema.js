// ============================================
// Common API JSON Schemas (AJV Contract Testing)
// ============================================

const standardErrorSchema = {
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        message: { type: ['string', 'null'] },
        errors: { type: ['array', 'object', 'null'] },
    },
    additionalProperties: true,
};

const pingResponseSchema = {
    type: ['string', 'object'],
};

module.exports = {
    standardErrorSchema,
    pingResponseSchema,
};

