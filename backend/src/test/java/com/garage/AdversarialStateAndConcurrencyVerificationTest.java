package com.garage;

import com.garage.dto.EstimateDtos.CreateEstimateRequest;
import com.garage.dto.EstimateDtos.EstimateDecisionRequest;
import com.garage.dto.EstimateDtos.EstimateLineRequest;
import com.garage.dto.InvoiceDtos.GenerateInvoiceRequest;
import com.garage.dto.InvoiceDtos.PayInvoiceRequest;
import com.garage.dto.RepairDtos.CallNextRequest;
import com.garage.dto.RepairDtos.QCRequest;
import com.garage.dto.RepairDtos.RegisterRepairRequest;
import com.garage.dto.WarehouseDtos.CreatePartRequestInput;
import com.garage.dto.WarehouseDtos.IssuePartRequest;
import com.garage.model.entity.Part;
import com.garage.model.entity.RepairOrder;
import com.garage.model.entity.RepairOrder.QueueClass;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
import com.garage.repository.PartRepository;
import com.garage.repository.RepairOrderRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@DisplayName("Adversarial Empirical Verification by Challenger")
public class AdversarialStateAndConcurrencyVerificationTest extends BaseControllerIntegrationTest {

    @Autowired
    private RepairOrderRepository repairOrderRepository;

    @Autowired
    private PartRepository partRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Nested
    @DisplayName("1. Concurrency & Race Conditions")
    class ConcurrencyAndRaceConditionChallenges {

        @Test
        @DisplayName("1a. Pessimistic Locking: FOR UPDATE SKIP LOCKED prevents double assignment across concurrent workers")
        void testSkipLockedUnderConcurrentWorkerContention() throws Exception {
            // Setup: Clear QUEUED tickets, seed 3 distinct tickets
            jdbcTemplate.update("UPDATE repair_order SET status = 'CANCELLED', bay_id = NULL WHERE status = 'QUEUED'");

            Instant now = Instant.now();
            RepairOrder t1 = repairOrderRepository.save(new RepairOrder(
                null, "TICK-STRESS-01", 1L, "Stress Issue 1",
                QueueClass.NORMAL, null, now.minus(40, ChronoUnit.MINUTES),
                RepairOrderStatus.QUEUED, null, null, null,
                null, null, false, BigDecimal.ZERO, 1L, now.minus(40, ChronoUnit.MINUTES), null
            ));
            RepairOrder t2 = repairOrderRepository.save(new RepairOrder(
                null, "TICK-STRESS-02", 2L, "Stress Issue 2",
                QueueClass.NORMAL, null, now.minus(30, ChronoUnit.MINUTES),
                RepairOrderStatus.QUEUED, null, null, null,
                null, null, false, BigDecimal.ZERO, 1L, now.minus(30, ChronoUnit.MINUTES), null
            ));
            RepairOrder t3 = repairOrderRepository.save(new RepairOrder(
                null, "TICK-STRESS-03", 3L, "Stress Issue 3",
                QueueClass.NORMAL, null, now.minus(20, ChronoUnit.MINUTES),
                RepairOrderStatus.QUEUED, null, null, null,
                null, null, false, BigDecimal.ZERO, 1L, now.minus(20, ChronoUnit.MINUTES), null
            ));

            int workerCount = 5;
            ExecutorService executor = Executors.newFixedThreadPool(workerCount);
            CountDownLatch startGate = new CountDownLatch(1);
            CountDownLatch doneGate = new CountDownLatch(workerCount);

            List<Long> claimedIds = Collections.synchronizedList(new ArrayList<>());
            AtomicInteger nullCount = new AtomicInteger(0);

            for (int i = 0; i < workerCount; i++) {
                executor.submit(() -> {
                    try {
                        startGate.await();
                        TransactionTemplate tx = new TransactionTemplate(transactionManager);
                        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                        tx.execute(s -> {
                            Optional<RepairOrder> next = repairOrderRepository.findNextQueuedForUpdate();
                            if (next.isPresent()) {
                                claimedIds.add(next.get().repairId());
                                // Simulate holding lock briefly
                                try {
                                    Thread.sleep(50);
                                } catch (InterruptedException ignored) {}
                            } else {
                                nullCount.incrementAndGet();
                            }
                            return null;
                        });
                    } catch (Exception e) {
                        e.printStackTrace();
                    } finally {
                        doneGate.countDown();
                    }
                });
            }

            startGate.countDown();
            boolean finished = doneGate.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            assertThat(finished).isTrue();
            System.out.println("Empirical Claimed IDs under concurrency: " + claimedIds);

            // Assert: Absolutely no duplicate tickets claimed across concurrent transactions
            Set<Long> uniqueClaimed = new HashSet<>(claimedIds);
            assertThat(uniqueClaimed.size())
                .withFailMessage("RACE CONDITION: Duplicate ticket claimed under FOR UPDATE SKIP LOCKED: %s", claimedIds)
                .isEqualTo(claimedIds.size());
        }

