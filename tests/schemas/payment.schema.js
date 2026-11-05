// ============================================
// Payment Gateway Schemas (AJV Contracts)
// ============================================

const initiatePaymentSchema = {
    type: 'object',
    properties: {
        success: { type: 'boolean' },
        payment_url: { type: 'string' },
        invoice_id: { type: ['string', 'integer'] },
    },
    additionalProperties: true,
};

module.exports = {
    initiatePaymentSchema,
};

