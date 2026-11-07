package com.garage.service;

import com.garage.util.DocNo;
import com.garage.dto.WarehouseDtos.*;
import com.garage.exception.GarageException.*;
import com.garage.model.entity.*;
import com.garage.model.entity.PartRequest.PartRequestStatus;
import com.garage.model.entity.PurchaseOrder.PurchaseOrderStatus;
import com.garage.model.entity.RepairOrder.QueueClass;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
import com.garage.model.entity.StatusLog.EntityType;
import com.garage.model.entity.StockMovement.MovementType;
import com.garage.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;

@Service
public class StockService {

    private final PartRepository partRepository;
    private final StockMovementRepository stockMovementRepository;
    private final PartRequestRepository partRequestRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PoLineRepository poLineRepository;
    private final StatusLogRepository statusLogRepository;
    private final RepairOrderRepository repairOrderRepository;
    private final EstimateLineRepository estimateLineRepository;
    private final EstimateRepository estimateRepository;

    public StockService(
        PartRepository partRepository,
        StockMovementRepository stockMovementRepository,
        PartRequestRepository partRequestRepository,
        PurchaseOrderRepository purchaseOrderRepository,
        PoLineRepository poLineRepository,
        StatusLogRepository statusLogRepository,
        RepairOrderRepository repairOrderRepository,
        EstimateLineRepository estimateLineRepository,
        EstimateRepository estimateRepository
    ) {
        this.partRepository = partRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.partRequestRepository = partRequestRepository;
        this.purchaseOrderRepository = purchaseOrderRepository;
        this.poLineRepository = poLineRepository;
        this.statusLogRepository = statusLogRepository;
        this.repairOrderRepository = repairOrderRepository;
        this.estimateLineRepository = estimateLineRepository;
        this.estimateRepository = estimateRepository;
    }

    @Transactional
    public void executeStockMovement(
        Long partId,
        MovementType type,
        int deltaOnHand,
        int deltaReserved,
        Long partRequestId,
        Long poLineId,
        String reason,
        Long userId
    ) {
        Part part = partRepository.findByIdForUpdate(partId)
            .orElseThrow(() -> new ResourceNotFoundException("Part not found: " + partId));

        int newOnHand = part.onHand() + deltaOnHand;
        int newReserved = part.reserved() + deltaReserved;

        if (newOnHand < 0 || newReserved < 0 || newReserved > newOnHand) {
            throw new InvalidStockException("Stock invariant violation: on_hand=" + newOnHand + ", reserved=" + newReserved);
        }

        partRepository.updateStockCounters(partId, newOnHand, newReserved);

        StockMovement movement = new StockMovement(
            null,
            partId,
            type,
            deltaOnHand,
            deltaReserved,
            partRequestId,
            poLineId,
            reason,
            userId,
            Instant.now()
        );
        stockMovementRepository.save(movement);
    }

    @Transactional
    public Part upsertPart(PartUpsertRequest req, Long userId) {
        if (req == null || req.sku() == null || req.sku().trim().isEmpty()
            || req.name() == null || req.name().trim().isEmpty() || req.sellPrice() == null) {
            throw new ValidationException("SKU, name, and sellPrice required");
        }
        if (req.sellPrice().signum() < 0) {
            throw new InvalidPriceException("Selling price cannot be negative");
        }

        String sku = req.sku().trim();
        int reorderLevel = req.reorderLevel() != null ? req.reorderLevel() : 0;

        return partRepository.findBySku(sku).map(existing -> {
            Part updated = new Part(
                existing.partId(),
                existing.sku(),
                req.name().trim(),
                req.sellPrice(),
                existing.onHand(),
                existing.reserved(),
                reorderLevel,
                existing.isActive()
            );
            partRepository.update(updated);
            logPart(updated.partId(), "UPDATED", userId, "แก้ไขข้อมูลอะไหล่และราคา");
            return updated;
        }).orElseGet(() -> {
            Part newPart = new Part(
                null,
                sku,
                req.name().trim(),
                req.sellPrice(),
                0,
                0,
                reorderLevel,
                true
            );
            Part saved = partRepository.save(newPart);
            logPart(saved.partId(), "CREATED", userId, "เพิ่มรายการอะไหล่ใหม่");
            return saved;
        });
    }

