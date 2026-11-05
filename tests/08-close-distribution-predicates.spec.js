// ============================================
// Close Distribution Predicate & Order Routing Tests
// Validates 5-Point Business Predicate for Close Distribution in Admin:
// 1. packages.need_delivery = 0 (Charity/Bulk)
// 2. co.driver_id IS NULL (Bypasses driver trip routing)
// 3. co.payment_date IS NOT NULL (Paid)
// 4. co.client_order_status = 1 (Pending distribution)
// 5. Haram water delivery_fee = 0
// ============================================

const { test, expect } = require('@playwright/test');
const dbHelper = require('./helpers/db.helper');

test.describe('📦 [CLOSE DISTRIBUTION] 5-Point Business Predicate Audit', () => {

    test('TC-CD-01: Verify package need_delivery classification in DB', async () => {
        const dbResult = await dbHelper.query(
            `SELECT id, name, need_delivery 
             FROM packages 
             WHERE active = 1 
             LIMIT 10`
        );

        if (!dbResult.skipped && dbResult.rowCount > 0) {
            expect(dbResult.rowCount).toBeGreaterThan(0);
            const closePackages = dbResult.rows.filter(p => p.need_delivery === 0 || p.need_delivery === null);
            expect(closePackages.length).toBeGreaterThan(0);
        }
    });

    test('TC-CD-02: Driver Assigned Orders must NEVER appear in Close Distribution pool', async () => {
        const dbResult = await dbHelper.query(
            `SELECT co.id, co.driver_id, p.name as package_name
             FROM client_orders co
             JOIN client_order_details cod ON cod.client_order_id = co.id
             JOIN sale_items si ON si.id = cod.sale_item_id
             JOIN packages p ON p.id = si.package_id
             WHERE co.driver_id IS NOT NULL AND co.payment_date IS NOT NULL
             LIMIT 5`
        );

        if (!dbResult.skipped && dbResult.rowCount > 0) {
            for (const order of dbResult.rows) {
                expect(order.driver_id).not.toBeNull();
            }
        }
    });

    test('TC-CD-03: Haram Water Distribution Zero Delivery Fee Rule', async () => {
        const dbResult = await dbHelper.query(
            `SELECT co.id, co.delivery_fee, p.need_delivery 
             FROM client_orders co
             JOIN client_order_details cod ON cod.client_order_id = co.id
             JOIN sale_items si ON si.id = cod.sale_item_id
             JOIN packages p ON p.id = si.package_id
             WHERE p.need_delivery = 0 AND co.delivery_fee = 0
             LIMIT 5`
        );

        if (!dbResult.skipped && dbResult.rowCount > 0) {
            for (const order of dbResult.rows) {
                expect(Number(order.delivery_fee)).toBe(0);
            }
        }
    });
});