        @Test
        @DisplayName("1b. Single Active Bay DB Constraint: uk_ro_single_active_bay strictly blocks dual active assignment")
        void testSingleActiveBayDbConstraintStrictlyBlocksDualAssignment() {
            Long testBayId = 2L;

            // Clear bay 2
            jdbcTemplate.update("UPDATE repair_order SET bay_id = NULL WHERE bay_id = ?", testBayId);

            // Assign Order 1 to Bay 2 in status 'IN_REPAIR'
            jdbcTemplate.update(
                "UPDATE repair_order SET bay_id = ?, status = 'IN_REPAIR' WHERE repair_id = 1",
                testBayId
            );

            // Attempting to assign Order 2 to Bay 2 in status 'IN_DIAGNOSIS' MUST throw DataIntegrityViolationException
            assertThatThrownBy(() ->
                jdbcTemplate.update(
                    "UPDATE repair_order SET bay_id = ?, status = 'IN_DIAGNOSIS' WHERE repair_id = 2",
                    testBayId
                )
            ).isInstanceOf(DataIntegrityViolationException.class);
        }

        @Test
        @DisplayName("1c. Parallel part requisition requests exceeding stock: stock invariant and non-negative stock strictly preserved")
        void testParallelPartRequisitionsExceedingStock() throws Exception {
            // Setup part 1 stock: on_hand = 10, reserved = 0
            jdbcTemplate.update("UPDATE part SET on_hand = 10, reserved = 0 WHERE part_id = 1");

            int threadCount = 5;
            int requestedQtyPerThread = 4; // 5 * 4 = 20 total requested, only 10 available
            ExecutorService executor = Executors.newFixedThreadPool(threadCount);
            CountDownLatch startGate = new CountDownLatch(1);
            CountDownLatch doneGate = new CountDownLatch(threadCount);

            AtomicInteger successCount = new AtomicInteger(0);
            AtomicInteger backorderedOrFailedCount = new AtomicInteger(0);

            for (int i = 0; i < threadCount; i++) {
                final int idx = i;
                executor.submit(() -> {
                    try {
                        startGate.await();
                        // Submit requisition via endpoint
                        String payload = objectMapper.writeValueAsString(new CreatePartRequestInput(1L, 1L, requestedQtyPerThread));
                        var result = mockMvc.perform(post("/api/requisitions")
                                .header("Authorization", getMechanicToken())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(payload))
                            .andReturn();

                        int statusCode = result.getResponse().getStatus();
                        if (statusCode == 200) {
                            String content = result.getResponse().getContentAsString();
                            if (content.contains("\"status\":\"RESERVED\"")) {
                                successCount.incrementAndGet();
                            } else {
                                backorderedOrFailedCount.incrementAndGet();
                            }
                        } else {
                            backorderedOrFailedCount.incrementAndGet();
                        }
                    } catch (Exception e) {
                        backorderedOrFailedCount.incrementAndGet();
                    } finally {
                        doneGate.countDown();
                    }
                });
            }

            startGate.countDown();
            boolean finished = doneGate.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            assertThat(finished).isTrue();

            Part p = partRepository.findById(1L).orElseThrow();
            System.out.println("Empirical Stock Status after parallel requisitions: onHand=" + p.onHand() + ", reserved=" + p.reserved() + ", reservedCount=" + successCount.get());

            // Assert: reserved cannot exceed on_hand (10)
            assertThat(p.reserved()).isLessThanOrEqualTo(p.onHand());
            assertThat(p.reserved()).isEqualTo(successCount.get() * requestedQtyPerThread);
            assertThat(successCount.get()).isLessThanOrEqualTo(2); // At most 2 can reserve 4 units from 10
        }
    }

    @Nested
    @DisplayName("2. State Machine Invariants")
    class StateMachineInvariantChallenges {

