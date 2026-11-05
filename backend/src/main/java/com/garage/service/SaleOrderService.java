package com.garage.service;

import com.garage.dto.SaleDtos.*;
import com.garage.exception.GarageException.*;
import com.garage.model.entity.*;
import com.garage.model.entity.Invoice.InvoiceStatus;
import com.garage.model.entity.PartRequest.PartRequestStatus;
import com.garage.model.entity.Payment.PayerType;
import com.garage.model.entity.SaleOrder.SaleOrderStatus;
import com.garage.model.entity.StatusLog.EntityType;
import com.garage.model.entity.StockMovement.MovementType;
import com.garage.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class SaleOrderService {

    private final SaleOrderRepository saleOrderRepository;
    private final SaleOrderLineRepository saleOrderLineRepository;
    private final PartRepository partRepository;
    private final PartRequestRepository partRequestRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final PaymentRepository paymentRepository;
    private final StatusLogRepository statusLogRepository;
    private final StockService stockService;

    public SaleOrderService(
        SaleOrderRepository saleOrderRepository,
        SaleOrderLineRepository saleOrderLineRepository,
        PartRepository partRepository,
        PartRequestRepository partRequestRepository,
        InvoiceRepository invoiceRepository,
        InvoiceLineRepository invoiceLineRepository,
        PaymentRepository paymentRepository,
        StatusLogRepository statusLogRepository,
        StockService stockService
    ) {
        this.saleOrderRepository = saleOrderRepository;
        this.saleOrderLineRepository = saleOrderLineRepository;
        this.partRepository = partRepository;
        this.partRequestRepository = partRequestRepository;
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineRepository = invoiceLineRepository;
        this.paymentRepository = paymentRepository;
        this.statusLogRepository = statusLogRepository;
        this.stockService = stockService;
    }

    @Transactional
    public SaleResponse createSaleQuote(Long customerId, List<SaleLineRequest> lines, Long userId) {
        if (lines == null || lines.isEmpty()) {
            throw new ValidationException("Sale lines required");
        }

        for (SaleLineRequest l : lines) {
            if (l.partId() == null || l.qty() == null || l.qty() <= 0) {
                throw new ValidationException("Part ID and positive quantity required");
            }
            if (l.unitPrice() != null && l.unitPrice().signum() < 0) {
                throw new InvalidPriceException("Unit price cannot be negative");
            }
        }

        String saleNo = "SO-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 900 + 100);
        SaleOrder sale = new SaleOrder(
            null,
            saleNo,
            customerId,
            SaleOrderStatus.QUOTED,
            userId != null ? userId : 6L,
            Instant.now()
        );
        SaleOrder savedSale = saleOrderRepository.save(sale);

        List<SaleOrderLine> linesToSave = new ArrayList<>();
        for (SaleLineRequest l : lines) {
            Part part = partRepository.findById(l.partId())
                .orElseThrow(() -> new ResourceNotFoundException("Part " + l.partId() + " not found"));
            BigDecimal unitPrice = l.unitPrice() != null ? l.unitPrice() : part.sellPrice();

            linesToSave.add(new SaleOrderLine(
                null,
                savedSale.saleId(),
                l.partId(),
                l.qty(),
                unitPrice
            ));
        }
        saleOrderLineRepository.batchInsert(linesToSave);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.SALE,
            savedSale.saleId(),
            null,
            "QUOTED",
            userId,
            "Quoted",
            Instant.now()
        ));

        List<SaleOrderLine> savedLines = saleOrderLineRepository.findBySaleId(savedSale.saleId());
        return new SaleResponse(savedSale, savedLines);
    }

    @Transactional
    public SaleOrder confirmSale(Long saleId, Long userId) {
        SaleOrder sale = saleOrderRepository.findById(saleId)
            .orElseThrow(() -> new ResourceNotFoundException("Sale not found: " + saleId));

        if (sale.status() != SaleOrderStatus.QUOTED) {
            throw new InvalidStatusException("Cannot confirm from status " + sale.status());
        }

        List<SaleOrderLine> lines = saleOrderLineRepository.findBySaleId(sale.saleId());
        for (SaleOrderLine l : lines) {
            Part part = partRepository.findById(l.partId())
                .orElseThrow(() -> new ResourceNotFoundException("Part not found: " + l.partId()));

            int available = part.onHand() - part.reserved();
            if (available < l.qty()) {
                throw new StockoutException("Insufficient stock for part " + part.sku());
            }

            stockService.executeStockMovement(
                part.partId(),
                MovementType.RESERVE,
                0,
                l.qty(),
                null,
                null,
                "Reserved for Sale " + sale.saleNo(),
                userId
            );

            PartRequest pr = new PartRequest(
                null,
                null,
                l.lineId(),
                l.partId(),
                l.qty(),
                0,
                0,
                PartRequestStatus.RESERVED,
                Instant.now()
            );
            partRequestRepository.save(pr);
        }

        saleOrderRepository.updateStatus(sale.saleId(), SaleOrderStatus.CONFIRMED);
        statusLogRepository.save(new StatusLog(
            null,
            EntityType.SALE,
            sale.saleId(),
            "QUOTED",
            "CONFIRMED",
            userId,
            "Sale Confirmed & Stock Held",
            Instant.now()
        ));

        return saleOrderRepository.findById(saleId).orElseThrow();
    }

    @Transactional
    public CompleteSaleResponse completeSale(Long saleId, BigDecimal amountPaid, String paymentMethod, Long userId) {
        SaleOrder sale = saleOrderRepository.findById(saleId)
            .orElseThrow(() -> new ResourceNotFoundException("Sale not found: " + saleId));

        if (sale.status() != SaleOrderStatus.CONFIRMED) {
            throw new InvalidStatusException("Sale must be CONFIRMED to complete");
        }

        List<SaleOrderLine> lines = saleOrderLineRepository.findBySaleId(sale.saleId());
        BigDecimal subtotal = BigDecimal.ZERO;
        List<InvoiceLine> invoiceLinesToSave = new ArrayList<>();

        for (SaleOrderLine l : lines) {
            BigDecimal lineTotal = l.unitPrice().multiply(BigDecimal.valueOf(l.qty()));
            subtotal = subtotal.add(lineTotal);

            invoiceLinesToSave.add(new InvoiceLine(
                null,
                null, // filled after invoice save
                l.partId(),
                "Part #" + l.partId(),
                l.qty(),
                l.unitPrice(),
                lineTotal
            ));

            // Issue stock
            stockService.executeStockMovement(
                l.partId(),
                MovementType.ISSUE,
                -l.qty(),
                -l.qty(),
                null,
                null,
                "Counter Sale " + sale.saleNo(),
                userId
            );

            partRequestRepository.findBySaleOrderLineId(l.lineId()).ifPresent(pr ->
                partRequestRepository.updateStatusAndQtys(pr.requestId(), PartRequestStatus.ISSUED, l.qty(), 0)
            );
        }

        if (amountPaid == null || amountPaid.compareTo(subtotal) < 0) {
            throw new InsufficientPaymentException("Payment amount " + amountPaid + " is less than subtotal " + subtotal);
        }

        String invNo = "INV-SALE-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 900 + 100);
        Invoice invoice = new Invoice(
            null,
            invNo,
            null,
            sale.saleId(),
            subtotal,
            BigDecimal.ZERO,
            subtotal,
            InvoiceStatus.ISSUED,
            userId != null ? userId : 6L,
            Instant.now()
        );
        Invoice savedInvoice = invoiceRepository.save(invoice);

        List<InvoiceLine> savedInvLines = invoiceLinesToSave.stream()
            .map(il -> new InvoiceLine(null, savedInvoice.invoiceId(), il.partId(), il.description(), il.qty(), il.unitPrice(), il.lineTotal()))
            .toList();
        invoiceLineRepository.batchInsert(savedInvLines);

        Payment payment = new Payment(
            null,
            savedInvoice.invoiceId(),
            PayerType.CUSTOMER,
            amountPaid,
            paymentMethod != null ? paymentMethod : "CASH",
            userId != null ? userId : 6L,
            Instant.now()
        );
        Payment savedPayment = paymentRepository.save(payment);

        saleOrderRepository.updateStatus(sale.saleId(), SaleOrderStatus.COMPLETED);
        statusLogRepository.save(new StatusLog(
            null,
            EntityType.SALE,
            sale.saleId(),
            "CONFIRMED",
            "COMPLETED",
            userId,
            "Sale Completed",
            Instant.now()
        ));

        SaleOrder updatedSale = saleOrderRepository.findById(saleId).orElseThrow();
        return new CompleteSaleResponse(updatedSale, savedInvoice, savedPayment);
    }

    @Transactional
    public SaleOrder cancelSale(Long saleId, Long userId) {
        SaleOrder sale = saleOrderRepository.findById(saleId)
            .orElseThrow(() -> new ResourceNotFoundException("Sale not found: " + saleId));

        if (sale.status() == SaleOrderStatus.COMPLETED || sale.status() == SaleOrderStatus.CANCELLED) {
            throw new InvalidStatusException("Order already completed or cancelled");
        }

        if (sale.status() == SaleOrderStatus.CONFIRMED) {
            List<SaleOrderLine> lines = saleOrderLineRepository.findBySaleId(sale.saleId());
            for (SaleOrderLine l : lines) {
                partRequestRepository.findBySaleOrderLineId(l.lineId()).ifPresent(pr -> {
                    if (pr.status() == PartRequestStatus.RESERVED) {
                        stockService.executeStockMovement(
                            pr.partId(),
                            MovementType.RELEASE,
                            0,
                            -pr.qty(),
                            pr.requestId(),
                            null,
                            "Sale Cancelled",
                            userId
                        );
                        partRequestRepository.updateStatusAndQtys(pr.requestId(), PartRequestStatus.CANCELLED, 0, 0);
                    }
                });
            }
        }

        saleOrderRepository.updateStatus(sale.saleId(), SaleOrderStatus.CANCELLED);
        statusLogRepository.save(new StatusLog(
            null,
            EntityType.SALE,
            sale.saleId(),
            sale.status().name(),
            "CANCELLED",
            userId,
            "Sale Cancelled",
            Instant.now()
        ));

        return saleOrderRepository.findById(saleId).orElseThrow();
    }
}
