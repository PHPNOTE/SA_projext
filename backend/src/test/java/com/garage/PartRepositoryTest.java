package com.garage;

import com.garage.model.entity.Part;
import com.garage.repository.PartRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Part JDBC Repository Integration Tests")
public class PartRepositoryTest extends BaseJdbcRepositoryTest {

    @Autowired
    private PartRepository partRepository;

    @Test
    @DisplayName("Test Part save, findBySku, and findById")
    void testPartSaveAndLookup() {
        Part newPart = new Part(
            null, "TST-WIPER-001", "Wiper Blade 22 Inch",
            new BigDecimal("290.00"), 15, 0, 5, true
        );

        Part saved = partRepository.save(newPart);
        assertThat(saved.partId()).isNotNull();

        Optional<Part> byId = partRepository.findById(saved.partId());
        assertThat(byId).isPresent();
        assertThat(byId.get().sku()).isEqualTo("TST-WIPER-001");

        Optional<Part> bySku = partRepository.findBySku("TST-WIPER-001");
        assertThat(bySku).isPresent();
        assertThat(bySku.get().name()).isEqualTo("Wiper Blade 22 Inch");
    }

    @Test
    @DisplayName("Test findByIdForUpdate (row locking query)")
    void testFindByIdForUpdate() {
        Optional<Part> partForUpdate = partRepository.findByIdForUpdate(1L);
        assertThat(partForUpdate).isPresent();
        assertThat(partForUpdate.get().partId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("Test findLowStock returns parts at or below reorder level")
    void testFindLowStock() {
        List<Part> lowStockParts = partRepository.findLowStock();
        assertThat(lowStockParts).isNotEmpty();
        for (Part part : lowStockParts) {
            assertThat(part.onHand()).isLessThanOrEqualTo(part.reorderLevel());
        }
    }

    @Test
    @DisplayName("Test updateStockCounters atomic update")
    void testUpdateStockCounters() {
        Part part = partRepository.findById(1L).orElseThrow();
        int initialOnHand = part.onHand();
        int initialReserved = part.reserved();

        partRepository.updateStockCounters(part.partId(), initialOnHand + 5, initialReserved + 2);

        Part updated = partRepository.findById(part.partId()).orElseThrow();
        assertThat(updated.onHand()).isEqualTo(initialOnHand + 5);
        assertThat(updated.reserved()).isEqualTo(initialReserved + 2);
    }
}
