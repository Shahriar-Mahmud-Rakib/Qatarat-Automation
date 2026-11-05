// ============================================
// Auth & Unique Phone Schemas (AJV Contracts)
// ============================================

const guestSessionSchema = {
    type: 'object',
    required: ['accessToken'],
    properties: {
        id: { type: ['integer', 'string', 'null'] },
        userName: { type: ['string', 'null'] },
        role: { type: 'string' },
        accessToken: { type: 'string', minLength: 10 },
        refreshToken: { type: ['string', 'null'] },
    },
    additionalProperties: true,
};

const loginResponseSchema = {
    type: 'object',
    required: ['accessToken'],
    properties: {
        id: { type: ['integer', 'string'] },
        userName: { type: ['string', 'null'] },
        role: { type: 'string' },
        accessToken: { type: 'string', minLength: 10 },
        refreshToken: { type: ['string', 'null'] },
    },
    additionalProperties: true,
};

module.exports = {
    guestSessionSchema,
    loginResponseSchema,
};

