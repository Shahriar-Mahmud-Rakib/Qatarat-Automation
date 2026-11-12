// ============================================
// WhatsApp Ordering Schemas (AJV Contracts)
// Endpoint: /api/whatsapp/order
// ============================================

const listPackagesResponseSchema = {
    type: 'object',
    required: ['status', 'action', 'total_packages', 'data'],
    properties: {
        status: { type: 'boolean', const: true },
        action: { type: 'string', const: 'list_packages' },
        total_packages: { type: 'integer', minimum: 1 },
        data: {
            type: 'array',
            items: {
                type: 'object',
                required: ['package_id', 'package_name_en', 'path', 'service', 'sale_item_id', 'quantity', 'price', 'currency'],
                properties: {
                    package_id: { type: 'integer' },
                    package_name_en: { type: 'string' },
                    package_name_ar: { type: 'string' },
                    path: { type: 'string', enum: ['mosques', 'grand_mosque'] },
                    service: { type: 'string', enum: ['water', 'meals'] },
                    sale_item_id: { type: 'integer' },
                    sale_item_name_en: { type: 'string' },
                    quantity: { type: 'integer' },
                    price: { type: 'number' },
                    currency: { type: 'string', const: 'SAR' },
                },
                additionalProperties: true,
            },
        },
    },
    additionalProperties: true,
};

const createDraftOrderResponseSchema = {
    type: 'object',
    required: [
        'status',
        'action',
        'session_id',
        'draft_id',
        'order_number',
        'order_uid',
        'checkout_url',
        'order_summary',
        'customer',
    ],
    properties: {
        status: { type: 'boolean', const: true },
        action: { type: 'string', const: 'create_draft' },
        is_new_draft: { type: 'boolean' },
        session_id: { type: 'string' },
        draft_id: { type: 'integer' },
        cart_id: { type: 'integer' },
        order_number: { type: 'string', minLength: 10 },
        order_uid: { type: 'string' },
        checkout_url: { type: 'string', format: 'uri' },
        checkout_token_expires_at: { type: 'string' },
        checkout_token_expires_in: { type: 'integer' },
        customer: {
            type: 'object',
            required: ['id', 'phone'],
            properties: {
                id: { type: 'integer' },
                phone: { type: 'string' },
                name: { type: ['string', 'null'] },
            },
        },
        order_summary: {
            type: 'object',
            required: ['path', 'service', 'quantity', 'unit_price', 'sub_total', 'total_cost', 'currency'],
            properties: {
                path: { type: 'string' },
                service: { type: 'string' },
                quantity: { type: 'integer' },
                unit_price: { type: 'number' },
                sub_total: { type: 'number' },
                tax: { type: 'number' },
                delivery_fee: { type: 'number' },
                total_cost: { type: 'number' },
                currency: { type: 'string', const: 'SAR' },
            },
        },
    },
    additionalProperties: true,
};

module.exports = {
    listPackagesResponseSchema,
    createDraftOrderResponseSchema,
};
