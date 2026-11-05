package com.garage;

import com.garage.model.entity.RepairOrder;
import com.garage.model.entity.RepairOrder.QueueClass;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
import com.garage.repository.RepairOrderRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Adversarial Milestone 1 Challenge: Queue Prioritization, Aging, Pessimistic Locking, and Bay Allocation")
public class QueueAndBayAdversarialChallengeTest extends BaseJdbcRepositoryTest {

    @Autowired
    private RepairOrderRepository repairOrderRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    /**
     * Test 1: Queue aging formula verification.
     * Verify that a NORMAL job created 240 minutes ago beats a fresh NORMAL job.
     */
    @Test
    @DisplayName("Adversarial: 240-minute-old NORMAL job MUST beat fresh NORMAL job in queue call-next")
    void testQueueAgingNormalBeatsFreshNormal() {
        // Clear any preexisting QUEUED jobs so our test is 100% deterministic
        jdbcTemplate.update("UPDATE repair_order SET status = 'CANCELLED', bay_id = NULL WHERE status = 'QUEUED'");

        Instant now = Instant.now();
        Instant tAged240m = now.minus(240, ChronoUnit.MINUTES);
        Instant tFresh10m = now.minus(10, ChronoUnit.MINUTES);

        // Ticket A: NORMAL, 240 mins waiting
        RepairOrder agedJob = new RepairOrder(
            null, "TICK-TEST-AGED-240M", 1L, "Engine smoking",
            QueueClass.NORMAL, null, tAged240m,
            RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, tAged240m, null
        );
        RepairOrder savedAged = repairOrderRepository.save(agedJob);

        // Ticket B: NORMAL, 10 mins waiting
        RepairOrder freshJob = new RepairOrder(
            null, "TICK-TEST-FRESH-10M", 2L, "Oil filter replace",
            QueueClass.NORMAL, null, tFresh10m,
            RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, tFresh10m, null
        );
        RepairOrder savedFresh = repairOrderRepository.save(freshJob);

        // Call Next: Must pick 240m job over 10m job
        Optional<RepairOrder> next = repairOrderRepository.findNextQueuedForUpdate();
        assertThat(next).isPresent();
        assertThat(next.get().repairId())
            .withFailMessage("Queue aging failure: Expected 240-min aged job %d but got %d",
                savedAged.repairId(), next.get().repairId())
            .isEqualTo(savedAged.repairId());
        assertThat(next.get().ticketNo()).isEqualTo("TICK-TEST-AGED-240M");
    }

    /**
     * Test 1b: Aging anti-starvation vs fresh priority.
     * A NORMAL job waiting 240 minutes (promoted to Tier 0 because > 120m) vs fresh PRIORITY job.
     * In Algorithm 1: both are tier 0, so queued_at ASC decides (240m job was queued earlier).
     */
    @Test
    @DisplayName("Adversarial: 240-minute-old NORMAL job vs fresh PRIORITY job (Anti-Starvation)")
    void testQueueAgingAntiStarvationVsPriority() {
        jdbcTemplate.update("UPDATE repair_order SET status = 'CANCELLED', bay_id = NULL WHERE status = 'QUEUED'");

        Instant now = Instant.now();
        Instant tAged240m = now.minus(240, ChronoUnit.MINUTES);
        Instant tPriority5m = now.minus(5, ChronoUnit.MINUTES);

        RepairOrder agedNormal = new RepairOrder(
            null, "TICK-TEST-AGED-NORM-240", 1L, "Alternator issue",
            QueueClass.NORMAL, null, tAged240m,
            RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, tAged240m, null
        );
        RepairOrder savedAged = repairOrderRepository.save(agedNormal);

        RepairOrder freshPriority = new RepairOrder(
            null, "TICK-TEST-PRIORITY-5M", 2L, "VIP Urgent Brake check",
            QueueClass.PRIORITY, "VIP Client", tPriority5m,
            RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, tPriority5m, null
        );
        RepairOrder savedPriority = repairOrderRepository.save(freshPriority);

        Optional<RepairOrder> next = repairOrderRepository.findNextQueuedForUpdate();
        assertThat(next).isPresent();
        // Since aged normal has aged > 120 min, it enters tier 0 and queued earlier than fresh priority
        assertThat(next.get().repairId()).isEqualTo(savedAged.repairId());
    }

