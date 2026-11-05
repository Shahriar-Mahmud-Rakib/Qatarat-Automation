// ============================================
// Subscription & Worker Schemas (AJV Contracts)
// ============================================

const generateOrdersSchema = {
    type: 'object',
    required: ['success', 'message'],
    properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
            type: ['object', 'null'],
            properties: {
                date: { type: 'string' },
                total_queued: { type: 'integer' },
                subscription_ids: { type: 'array' },
            },
        },
    },
    additionalProperties: true,
};

module.exports = {
    generateOrdersSchema,
};

