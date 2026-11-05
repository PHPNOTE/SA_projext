package com.garage;

import com.garage.model.entity.*;
import com.garage.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Comprehensive All 18 JDBC Repositories CRUD Verification")
public class AllRepositoriesCrudTest extends BaseJdbcRepositoryTest {

    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private CustomerRepository customerRepository;
    @Autowired private VehicleRepository vehicleRepository;
    @Autowired private RepairBayRepository repairBayRepository;
    @Autowired private RepairOrderRepository repairOrderRepository;
    @Autowired private EstimateRepository estimateRepository;
    @Autowired private EstimateLineRepository estimateLineRepository;
    @Autowired private PartRepository partRepository;
    @Autowired private PartRequestRepository partRequestRepository;
    @Autowired private StockMovementRepository stockMovementRepository;
    @Autowired private PurchaseOrderRepository purchaseOrderRepository;
    @Autowired private PoLineRepository poLineRepository;
    @Autowired private SaleOrderRepository saleOrderRepository;
    @Autowired private SaleOrderLineRepository saleOrderLineRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceLineRepository invoiceLineRepository;
    @Autowired private PaymentRepository paymentRepository;
    @Autowired private StatusLogRepository statusLogRepository;

    @Test
    @DisplayName("Exercise direct JDBC operations across all 18 repositories")
    void testAllRepositoriesBasicOperations() {
        // 1. UserAccount
        assertThat(userAccountRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(userAccountRepository.findByUsername("admin")).isPresent();
        assertThat(userAccountRepository.findAllActive()).isNotEmpty();

        // 2. Customer
        assertThat(customerRepository.count()).isGreaterThanOrEqualTo(5);
        Customer cust = customerRepository.findById(1L).orElseThrow();
        assertThat(cust.name()).isNotBlank();
        assertThat(customerRepository.findByPhone("081-234-5678")).isPresent();
        assertThat(customerRepository.searchByNameOrPhone("สมชาย")).isNotEmpty();

        // 3. Vehicle
        assertThat(vehicleRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(vehicleRepository.findByPlate("1กก-1234 กรุงเทพมหานคร")).isPresent();
        assertThat(vehicleRepository.findByCustomerId(1L)).isNotEmpty();

        // 4. RepairBay
        assertThat(repairBayRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(repairBayRepository.findAllActive()).isNotEmpty();
        assertThat(repairBayRepository.isBayOccupied(3L)).isTrue();
        assertThat(repairBayRepository.isBayOccupied(1L)).isFalse();

        // 5. RepairOrder
        assertThat(repairOrderRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(repairOrderRepository.findByTicketNo("RO-20261101-0001")).isPresent();

        // 6. Estimate
        assertThat(estimateRepository.count()).isGreaterThanOrEqualTo(5);
        List<Estimate> estimatesForRo1 = estimateRepository.findByRepairId(1L);
        assertThat(estimatesForRo1).isNotEmpty();
        assertThat(estimateRepository.findByRepairIdAndRevisionNo(1L, 1)).isPresent();
        assertThat(estimateRepository.findLatestRevision(3L)).isPresent();

        // 7. EstimateLine
        assertThat(estimateLineRepository.count()).isGreaterThanOrEqualTo(5);
        List<EstimateLine> linesForEst1 = estimateLineRepository.findByEstimateId(1L);
        assertThat(linesForEst1).isNotEmpty();

        // 8. Part
        assertThat(partRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(partRepository.findBySku("OIL-SYN-5W30")).isPresent();
        assertThat(partRepository.findLowStock()).isNotEmpty();

        // 9. PartRequest
        assertThat(partRequestRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(partRequestRepository.findByEstimateLineId(1L)).isPresent();
        List<PartRequest> backordered = partRequestRepository.findByPartIdAndStatus(7L, PartRequest.PartRequestStatus.BACKORDERED);
        assertThat(backordered).isNotEmpty();

        // 10. StockMovement
        assertThat(stockMovementRepository.count()).isGreaterThanOrEqualTo(5);
        List<StockMovement> part1Movements = stockMovementRepository.findByPartId(1L);
        assertThat(part1Movements).isNotEmpty();

        // 11. PurchaseOrder
        assertThat(purchaseOrderRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(purchaseOrderRepository.findByPoNo("PO-20261025-0001")).isPresent();
        List<PurchaseOrder> receivedPos = purchaseOrderRepository.findByStatus(PurchaseOrder.PurchaseOrderStatus.RECEIVED);
        assertThat(receivedPos).isNotEmpty();

        // 12. PoLine
        assertThat(poLineRepository.count()).isGreaterThanOrEqualTo(5);
        List<PoLine> po1Lines = poLineRepository.findByPoId(1L);
        assertThat(po1Lines).isNotEmpty();

        // 13. SaleOrder
        assertThat(saleOrderRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(saleOrderRepository.findBySaleNo("SO-20261101-0001")).isPresent();
        assertThat(saleOrderRepository.findByStatus(SaleOrder.SaleOrderStatus.COMPLETED)).isNotEmpty();

        // 14. SaleOrderLine
        assertThat(saleOrderLineRepository.count()).isGreaterThanOrEqualTo(5);
        List<SaleOrderLine> so1Lines = saleOrderLineRepository.findBySaleId(1L);
        assertThat(so1Lines).isNotEmpty();

        // 15. Invoice
        assertThat(invoiceRepository.count()).isGreaterThanOrEqualTo(5);
        assertThat(invoiceRepository.findByInvoiceNo("INV-20261101-0001")).isPresent();
        assertThat(invoiceRepository.findByRepairId(1L)).isPresent();
        assertThat(invoiceRepository.findBySaleId(1L)).isPresent();

        // 16. InvoiceLine
        assertThat(invoiceLineRepository.count()).isGreaterThanOrEqualTo(5);
        List<InvoiceLine> inv1Lines = invoiceLineRepository.findByInvoiceId(1L);
        assertThat(inv1Lines).isNotEmpty();

        // 17. Payment
        assertThat(paymentRepository.count()).isGreaterThanOrEqualTo(5);
        List<Payment> inv1Payments = paymentRepository.findByInvoiceId(1L);
        assertThat(inv1Payments).hasSize(2);
        assertThat(paymentRepository.getSumPaidByCustomer(1L)).isEqualByComparingTo(new BigDecimal("3420.00"));

        // 18. StatusLog
        assertThat(statusLogRepository.count()).isGreaterThanOrEqualTo(5);
        List<StatusLog> ro1Logs = statusLogRepository.findByEntity(StatusLog.EntityType.REPAIR, 1L);
        assertThat(ro1Logs).isNotEmpty();
        List<StatusLog> recentLogs = statusLogRepository.findRecent(10);
        assertThat(recentLogs).hasSize(10);
    }
}
