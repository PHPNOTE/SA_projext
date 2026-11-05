package com.garage.service;

import com.garage.dto.InvoiceDtos.*;
import com.garage.exception.GarageException.*;
import com.garage.model.entity.*;
import com.garage.model.entity.Estimate.EstimateStatus;
import com.garage.model.entity.EstimateLine.EstimateLineType;
import com.garage.model.entity.Invoice.InvoiceStatus;
import com.garage.model.entity.Payment.PayerType;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
import com.garage.model.entity.StatusLog.EntityType;
import com.garage.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class BillingService {

    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final PaymentRepository paymentRepository;
    private final RepairOrderRepository repairOrderRepository;
    private final EstimateRepository estimateRepository;
    private final EstimateLineRepository estimateLineRepository;
    private final PartRequestRepository partRequestRepository;
    private final StatusLogRepository statusLogRepository;

    public BillingService(
        InvoiceRepository invoiceRepository,
        InvoiceLineRepository invoiceLineRepository,
        PaymentRepository paymentRepository,
        RepairOrderRepository repairOrderRepository,
        EstimateRepository estimateRepository,
        EstimateLineRepository estimateLineRepository,
        PartRequestRepository partRequestRepository,
        StatusLogRepository statusLogRepository
    ) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineRepository = invoiceLineRepository;
        this.paymentRepository = paymentRepository;
        this.repairOrderRepository = repairOrderRepository;
        this.estimateRepository = estimateRepository;
        this.estimateLineRepository = estimateLineRepository;
        this.partRequestRepository = partRequestRepository;
        this.statusLogRepository = statusLogRepository;
    }

    @Transactional
    public InvoiceResponse generateInvoice(GenerateInvoiceRequest req, Long userId) {
        if (req == null || (req.repairId() == null && req.saleId() == null)
            || (req.repairId() != null && req.saleId() != null)) {
            throw new ValidationException("Provide exactly one of repairId or saleId");
        }

        if (req.repairId() != null) {
            RepairOrder ro = repairOrderRepository.findById(req.repairId())
                .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + req.repairId()));

            if (ro.status() != RepairOrderStatus.AWAITING_PAYMENT) {
                throw new InvalidStatusException("Repair must be in AWAITING_PAYMENT status");
            }

            // Assert no active ISSUED invoice exists
            boolean activeInvoiceExists = invoiceRepository.findByRepairId(ro.repairId())
                .filter(i -> i.status() == InvoiceStatus.ISSUED)
                .isPresent();
            if (activeInvoiceExists) {
                throw new DuplicateInvoiceException("Active invoice already exists for this repair");
            }

            // Gather approved estimate lines
            List<Estimate> approvedEstimates = estimateRepository.findByRepairId(ro.repairId()).stream()
                .filter(e -> e.status() == EstimateStatus.APPROVED)
                .toList();

            List<InvoiceLine> linesToSave = new ArrayList<>();
            BigDecimal subtotal = BigDecimal.ZERO;

            for (Estimate est : approvedEstimates) {
                List<EstimateLine> lines = estimateLineRepository.findByEstimateId(est.estimateId());
                for (EstimateLine l : lines) {
                    if (l.lineType() == EstimateLineType.LABOR) {
                        BigDecimal lineTotal = l.unitPrice().multiply(BigDecimal.valueOf(l.qty()));
                        subtotal = subtotal.add(lineTotal);
                        linesToSave.add(new InvoiceLine(
                            null, null, null, l.description(), l.qty(), l.unitPrice(), lineTotal
                        ));
                    } else if (l.lineType() == EstimateLineType.PART) {
                        var prOpt = partRequestRepository.findByEstimateLineId(l.lineId());
                        int billableQty = prOpt.map(pr -> Math.max(0, pr.qtyIssued() - pr.qtyReturned())).orElse(0);
                        if (billableQty > 0) {
                            BigDecimal lineTotal = l.unitPrice().multiply(BigDecimal.valueOf(billableQty));
                            subtotal = subtotal.add(lineTotal);
                            linesToSave.add(new InvoiceLine(
                                null, null, l.partId(), l.description(), billableQty, l.unitPrice(), lineTotal
                            ));
                        }
                    }
                }
            }

            BigDecimal insuranceCovered = ro.insuranceCoveredAmount() != null ? ro.insuranceCoveredAmount() : BigDecimal.ZERO;
            BigDecimal customerDue = subtotal.subtract(insuranceCovered).max(BigDecimal.ZERO);

            String invoiceNo = "INV-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 900 + 100);
            Invoice invoice = new Invoice(
                null,
                invoiceNo,
                ro.repairId(),
                null,
                subtotal,
                insuranceCovered,
                customerDue,
                InvoiceStatus.ISSUED,
                userId != null ? userId : 2L,
                Instant.now()
            );
            Invoice savedInvoice = invoiceRepository.save(invoice);

            List<InvoiceLine> savedLines = linesToSave.stream()
                .map(il -> new InvoiceLine(null, savedInvoice.invoiceId(), il.partId(), il.description(), il.qty(), il.unitPrice(), il.lineTotal()))
                .toList();
            invoiceLineRepository.batchInsert(savedLines);

            return new InvoiceResponse(savedInvoice, invoiceLineRepository.findByInvoiceId(savedInvoice.invoiceId()));
        }

        throw new ValidationException("Unsupported entity for direct invoice generation");
    }

    @Transactional
    public PayInvoiceResponse payInvoice(Long invoiceId, PayInvoiceRequest req, Long userId) {
        if (req == null || req.amount() == null || req.amount().signum() <= 0 || req.payerType() == null) {
            throw new ValidationException("Positive amount and payerType required");
        }

        Invoice invoice = invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));

        if (invoice.status() != InvoiceStatus.ISSUED) {
            throw new InvalidStatusException("Invoice is void or not active");
        }

        PayerType payerType;
        try {
            payerType = PayerType.valueOf(req.payerType().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid payerType: " + req.payerType());
        }

        Payment payment = new Payment(
            null,
            invoice.invoiceId(),
            payerType,
            req.amount(),
            req.method() != null ? req.method() : "TRANSFER",
            userId != null ? userId : 2L,
            Instant.now()
        );
        Payment savedPayment = paymentRepository.save(payment);

        if (invoice.repairId() != null) {
            RepairOrder ro = repairOrderRepository.findById(invoice.repairId()).orElseThrow();
            BigDecimal paidSum = paymentRepository.getSumPaidByCustomer(invoice.invoiceId());

            RepairOrderStatus finalStatus = ro.status();
            if (paidSum.compareTo(invoice.customerDue()) >= 0 && ro.status() != RepairOrderStatus.COMPLETED) {
                RepairOrder updatedRo = new RepairOrder(
                    ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(), ro.priorityReason(),
                    ro.queuedAt(), RepairOrderStatus.COMPLETED, null, null, ro.mechanicId(), ro.insurerName(),
                    ro.claimNo(), ro.insuranceDocsReceived(), ro.insuranceCoveredAmount(), ro.createdBy(), ro.createdAt(),
                    Instant.now()
                );
                repairOrderRepository.update(updatedRo);
                statusLogRepository.save(new StatusLog(
                    null, EntityType.REPAIR, ro.repairId(), "AWAITING_PAYMENT", "COMPLETED", userId,
                    "Settled in Full", Instant.now()
                ));
                finalStatus = RepairOrderStatus.COMPLETED;
            }

            return new PayInvoiceResponse(savedPayment, finalStatus.name(), invoice.customerDue(), paidSum);
        }

        return new PayInvoiceResponse(savedPayment, null, invoice.customerDue(), req.amount());
    }

    public List<Invoice> getAllInvoices() {
        return invoiceRepository.findAll();
    }

    public Invoice getInvoiceById(Long invoiceId) {
        return invoiceRepository.findById(invoiceId)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
    }
}