        @Test
        @DisplayName("2a. Diagnosing an uncalled ticket (in QUEUED status) MUST be rejected with HTTP 409 INVALID_STATUS")
        void testDiagnosingUncalledTicketRejected() throws Exception {
            // Checkin new vehicle -> QUEUED
            RegisterRepairRequest checkin = new RegisterRepairRequest(
                "นายสมชาย ขยันขันแข็ง", "081-111-2222", "ตรวจเช็คทั่วไป",
                "1กก-1111", "Toyota", "Vios", 2019,
                "มีเสียงดังที่ห้องเครื่อง", "NORMAL", null, null,
                null, null, false, BigDecimal.ZERO
            );

            String checkinRes = mockMvc.perform(post("/api/repairs")
                    .header("Authorization", getFrontDeskToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(checkin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

            Long repairId = objectMapper.readTree(checkinRes).get("repairId").asLong();

            // Attempt to create estimate while still QUEUED (uncalled)
            CreateEstimateRequest estReq = new CreateEstimateRequest(
                repairId,
                "เช็คเครื่องยนต์",
                List.of(new EstimateLineRequest("LABOR", null, "ค่าตรวจเช็ค", 1, new BigDecimal("300.00")))
            );

            mockMvc.perform(post("/api/estimates")
                    .header("Authorization", getMechanicToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(estReq)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
        }

        @Test
        @DisplayName("2b. Invoicing an in-repair job MUST be rejected with HTTP 409 INVALID_STATUS")
        void testInvoicingInRepairJobRejected() throws Exception {
            // RO 1 is IN_REPAIR in seed data
            GenerateInvoiceRequest req = new GenerateInvoiceRequest(1L, null);

            mockMvc.perform(post("/api/invoices")
                    .header("Authorization", getFrontDeskToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("INVALID_STATUS"));
        }

        @Test
        @DisplayName("2c. Duplicate invoice generation for the same repair MUST be rejected with HTTP 409 DUPLICATE_INVOICE")
        void testDuplicateInvoiceGenerationRejected() throws Exception {
            // Repair 2 is AWAITING_PAYMENT in seed data.
            // Clear existing invoices for repair 2 to test fresh generation followed by duplicate
            jdbcTemplate.update("DELETE FROM invoice_line WHERE invoice_id IN (SELECT invoice_id FROM invoice WHERE repair_id = 2)");
            jdbcTemplate.update("DELETE FROM payment WHERE invoice_id IN (SELECT invoice_id FROM invoice WHERE repair_id = 2)");
            jdbcTemplate.update("DELETE FROM invoice WHERE repair_id = 2");

            GenerateInvoiceRequest req = new GenerateInvoiceRequest(2L, null);

            // First generation: 200 OK
            mockMvc.perform(post("/api/invoices")
                    .header("Authorization", getFrontDeskToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoice.status").value("ISSUED"));

            // Second generation: 409 DUPLICATE_INVOICE
            mockMvc.perform(post("/api/invoices")
                    .header("Authorization", getFrontDeskToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_INVOICE"));
        }

        @Test
        @DisplayName("2d. Approving an already COMPLETED repair MUST be rejected or blocked")
        void testApprovingAlreadyCompletedRepair() throws Exception {
            // RO 1 is COMPLETED in seed data
            RepairOrder roBefore = repairOrderRepository.findById(1L).orElseThrow();
            assertThat(roBefore.status()).isEqualTo(RepairOrderStatus.COMPLETED);

            // Attempt to call approve on completed repair 1
            var result = mockMvc.perform(post("/api/repairs/1/approve")
                    .header("Authorization", getFrontDeskToken())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new EstimateDecisionRequest("APPROVED", false))))
                .andReturn();

            int statusCode = result.getResponse().getStatus();
            String responseBody = result.getResponse().getContentAsString();
            System.out.println("=================================================================");
            System.out.println("EMPIRICAL FINDING: Approving COMPLETED repair 1 returned HTTP " + statusCode + ": " + responseBody);

            RepairOrder roAfter = repairOrderRepository.findById(1L).orElseThrow();
            System.out.println("Repair 1 status after approval call: " + roAfter.status());
            System.out.println("=================================================================");

            // Empirical verification assertion:
            // Does the backend block this invalid transition or does it illegally mutate COMPLETED -> IN_REPAIR?
            boolean improperlyMutated = (roAfter.status() != RepairOrderStatus.COMPLETED);
            if (improperlyMutated) {
                System.err.println("CONFIRMED DEFECT: Approving COMPLETED repair 1 mutated order to " + roAfter.status());
            }

            // Assert that completed repair must remain COMPLETED and request should be rejected (400 or 409)
            assertThat(roAfter.status())
                .withFailMessage("INVARIANT VIOLATION: Approving an already completed repair reverted status from COMPLETED to %s", roAfter.status())
                .isEqualTo(RepairOrderStatus.COMPLETED);
            assertThat(statusCode)
                .withFailMessage("Expected HTTP 400 or 409 when approving an already completed repair, but got %d", statusCode)
                .isIn(400, 404, 409, 422);
        }
    }
}