    /**
     * Test 2: Concurrency & Pessimistic Locking with SKIP LOCKED.
     * Verify that concurrent threads calling findNextQueuedForUpdate() on separate transactions
     * never receive the same queued order (preventing race conditions / double-allocations).
     */
    @Test
    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    @DisplayName("Adversarial: Concurrent findNextQueuedForUpdate() with SKIP LOCKED prevents double-assignment")
    void testConcurrentFindNextQueuedForUpdateSkipLocked() throws Exception {
        jdbcTemplate.update("UPDATE repair_order SET status = 'CANCELLED', bay_id = NULL WHERE status = 'QUEUED'");

        Instant now = Instant.now();
        // Insert 2 queued orders in auto-committed transactions so worker threads can query them
        RepairOrder ro1 = repairOrderRepository.save(new RepairOrder(
            null, "TICK-CONC-01", 1L, "Issue 1",
            QueueClass.NORMAL, null, now.minus(30, ChronoUnit.MINUTES),
            RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, now.minus(30, ChronoUnit.MINUTES), null
        ));

        RepairOrder ro2 = repairOrderRepository.save(new RepairOrder(
            null, "TICK-CONC-02", 2L, "Issue 2",
            QueueClass.NORMAL, null, now.minus(20, ChronoUnit.MINUTES),
            RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, now.minus(20, ChronoUnit.MINUTES), null
        ));

        CountDownLatch thread1HoldLockLatch = new CountDownLatch(1);
        CountDownLatch thread2ExecuteLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(2);

        AtomicReference<Long> thread1ClaimedId = new AtomicReference<>();
        AtomicReference<Long> thread2ClaimedId = new AtomicReference<>();

        ExecutorService executor = Executors.newFixedThreadPool(2);

        // Thread 1: Acquires lock in active transaction and holds it
        executor.submit(() -> {
            TransactionTemplate tx1 = new TransactionTemplate(transactionManager);
            tx1.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx1.execute(status -> {
                Optional<RepairOrder> next = repairOrderRepository.findNextQueuedForUpdate();
                next.ifPresent(ro -> thread1ClaimedId.set(ro.repairId()));
                thread1HoldLockLatch.countDown(); // notify thread 2 that thread 1 holds lock
                try {
                    // Wait for thread 2 to attempt query while thread 1 is still holding lock
                    thread2ExecuteLatch.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                return null;
            });
            finishLatch.countDown();
        });

        // Thread 2: Runs while Thread 1 holds the lock on first ticket
        executor.submit(() -> {
            try {
                thread1HoldLockLatch.await(5, TimeUnit.SECONDS);
                TransactionTemplate tx2 = new TransactionTemplate(transactionManager);
                tx2.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
                tx2.execute(status -> {
                    Optional<RepairOrder> next = repairOrderRepository.findNextQueuedForUpdate();
                    next.ifPresent(ro -> thread2ClaimedId.set(ro.repairId()));
                    return null;
                });
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                thread2ExecuteLatch.countDown();
                finishLatch.countDown();
            }
        });

        try {
            boolean finished = finishLatch.await(10, TimeUnit.SECONDS);
            executor.shutdown();

            System.out.println("=================================================================");
            System.out.println("CONCURRENCY EMPIRICAL RESULT:");
            System.out.println("Thread 1 claimed ID: " + thread1ClaimedId.get());
            System.out.println("Thread 2 claimed ID: " + thread2ClaimedId.get());
            System.out.println("=================================================================");

            assertThat(finished).isTrue();
            assertThat(thread1ClaimedId.get()).isNotNull();
            // Concurrency assertion: Thread 2 MUST NOT have claimed the same ticket as Thread 1 (race condition prevented)
            if (thread2ClaimedId.get() != null) {
                assertThat(thread2ClaimedId.get())
                    .withFailMessage("RACE CONDITION: Both concurrent threads claimed identical repair_id %d", thread1ClaimedId.get())
                    .isNotEqualTo(thread1ClaimedId.get());
            }
        } finally {
            jdbcTemplate.update("DELETE FROM repair_order WHERE ticket_no IN ('TICK-CONC-01', 'TICK-CONC-02')");
            jdbcTemplate.update("UPDATE repair_order SET status = 'QUEUED', bay_id = NULL WHERE ticket_no = 'RO-20261105-0006'");
        }
    }

    /**
     * Test 3: Single Active Bay Invariant probe.
     * Verify whether attempting to assign an occupied bay to a second active repair order
     * is blocked by uk_ro_single_active_bay unique constraint / index.
     */
    @Test
    @DisplayName("Adversarial: Attempting to assign occupied bay to a second active repair order")
    void testSingleActiveBayConstraintEnforcement() {
        Long testBayId = 1L;

        // Ensure Bay 1 is clear, then assign order 1 as active on Bay 1
        jdbcTemplate.update("UPDATE repair_order SET bay_id = NULL WHERE bay_id = ?", testBayId);
        jdbcTemplate.update(
            "UPDATE repair_order SET bay_id = ?, status = 'IN_REPAIR' WHERE repair_id = 1",
            testBayId
        );

        // Attempt to assign Bay 1 to Repair Order 2 in active status 'IN_DIAGNOSIS'
        boolean dbBlockedAssignment = false;
        try {
            jdbcTemplate.update(
                "UPDATE repair_order SET bay_id = ?, status = 'IN_DIAGNOSIS' WHERE repair_id = 2",
                testBayId
            );
        } catch (DataIntegrityViolationException ex) {
            dbBlockedAssignment = true;
        }

        // Check how many active repair orders currently occupy testBayId
        Integer activeJobsInBay = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM repair_order
            WHERE bay_id = ? AND status IN ('IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'QC')
            """,
            Integer.class,
            testBayId
        );

        List<Map<String, Object>> idxList = jdbcTemplate.queryForList(
            "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.INDEXES WHERE UPPER(TABLE_NAME) = 'REPAIR_ORDER'"
        );
        List<Map<String, Object>> conList = jdbcTemplate.queryForList(
            "SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE UPPER(TABLE_NAME) = 'REPAIR_ORDER'"
        );

        System.out.println("=================================================================");
        System.out.println("EMPIRICAL FINDING FOR SINGLE ACTIVE BAY CONSTRAINT:");
        System.out.println("Indexes on REPAIR_ORDER: " + idxList);
        System.out.println("Constraints on REPAIR_ORDER: " + conList);
        System.out.println("Was second assignment blocked by DB constraint: " + dbBlockedAssignment);
        System.out.println("Active jobs currently sharing bay " + testBayId + ": " + activeJobsInBay);
        System.out.println("=================================================================");

        // Empirical assertions verifying remediation of the defect:
        boolean hasConstraint = conList.stream().anyMatch(m -> "UK_RO_SINGLE_ACTIVE_BAY".equalsIgnoreCase(String.valueOf(m.get("CONSTRAINT_NAME"))));
        assertThat(hasConstraint)
            .withFailMessage("Unique constraint uk_ro_single_active_bay must exist in schema")
            .isTrue();
        assertThat(dbBlockedAssignment)
            .withFailMessage("Database must block duplicate active bay assignment")
            .isTrue();
        assertThat(activeJobsInBay)
            .withFailMessage("Bay 1 must not be shared by multiple active jobs")
            .isEqualTo(1);
    }
}

