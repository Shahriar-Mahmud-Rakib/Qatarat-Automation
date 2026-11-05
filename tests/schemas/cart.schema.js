// ============================================
// Cart & Catalog Schemas (AJV Contracts)
// ============================================

const cartAddResponseSchema = {
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        message: { type: ['string', 'null'] },
        data: { type: ['object', 'array', 'null'] },
    },
    additionalProperties: true,
};

const getMyCartOrderSchema = {
    type: 'object',
    properties: {
        id: { type: ['integer', 'string'] },
        status: { type: ['string', 'integer'] },
        total_price: { type: ['number', 'string'] },
        items: { type: 'array' },
    },
    additionalProperties: true,
};

module.exports = {
    cartAddResponseSchema,
    getMyCartOrderSchema,
};

