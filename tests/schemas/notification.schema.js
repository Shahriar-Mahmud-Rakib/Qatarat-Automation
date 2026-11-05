// ============================================
// Notification Schemas (AJV Contracts)
// Multi-language: Indonesian (id), Arabic (ar), English (en)
// ============================================

const multilingualTextSchema = {
    type: 'object',
    required: ['id'],
    properties: {
        ar: { type: 'string' },
        en: { type: 'string' },
        id: { type: 'string' },
    },
    additionalProperties: true,
};

const userNotificationSchema = {
    type: 'object',
    required: ['id', 'user_id', 'type', 'title_tr', 'body_tr'],
    properties: {
        id: { type: 'integer' },
        user_id: { type: 'integer' },
        type: { type: 'string' },
        order_id: { type: ['integer', 'null'] },
        title_tr: multilingualTextSchema,
        body_tr: multilingualTextSchema,
        active: { type: ['integer', 'boolean', 'null'] },
    },
    additionalProperties: true,
};

const subscriptionReminderNotificationSchema = {
    type: 'object',
    required: ['user_id', 'type', 'title_tr', 'body_tr'],
    properties: {
        user_id: { type: 'integer' },
        type: { type: 'string', const: 'subscription_reminder' },
        title_tr: multilingualTextSchema,
        body_tr: multilingualTextSchema,
    },
    additionalProperties: true,
};

const subscriptionOrderNotificationSchema = {
    type: 'object',
    required: ['user_id', 'type', 'order_id', 'title_tr', 'body_tr'],
    properties: {
        user_id: { type: 'integer' },
        type: { type: 'string', const: 'subscription_order_created' },
        order_id: { type: 'integer' },
        title_tr: multilingualTextSchema,
        body_tr: multilingualTextSchema,
    },
    additionalProperties: true,
};

module.exports = {
    multilingualTextSchema,
    userNotificationSchema,
    subscriptionReminderNotificationSchema,
    subscriptionOrderNotificationSchema,
};