    @Transactional
    public void deletePart(Long partId, Long userId) {
        Part part = partRepository.findById(partId)
            .orElseThrow(() -> new ResourceNotFoundException("Part not found: " + partId));
        if (!partRepository.deleteIfUnused(partId)) {
            throw new ValidationException("Cannot delete part with stock movements or document references; deactivate it instead");
        }
        logPart(partId, "DELETED", userId, "ลบรายการอะไหล่ " + part.sku());
    }

    private void logPart(Long partId, String action, Long userId, String note) {
        statusLogRepository.save(new StatusLog(null, EntityType.PART, partId, null, action, userId, note, Instant.now()));
    }

    @Transactional
    public IssuePartResponse issuePart(Long requestId, Long userId) {
        if (requestId == null) {
            throw new ValidationException("requestId required");
        }
        PartRequest req = partRequestRepository.findById(requestId)
            .orElseThrow(() -> new ResourceNotFoundException("Part request not found: " + requestId));

        if (req.status() != PartRequestStatus.RESERVED) {
            throw new PartNotReservedException("Cannot issue request in status " + req.status());
        }

        Part part = partRepository.findById(req.partId())
            .orElseThrow(() -> new ResourceNotFoundException("Part not found: " + req.partId()));

        if (part.onHand() < req.qty() || part.reserved() < req.qty()) {
            throw new InvalidStockException("Insufficient stock to issue");
        }

        executeStockMovement(
            req.partId(),
            MovementType.ISSUE,
            -req.qty(),
            -req.qty(),
            req.requestId(),
            null,
            "Issued to Repair/Counter",
            userId
        );

        partRequestRepository.updateStatusAndQtys(requestId, PartRequestStatus.ISSUED, req.qty(), req.qtyReturned());
        statusLogRepository.save(new StatusLog(
            null,
            EntityType.PART_REQUEST,
            req.requestId(),
            "RESERVED",
            "ISSUED",
            userId,
            "Part Handed Over",
            Instant.now()
        ));

        Part updatedPart = partRepository.findById(req.partId()).orElseThrow();
        PartRequest updatedReq = partRequestRepository.findById(requestId).orElseThrow();
        return new IssuePartResponse(updatedReq, updatedPart);
    }

