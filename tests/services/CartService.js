// ============================================
// Cart & Catalog Service (Service Object Model)
// Endpoints: /api/v2/carts/add-new-sale-item, get-my-cart-order
// ============================================

const { BaseService } = require('./BaseService');

class CartService extends BaseService {
    /**
     * Add a sale item to active cart
     */
    async addNewSaleItem(payload, testInfo = null) {
        return this.post('/api/v2/carts/add-new-sale-item', payload, {
            testInfo,
            title: `Add Item to Cart (Item: ${payload?.sale_item_id || 'N/A'}, Qty: ${payload?.quantity || 1})`,
        });
    }

    /**
     * Retrieve active cart details and items
     */
    async getMyCartOrder(testInfo = null) {
        return this.get('/api/v2/carts/get-my-cart-order', {
            testInfo,
            title: 'Fetch Active Cart Order',
        });
    }
}

module.exports = {
    CartService,
};

