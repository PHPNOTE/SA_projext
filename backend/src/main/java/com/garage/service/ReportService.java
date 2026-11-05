package com.garage.service;

import com.garage.dto.ReportDtos.*;
import com.garage.model.entity.*;
import com.garage.model.entity.Invoice.InvoiceStatus;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
import com.garage.model.entity.StockMovement.MovementType;
import com.garage.repository.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class ReportService {

    private final RepairOrderRepository repairOrderRepository;
    private final VehicleRepository vehicleRepository;
    private final CustomerRepository customerRepository;
    private final InvoiceRepository invoiceRepository;
    private final PartRepository partRepository;
    private final StockMovementRepository stockMovementRepository;
    private final PaymentRepository paymentRepository;

    public ReportService(
        RepairOrderRepository repairOrderRepository,
        VehicleRepository vehicleRepository,
        CustomerRepository customerRepository,
        InvoiceRepository invoiceRepository,
        PartRepository partRepository,
        StockMovementRepository stockMovementRepository,
        PaymentRepository paymentRepository
    ) {
        this.repairOrderRepository = repairOrderRepository;
        this.vehicleRepository = vehicleRepository;
        this.customerRepository = customerRepository;
        this.invoiceRepository = invoiceRepository;
        this.partRepository = partRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.paymentRepository = paymentRepository;
    }

    public RepairSummaryReport getRepairSummary(String startDate, String endDate, Long mechanicId) {
        List<RepairOrder> orders = repairOrderRepository.findAll();
        if (mechanicId != null) {
            orders = orders.stream()
                .filter(r -> mechanicId.equals(r.mechanicId()))
                .toList();
        }

        List<RepairSummaryItem> items = new ArrayList<>();
        int completedCount = 0;

        for (RepairOrder ro : orders) {
            if (ro.status() == RepairOrderStatus.COMPLETED) {
                completedCount++;
            }

            Vehicle vehicle = vehicleRepository.findById(ro.vehicleId()).orElse(null);
            Customer customer = (vehicle != null) ? customerRepository.findById(vehicle.customerId()).orElse(null) : null;
            Invoice invoice = invoiceRepository.findByRepairId(ro.repairId())
                .filter(i -> i.status() == InvoiceStatus.ISSUED)
                .orElse(null);

            items.add(new RepairSummaryItem(
                ro.repairId(),
                ro.ticketNo(),
                ro.status().name(),
                ro.queuedAt(),
                ro.closedAt(),
                vehicle != null ? vehicle.plate() : null,
                customer != null ? customer.name() : null,
                invoice != null ? invoice.subtotal() : BigDecimal.ZERO,
                invoice != null ? invoice.customerDue() : BigDecimal.ZERO
            ));
        }

        return new RepairSummaryReport(items.size(), completedCount, items);
    }

    public InventoryUsageReport getInventoryUsage(String category) {
        List<Part> parts = partRepository.findAllActive();
        List<StockMovement> allMovements = stockMovementRepository.findAll();

        List<InventoryUsageItem> items = new ArrayList<>();
        for (Part p : parts) {
            int issued = allMovements.stream()
                .filter(m -> m.partId().equals(p.partId()) && m.movementType() == MovementType.ISSUE)
                .mapToInt(m -> Math.abs(m.deltaOnHand()))
                .sum();

            int returned = allMovements.stream()
                .filter(m -> m.partId().equals(p.partId()) && m.movementType() == MovementType.RETURN)
                .mapToInt(StockMovement::deltaOnHand)
                .sum();

            int netConsumed = Math.max(0, issued - returned);
            boolean isLowStock = p.onHand() <= p.reorderLevel();

            items.add(new InventoryUsageItem(
                p.partId(),
                p.sku(),
                p.name(),
                p.sellPrice(),
                p.onHand(),
                p.reserved(),
                p.reorderLevel(),
                isLowStock,
                netConsumed
            ));
        }

        return new InventoryUsageReport(items.size(), items);
    }

    public RevenueReport getRevenueReport(String startDate, String endDate) {
        List<Invoice> validInvoices = invoiceRepository.findAll().stream()
            .filter(i -> i.status() == InvoiceStatus.ISSUED)
            .toList();

        BigDecimal grossRevenue = validInvoices.stream()
            .map(Invoice::subtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<Payment> allPayments = paymentRepository.findAll();
        BigDecimal totalPayments = allPayments.stream()
            .map(Payment::amount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new RevenueReport(validInvoices.size(), grossRevenue, totalPayments);
    }
}