    @Transactional
    public ReturnPartResponse returnPart(Long requestId, int qty, Long userId) {
        if (requestId == null || qty <= 0) {
            throw new ValidationException("Valid requestId and positive qty required");
        }
        PartRequest req = partRequestRepository.findById(requestId)
            .orElseThrow(() -> new ResourceNotFoundException("Part request not found: " + requestId));

        int maxReturnable = req.qtyIssued() - req.qtyReturned();
        if (qty > maxReturnable) {
            throw new InvalidReturnQuantityException("Cannot return " + qty + " units. Max returnable is " + maxReturnable);
        }

        executeStockMovement(
            req.partId(),
            MovementType.RETURN,
            qty,
            0,
            req.requestId(),
            null,
            "Returned unused part to warehouse",
            userId
        );

        int newReturned = req.qtyReturned() + qty;
        PartRequestStatus newStatus = (newReturned == req.qtyIssued()) ? PartRequestStatus.RETURNED : req.status();
        partRequestRepository.updateStatusAndQtys(requestId, newStatus, req.qtyIssued(), newReturned);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.PART_REQUEST,
            req.requestId(),
            req.status().name(),
            newStatus.name(),
            userId,
            "Returned " + qty + " units",
            Instant.now()
        ));

        Part updatedPart = partRepository.findById(req.partId()).orElseThrow();
        PartRequest updatedReq = partRequestRepository.findById(requestId).orElseThrow();
        return new ReturnPartResponse(updatedReq, updatedPart);
    }

    @Transactional
    public Part adjustStock(Long partId, int delta, String reason, Long userId) {
        if (partId == null || reason == null || reason.trim().isEmpty()) {
            throw new ValidationException("partId, delta, and non-empty reason required");
        }
        Part part = partRepository.findById(partId)
            .orElseThrow(() -> new ResourceNotFoundException("Part not found: " + partId));

        if (part.onHand() + delta < part.reserved()) {
            throw new InvalidStockException("Cannot adjust stock below active reservations (" + part.reserved() + ")");
        }

        executeStockMovement(partId, MovementType.ADJUST, delta, 0, null, null, reason.trim(), userId);
        statusLogRepository.save(new StatusLog(null, EntityType.STOCK, partId,
            String.valueOf(part.onHand()), String.valueOf(part.onHand() + delta), userId, reason.trim(), Instant.now()));
        return partRepository.findById(partId).orElseThrow();
    }

    public List<StockMovement> getLedger(Long partId, String movementType) {
        List<StockMovement> list = (partId != null)
            ? stockMovementRepository.findByPartId(partId)
            : stockMovementRepository.findAll();

        if (movementType != null && !movementType.isBlank()) {
            list = list.stream()
                .filter(m -> m.movementType().name().equalsIgnoreCase(movementType.trim()))
                .toList();
        }
        return list;
    }

    public List<Part> getLowStockParts() {
        return partRepository.findLowStock();
    }

    @Transactional
    public POResponse createPO(CreatePORequest req, Long userId) {
        if (req == null || req.supplierName() == null || req.supplierName().trim().isEmpty()
            || req.lines() == null || req.lines().isEmpty()) {
            throw new ValidationException("Supplier and line items required");
        }

        for (POLineRequest line : req.lines()) {
            if (line.qtyOrdered() == null || line.qtyOrdered() <= 0
                || line.unitCost() == null || line.unitCost().signum() < 0) {
                throw new ValidationException("Quantity must be > 0 and unitCost >= 0");
            }
        }

        LocalDate expectedDate = null;
        if (req.expectedDate() != null && !req.expectedDate().isBlank()) {
            try {
                expectedDate = LocalDate.parse(req.expectedDate().trim());
            } catch (DateTimeParseException ignored) {}
        }

        String poNo = DocNo.next("PO", purchaseOrderRepository.count());
        PurchaseOrder po = new PurchaseOrder(
            null,
            poNo,
            req.supplierName().trim(),
            PurchaseOrderStatus.ORDERED,
            expectedDate,
            userId != null ? userId : 5L,
            Instant.now(),
            Instant.now()
        );
        PurchaseOrder savedPo = purchaseOrderRepository.save(po);

        List<PoLine> poLines = req.lines().stream().map(l -> new PoLine(
            null,
            savedPo.poId(),
            l.partId(),
            l.qtyOrdered(),
            0,
            l.unitCost()
        )).toList();
        poLineRepository.batchInsert(poLines);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.PO,
            savedPo.poId(),
            "DRAFT",
            "ORDERED",
            userId,
            "PO Created & Sent",
            Instant.now()
        ));

        List<PoLine> savedLines = poLineRepository.findByPoId(savedPo.poId());
        return new POResponse(savedPo, savedLines);
    }

    @Transactional
    public POResponse receivePO(Long poId, List<ReceivePOLineRequest> lines, Long userId) {
        PurchaseOrder po = purchaseOrderRepository.findById(poId)
            .orElseThrow(() -> new ResourceNotFoundException("Purchase Order not found: " + poId));

        if (lines == null || lines.isEmpty()) {
            throw new ValidationException("Lines to receive required");
        }

        for (ReceivePOLineRequest item : lines) {
            PoLine poLine = poLineRepository.findById(item.poLineId())
                .orElseThrow(() -> new ResourceNotFoundException("PO line not found: " + item.poLineId()));

            int receivedDelta = item.qtyReceived() != null ? item.qtyReceived() : 0;
            if (poLine.qtyReceived() + receivedDelta > poLine.qtyOrdered()) {
                throw new OverReceiptException("Over-receipt on line " + poLine.poLineId());
            }

            int newQtyReceived = poLine.qtyReceived() + receivedDelta;
            poLineRepository.updateQtyReceived(poLine.poLineId(), newQtyReceived);

            executeStockMovement(
                poLine.partId(),
                MovementType.RECEIPT,
                receivedDelta,
                0,
                null,
                poLine.poLineId(),
                "PO Receipt " + po.poNo(),
                userId
            );

            // FIFO Backorder Auto-Allocation
            allocateBackordersForPart(poLine.partId(), userId);
        }

        List<PoLine> allLines = poLineRepository.findByPoId(po.poId());
        boolean fullyReceived = allLines.stream().allMatch(l -> l.qtyReceived() >= l.qtyOrdered());
        boolean partiallyReceived = allLines.stream().anyMatch(l -> l.qtyReceived() > 0);

        PurchaseOrderStatus nextStatus = fullyReceived ? PurchaseOrderStatus.RECEIVED
            : (partiallyReceived ? PurchaseOrderStatus.PARTIALLY_RECEIVED : po.status());

        if (nextStatus != po.status()) {
            purchaseOrderRepository.updateStatus(po.poId(), nextStatus);
            statusLogRepository.save(new StatusLog(
                null,
                EntityType.PO,
                po.poId(),
                po.status().name(),
                nextStatus.name(),
                userId,
                "Goods Received",
                Instant.now()
            ));
        }

        PurchaseOrder updatedPo = purchaseOrderRepository.findById(po.poId()).orElseThrow();
        return new POResponse(updatedPo, allLines);
    }

    @Transactional
    public void allocateBackordersForPart(Long partId, Long userId) {
        List<PartRequest> backorders = partRequestRepository.findByPartIdAndStatus(partId, PartRequestStatus.BACKORDERED);
        if (backorders.isEmpty()) return;

        // Sort by Priority first, then FIFO by queuedAt
        backorders = backorders.stream().sorted(Comparator.comparingInt((PartRequest pr) -> {
            RepairOrder ro = getParentRepairOrder(pr);
            return (ro != null && ro.queueClass() == QueueClass.PRIORITY) ? 0 : 1;
        }).thenComparing((PartRequest pr) -> {
            RepairOrder ro = getParentRepairOrder(pr);
            return (ro != null) ? ro.queuedAt() : Instant.EPOCH;
        })).toList();

        for (PartRequest req : backorders) {
            Part part = partRepository.findById(partId).orElseThrow();
            int available = part.onHand() - part.reserved();
            if (available >= req.qty()) {
                // Whole-line reserve
                executeStockMovement(
                    partId,
                    MovementType.RESERVE,
                    0,
                    req.qty(),
                    req.requestId(),
                    null,
                    "Auto-allocated from PO receipt",
                    userId
                );
                partRequestRepository.updateStatusAndQtys(req.requestId(), PartRequestStatus.RESERVED, req.qtyIssued(), req.qtyReturned());

                // Check if all parts of repair order are now RESERVED
                RepairOrder ro = getParentRepairOrder(req);
                if (ro != null && ro.status() == RepairOrderStatus.ON_HOLD) {
                    List<Estimate> estimates = estimateRepository.findByRepairId(ro.repairId()).stream()
                        .filter(e -> e.status() == Estimate.EstimateStatus.APPROVED)
                        .toList();

                    boolean allReady = true;
                    for (Estimate est : estimates) {
                        List<EstimateLine> lines = estimateLineRepository.findByEstimateId(est.estimateId());
                        for (EstimateLine el : lines) {
                            if (el.lineType() == EstimateLine.EstimateLineType.PART) {
                                var prOpt = partRequestRepository.findByEstimateLineId(el.lineId());
                                if (prOpt.isPresent()) {
                                    PartRequestStatus st = prOpt.get().status();
                                    if (st != PartRequestStatus.RESERVED && st != PartRequestStatus.ISSUED) {
                                        allReady = false;
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    if (allReady) {
                        // Resume to QUEUED while preserving original queuedAt!
                        RepairOrderStatus prev = ro.status();
                        RepairOrder resumed = new RepairOrder(
                            ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(),
                            ro.priorityReason(), ro.queuedAt(), RepairOrderStatus.QUEUED, null, null,
                            ro.mechanicId(), ro.insurerName(), ro.claimNo(), ro.insuranceDocsReceived(),
                            ro.insuranceCoveredAmount(), ro.createdBy(), ro.createdAt(), null
                        );
                        repairOrderRepository.update(resumed);
                        statusLogRepository.save(new StatusLog(
                            null,
                            EntityType.REPAIR,
                            ro.repairId(),
                            prev.name(),
                            RepairOrderStatus.QUEUED.name(),
                            userId,
                            "All parts allocated - resumed to queue",
                            Instant.now()
                        ));
                    }
                }
            }
        }
    }

    private RepairOrder getParentRepairOrder(PartRequest pr) {
        if (pr.estimateLineId() == null) return null;
        return estimateLineRepository.findById(pr.estimateLineId())
            .flatMap(el -> estimateRepository.findById(el.estimateId()))
            .flatMap(est -> repairOrderRepository.findById(est.repairId()))
            .orElse(null);
    }

    public List<PartRequestDto> getAllRequisitions() {
        List<PartRequest> requests = partRequestRepository.findAll();
        return requests.stream()
            .map(this::toPartRequestDto)
            .toList();
    }

    public PartRequestDto toPartRequestDto(PartRequest pr) {
        Part part = partRepository.findById(pr.partId()).orElse(null);
        RepairOrder ro = getParentRepairOrder(pr);
        String reqNo = "REQ-" + (ro != null ? ro.ticketNo() : "SO") + "-" + pr.requestId();
        return new PartRequestDto(
            pr.requestId(),
            pr.requestId(),
            reqNo,
            ro != null ? ro.repairId() : null,
            pr.estimateLineId(),
            pr.saleOrderLineId(),
            pr.partId(),
            part != null ? part.sku() : "PART-" + pr.partId(),
            part != null ? part.name() : "อะไหล่",
            pr.qty(),
            pr.qty(),
            pr.qtyIssued(),
            pr.qtyReturned(),
            pr.status().name(),
            pr.createdAt()
        );
    }

    @Transactional
    public PartRequestDto createPartRequest(Long repairId, Long partId, int qty, Long userId) {
        if (qty <= 0) {
            throw new ValidationException("Requested quantity must be positive");
        }
        Part part = partRepository.findById(partId)
            .orElseThrow(() -> new ResourceNotFoundException("Part not found: " + partId));
        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        Estimate estimate = estimateRepository.findByRepairId(repairId).stream()
            .max(Comparator.comparingInt(Estimate::revisionNo))
            .orElseGet(() -> {
                Estimate newEst = new Estimate(null, repairId, 1, Estimate.EstimateStatus.APPROVED, "Auto estimate for parts requisition", userId != null ? userId : 3L, Instant.now());
                return estimateRepository.save(newEst);
            });

        EstimateLine el = new EstimateLine(null, estimate.estimateId(), EstimateLine.EstimateLineType.PART, partId, part.name(), qty, part.sellPrice());
        EstimateLine savedLine = estimateLineRepository.save(el);

        int available = part.onHand() - part.reserved();
        PartRequest.PartRequestStatus status;
        if (available >= qty) {
            status = PartRequest.PartRequestStatus.RESERVED;
            executeStockMovement(partId, MovementType.RESERVE, 0, qty, null, null, "Reserved for Repair #" + ro.ticketNo(), userId);
        } else {
            status = PartRequest.PartRequestStatus.BACKORDERED;
        }

        PartRequest pr = new PartRequest(null, savedLine.lineId(), null, partId, qty, 0, 0, status, Instant.now());
        PartRequest savedPr = partRequestRepository.save(pr);

        return toPartRequestDto(savedPr);
    }
}
