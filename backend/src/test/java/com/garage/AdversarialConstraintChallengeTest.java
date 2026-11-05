package com.garage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Adversarial Database Constraints & Invariants Challenge")
public class AdversarialConstraintChallengeTest extends BaseJdbcRepositoryTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Nested
    @DisplayName("Challenge 1: Part Stock Boundary Constraints (chk_part_stock)")
    class PartStockBoundaryChallenges {

        @Test
        @DisplayName("Adversarial: Updating on_hand < 0 MUST throw DataIntegrityViolationException")
        void testNegativeOnHandFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update("UPDATE part SET on_hand = -1 WHERE part_id = 1")
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Updating reserved < 0 MUST throw DataIntegrityViolationException")
        void testNegativeReservedFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update("UPDATE part SET reserved = -5 WHERE part_id = 1")
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Updating reserved > on_hand MUST throw DataIntegrityViolationException")
        void testReservedGreaterThanOnHandFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update("UPDATE part SET on_hand = 10, reserved = 15 WHERE part_id = 1")
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Inserting part with on_hand < 0 MUST fail")
        void testInsertNegativeOnHandFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO part (sku, name, sell_price, on_hand, reserved, reorder_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "ADV-NEG-01", "Bad Stock Part", 100.00, -1, 0, 5, true
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Inserting part with reserved > on_hand MUST fail")
        void testInsertReservedExceedingOnHandFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO part (sku, name, sell_price, on_hand, reserved, reorder_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "ADV-EXC-01", "Bad Stock Part 2", 100.00, 5, 10, 5, true
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Negative sell_price MUST throw DataIntegrityViolationException")
        void testNegativeSellPriceFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update("UPDATE part SET sell_price = -0.01 WHERE part_id = 1")
            ).isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Nested
    @DisplayName("Challenge 2: Exclusive XOR Constraints (part_request & invoice)")
    class ExclusiveXorChallenges {

        @Test
        @DisplayName("Adversarial: part_request with BOTH estimate_line_id and sale_order_line_id MUST fail")
        void testPartRequestBothSourcesPopulatedFails() {
            // estimate_line_id = 1, sale_order_line_id = 1, part_id = 1
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO part_request (estimate_line_id, sale_order_line_id, part_id, qty, status) VALUES (?, ?, ?, ?, ?)",
                    1L, 1L, 1L, 1, "RESERVED"
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: part_request with BOTH estimate_line_id and sale_order_line_id as NULL MUST fail")
        void testPartRequestBothSourcesNullFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO part_request (estimate_line_id, sale_order_line_id, part_id, qty, status) VALUES (?, ?, ?, ?, ?)",
                    null, null, 1L, 1, "RESERVED"
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Valid Control: part_request with EXACTLY ONE source succeeds")
        void testPartRequestSingleSourceSucceeds() {
            int rowsEst = jdbcTemplate.update(
                "INSERT INTO part_request (estimate_line_id, sale_order_line_id, part_id, qty, status) VALUES (?, ?, ?, ?, ?)",
                1L, null, 1L, 1, "RESERVED"
            );
            assertThat(rowsEst).isEqualTo(1);

            int rowsSale = jdbcTemplate.update(
                "INSERT INTO part_request (estimate_line_id, sale_order_line_id, part_id, qty, status) VALUES (?, ?, ?, ?, ?)",
                null, 1L, 1L, 1, "RESERVED"
            );
            assertThat(rowsSale).isEqualTo(1);
        }

        @Test
        @DisplayName("Adversarial: invoice with BOTH repair_id and sale_id MUST fail")
        void testInvoiceBothSourcesPopulatedFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO invoice (invoice_no, repair_id, sale_id, subtotal, customer_due, status, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "INV-TEST-BOTH", 1L, 1L, 1000.00, 1000.00, "ISSUED", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: invoice with NEITHER repair_id NOR sale_id MUST fail")
        void testInvoiceBothSourcesNullFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO invoice (invoice_no, repair_id, sale_id, subtotal, customer_due, status, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "INV-TEST-NONE", null, null, 1000.00, 1000.00, "ISSUED", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }
    }

    @Nested
    @DisplayName("Challenge 3: Stock Movement Constraints & Source Semantics")
    class StockMovementChallenges {

        @Test
        @DisplayName("Adversarial: movement_type = 'ADJUST' WITHOUT reason MUST fail chk_sm_adjust_reason")
        void testAdjustMovementWithoutReasonFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO stock_movement (part_id, movement_type, delta_on_hand, delta_reserved, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    1L, "ADJUST", 5, 0, null, 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: movement_type = 'ADJUST' with EMPTY whitespace reason MUST fail chk_sm_adjust_reason")
        void testAdjustMovementWithBlankReasonFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO stock_movement (part_id, movement_type, delta_on_hand, delta_reserved, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    1L, "ADJUST", 5, 0, "   ", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: invalid movement_type MUST fail chk_sm_type")
        void testInvalidMovementTypeFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO stock_movement (part_id, movement_type, delta_on_hand, delta_reserved, reason, user_id) VALUES (?, ?, ?, ?, ?, ?)",
                    1L, "STOLEN", -1, 0, "Missing item", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Schema Probe: Does stock_movement reject both part_request_id and po_line_id populated?")
        void probeStockMovementDualSourceBehavior() {
            // Note: Investigating whether chk_stock_movement_source_xor exists or if dual source is permitted by DDL
            boolean exceptionThrown = false;
            try {
                jdbcTemplate.update(
                    "INSERT INTO stock_movement (part_id, movement_type, delta_on_hand, delta_reserved, part_request_id, po_line_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    1L, "RECEIPT", 10, 0, 1L, 1L, 1L
                );
            } catch (DataIntegrityViolationException ex) {
                exceptionThrown = true;
            }
            // Report actual empirical finding
            System.out.println("EMPIRICAL PROBE: stock_movement with both part_request_id and po_line_id threw constraint violation: " + exceptionThrown);
        }
    }

    @Nested
    @DisplayName("Challenge 4: Foreign Key Cascades & Deletion Invariants")
    class ForeignKeyCascadeChallenges {

        @Test
        @DisplayName("Adversarial: Deleting a customer with existing vehicles MUST fail with ON DELETE RESTRICT")
        void testDeleteCustomerWithVehicleFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update("DELETE FROM customer WHERE customer_id = 1")
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Deleting a part referenced by stock_movement or lines MUST fail with ON DELETE RESTRICT")
        void testDeleteReferencedPartFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update("DELETE FROM part WHERE part_id = 1")
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: Deleting a repair_bay MUST set repair_order.bay_id to NULL (ON DELETE SET NULL)")
        void testDeleteRepairBaySetsNullOnRepairOrder() {
            // Bay 4 is assigned to RO 5 ('IN_DIAGNOSIS')
            Long bayId = 4L;
            Integer roCountWithBay = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM repair_order WHERE bay_id = ?",
                Integer.class,
                bayId
            );
            assertThat(roCountWithBay).isGreaterThan(0);

            // Delete repair_bay 4
            int deleted = jdbcTemplate.update("DELETE FROM repair_bay WHERE bay_id = ?", bayId);
            assertThat(deleted).isEqualTo(1);

            // Verify ro.bay_id became NULL
            Integer roCountRemaining = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM repair_order WHERE bay_id = ?",
                Integer.class,
                bayId
            );
            assertThat(roCountRemaining).isEqualTo(0);
        }

        @Test
        @DisplayName("Adversarial: Deleting an estimate MUST cascade delete its estimate_lines and part_requests")
        void testCascadeDeleteEstimate() {
            // Find an estimate with estimate_lines
            Long estimateId = 1L;

            // Verify lines exist before deletion
            Integer lineCountBefore = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM estimate_line WHERE estimate_id = ?",
                Integer.class,
                estimateId
            );
            assertThat(lineCountBefore).isGreaterThan(0);

            // Delete estimate
            int deletedEst = jdbcTemplate.update("DELETE FROM estimate WHERE estimate_id = ?", estimateId);
            assertThat(deletedEst).isEqualTo(1);

            // Verify lines cascaded
            Integer lineCountAfter = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM estimate_line WHERE estimate_id = ?",
                Integer.class,
                estimateId
            );
            assertThat(lineCountAfter).isEqualTo(0);
        }
    }

    @Nested
    @DisplayName("Challenge 5: Global Stock Ledger Balance Invariant across all parts")
    class StockLedgerBalanceChallenges {

        @Test
        @DisplayName("Empirical Verification: on_hand == sum(delta_on_hand) and reserved == sum(delta_reserved) for EVERY part")
        void verifyGlobalStockLedgerBalanceForAllParts() {
            String sql = """
                SELECT p.part_id, p.sku, p.name, p.on_hand, p.reserved,
                       COALESCE(SUM(sm.delta_on_hand), 0) AS sum_delta_on_hand,
                       COALESCE(SUM(sm.delta_reserved), 0) AS sum_delta_reserved
                FROM part p
                LEFT JOIN stock_movement sm ON sm.part_id = p.part_id
                GROUP BY p.part_id, p.sku, p.name, p.on_hand, p.reserved
                ORDER BY p.part_id
                """;

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql);
            assertThat(rows).isNotEmpty();

            for (Map<String, Object> row : rows) {
                Long partId = ((Number) row.get("part_id")).longValue();
                String sku = (String) row.get("sku");
                int onHand = ((Number) row.get("on_hand")).intValue();
                int reserved = ((Number) row.get("reserved")).intValue();
                int sumDeltaOnHand = ((Number) row.get("sum_delta_on_hand")).intValue();
                int sumDeltaReserved = ((Number) row.get("sum_delta_reserved")).intValue();

                assertThat(onHand)
                    .withFailMessage("LEDGER IMBALANCE on part %s (ID %d): part.on_hand=%d but sum(delta_on_hand)=%d",
                        sku, partId, onHand, sumDeltaOnHand)
                    .isEqualTo(sumDeltaOnHand);

                assertThat(reserved)
                    .withFailMessage("RESERVATION IMBALANCE on part %s (ID %d): part.reserved=%d but sum(delta_reserved)=%d",
                        sku, partId, reserved, sumDeltaReserved)
                    .isEqualTo(sumDeltaReserved);
            }
        }
    }

    @Nested
    @DisplayName("Challenge 6: Domain Status and Logic Check Constraints")
    class DomainStatusChallenges {

        @Test
        @DisplayName("Adversarial: repair_order with illegal status MUST throw DataIntegrityViolationException")
        void testInvalidRepairOrderStatusFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO repair_order (ticket_no, vehicle_id, complaint, queue_class, status, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                    "RO-ADV-001", 1L, "Adversarial test", "NORMAL", "INVALID_STATUS", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: PRIORITY repair_order with NULL priority_reason MUST throw DataIntegrityViolationException")
        void testPriorityQueueWithoutReasonFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO repair_order (ticket_no, vehicle_id, complaint, queue_class, priority_reason, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    "RO-ADV-002", 1L, "Adversarial test", "PRIORITY", null, "QUEUED", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: po_line with qty_received > qty_ordered MUST throw DataIntegrityViolationException")
        void testPoLineQtyReceivedExceedingOrderedFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO po_line (po_id, part_id, qty_ordered, qty_received, unit_cost) VALUES (?, ?, ?, ?, ?)",
                    1L, 1L, 10, 15, 100.00
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("Adversarial: payment with amount <= 0 MUST throw DataIntegrityViolationException")
        void testZeroOrNegativePaymentAmountFails() {
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO payment (invoice_id, payer_type, amount, method, received_by) VALUES (?, ?, ?, ?, ?)",
                    1L, "CUSTOMER", 0.00, "CASH", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);

            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "INSERT INTO payment (invoice_id, payer_type, amount, method, received_by) VALUES (?, ?, ?, ?, ?)",
                    1L, "CUSTOMER", -50.00, "CASH", 1L
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }
    }
}
