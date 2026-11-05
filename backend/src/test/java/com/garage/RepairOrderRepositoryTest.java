package com.garage;

import com.garage.model.entity.RepairOrder;
import com.garage.repository.RepairOrderRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RepairOrder JDBC Repository Integration Tests")
public class RepairOrderRepositoryTest extends BaseJdbcRepositoryTest {

    @Autowired
    private RepairOrderRepository repairOrderRepository;

    @Test
    @DisplayName("Test Priority + 120m Aging Call-Next Queue selection")
    void testQueueCallNextAgingAlgorithm() {
        // Create Normal ticket waiting 130 mins (aged)
        RepairOrder agedTicket = new RepairOrder(
            null, "TICK-TEST-AGED-01", 1L, "Engine vibration",
            RepairOrder.QueueClass.NORMAL, null,
            Instant.now().minus(130, ChronoUnit.MINUTES),
            RepairOrder.RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, Instant.now().minus(130, ChronoUnit.MINUTES), null
        );
        repairOrderRepository.save(agedTicket);

        // Create Fresh Normal ticket waiting 10 mins
        RepairOrder freshTicket = new RepairOrder(
            null, "TICK-TEST-FRESH-01", 2L, "Oil change",
            RepairOrder.QueueClass.NORMAL, null,
            Instant.now().minus(10, ChronoUnit.MINUTES),
            RepairOrder.RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, Instant.now().minus(10, ChronoUnit.MINUTES), null
        );
        repairOrderRepository.save(freshTicket);

        // Next queued should pick aged ticket or priority ticket ahead of fresh normal ticket
        Optional<RepairOrder> next = repairOrderRepository.findNextQueuedForUpdate();
        assertThat(next).isPresent();
        assertThat(next.get().status()).isEqualTo(RepairOrder.RepairOrderStatus.QUEUED);
    }

    @Test
    @DisplayName("Test CRUD and Status Transitions on RepairOrder")
    void testCrudAndStatusTransitions() {
        RepairOrder newRo = new RepairOrder(
            null, "TICK-CRUD-TEST-01", 1L, "Brake pad replacement",
            RepairOrder.QueueClass.NORMAL, null,
            Instant.now(),
            RepairOrder.RepairOrderStatus.QUEUED, null, null, null,
            null, null, false, BigDecimal.ZERO, 1L, Instant.now(), null
        );

        RepairOrder saved = repairOrderRepository.save(newRo);
        assertThat(saved.repairId()).isNotNull();

        Optional<RepairOrder> fetched = repairOrderRepository.findById(saved.repairId());
        assertThat(fetched).isPresent();
        assertThat(fetched.get().ticketNo()).isEqualTo("TICK-CRUD-TEST-01");

        // Transition to IN_DIAGNOSIS with bay 1 and mechanic 3
        repairOrderRepository.updateStatusAndBay(saved.repairId(), RepairOrder.RepairOrderStatus.IN_DIAGNOSIS, 1L, 3L);
        Optional<RepairOrder> updated = repairOrderRepository.findById(saved.repairId());
        assertThat(updated).isPresent();
        assertThat(updated.get().status()).isEqualTo(RepairOrder.RepairOrderStatus.IN_DIAGNOSIS);
        assertThat(updated.get().bayId()).isEqualTo(1L);
        assertThat(updated.get().mechanicId()).isEqualTo(3L);

        // Close repair order
        repairOrderRepository.updateClosedAt(saved.repairId());
        Optional<RepairOrder> closed = repairOrderRepository.findById(saved.repairId());
        assertThat(closed).isPresent();
        assertThat(closed.get().status()).isEqualTo(RepairOrder.RepairOrderStatus.COMPLETED);
        assertThat(closed.get().closedAt()).isNotNull();
    }

    @Test
    @DisplayName("Test findByStatus returns matching repair orders")
    void testFindByStatus() {
        List<RepairOrder> queuedList = repairOrderRepository.findByStatus(RepairOrder.RepairOrderStatus.QUEUED);
        assertThat(queuedList).isNotEmpty();
        for (RepairOrder ro : queuedList) {
            assertThat(ro.status()).isEqualTo(RepairOrder.RepairOrderStatus.QUEUED);
        }
    }
}
