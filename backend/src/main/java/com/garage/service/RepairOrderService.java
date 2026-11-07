package com.garage.service;

import com.garage.dto.EstimateDtos.*;
import com.garage.exception.GarageException.*;
import com.garage.util.InputValidator;
import com.garage.model.entity.*;
import com.garage.model.entity.Estimate.EstimateStatus;
import com.garage.model.entity.EstimateLine.EstimateLineType;
import com.garage.model.entity.PartRequest.PartRequestStatus;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
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
public class RepairOrderService {

    private final RepairOrderRepository repairOrderRepository;
    private final EstimateRepository estimateRepository;
    private final EstimateLineRepository estimateLineRepository;
    private final PartRepository partRepository;
    private final PartRequestRepository partRequestRepository;
    private final StatusLogRepository statusLogRepository;
    private final StockService stockService;

    public RepairOrderService(
        RepairOrderRepository repairOrderRepository,
        EstimateRepository estimateRepository,
        EstimateLineRepository estimateLineRepository,
        PartRepository partRepository,
        PartRequestRepository partRequestRepository,
        StatusLogRepository statusLogRepository,
        StockService stockService
    ) {
        this.repairOrderRepository = repairOrderRepository;
        this.estimateRepository = estimateRepository;
        this.estimateLineRepository = estimateLineRepository;
        this.partRepository = partRepository;
        this.partRequestRepository = partRequestRepository;
        this.statusLogRepository = statusLogRepository;
        this.stockService = stockService;
    }

    public List<RepairOrder> getAllRepairs(String status) {
        if (status != null && !status.isBlank()) {
            try {
                RepairOrderStatus st = RepairOrderStatus.valueOf(status.trim().toUpperCase());
                return repairOrderRepository.findByStatus(st);
            } catch (IllegalArgumentException ignored) {}
        }
        return repairOrderRepository.findAll();
    }

    public RepairOrder getRepairById(Long repairId) {
        return repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));
    }

    @Transactional
    public EstimateResponse createEstimate(CreateEstimateRequest req, Long userId) {
        if (req == null || req.repairId() == null || req.lines() == null || req.lines().isEmpty()) {
            throw new EmptyEstimateException("Repair order ID and at least one line item required");
        }

        RepairOrder ro = repairOrderRepository.findById(req.repairId())
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + req.repairId()));

        if (ro.status() != RepairOrderStatus.IN_DIAGNOSIS && ro.status() != RepairOrderStatus.IN_REPAIR) {
            throw new InvalidStatusException("Cannot draft estimate when order is in " + ro.status());
        }

        for (EstimateLineRequest l : req.lines()) {
            if (l.qty() == null || l.qty() <= 0) {
                throw new InvalidQuantityException("Line quantity must be greater than zero");
            }
            if (!"PART".equalsIgnoreCase(l.lineType())) {
                InputValidator.requireMeaningfulText(l.description(), "Labor description");
            }
            if (l.unitPrice() != null && l.unitPrice().signum() < 0) {
                throw new InvalidPriceException("Unit price cannot be negative");
            }
        }

        List<Estimate> existingEstimates = estimateRepository.findByRepairId(ro.repairId());
        int revisionNo = existingEstimates.size() + 1;

        Estimate est = new Estimate(
            null,
            ro.repairId(),
            revisionNo,
            EstimateStatus.PENDING,
            req.diagnosisNote() != null ? req.diagnosisNote() : "การตรวจเช็คระบบ",
            userId != null ? userId : 3L,
            null
        );
        Estimate savedEst = estimateRepository.save(est);

        List<EstimateLine> linesToSave = new ArrayList<>();
        for (EstimateLineRequest l : req.lines()) {
            EstimateLineType lineType = "PART".equalsIgnoreCase(l.lineType()) ? EstimateLineType.PART : EstimateLineType.LABOR;
            BigDecimal unitPrice = l.unitPrice();
            if (lineType == EstimateLineType.PART) {
                if (l.partId() == null) {
                    throw new ValidationException("partId required for PART line");
                }
                Part part = partRepository.findById(l.partId())
                    .orElseThrow(() -> new ResourceNotFoundException("Part " + l.partId() + " not found"));
                if (unitPrice == null) {
                    unitPrice = part.sellPrice();
                }
            }

            linesToSave.add(new EstimateLine(
                null,
                savedEst.estimateId(),
                lineType,
                lineType == EstimateLineType.PART ? l.partId() : null,
                l.description() != null ? l.description() : "Item description",
                l.qty(),
                unitPrice != null ? unitPrice : BigDecimal.ZERO
            ));
        }

        estimateLineRepository.batchInsert(linesToSave);

        // Repair status moves to AWAITING_APPROVAL
        RepairOrderStatus fromStatus = ro.status();
        RepairOrder updatedRo = new RepairOrder(
            ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(), ro.priorityReason(),
            ro.queuedAt(), RepairOrderStatus.AWAITING_APPROVAL, ro.holdReason(), ro.bayId(), ro.mechanicId(),
            ro.insurerName(), ro.claimNo(), ro.insuranceDocsReceived(), ro.insuranceCoveredAmount(), ro.createdBy(),
            ro.createdAt(), ro.closedAt()
        );
        repairOrderRepository.update(updatedRo);

        statusLogRepository.save(new StatusLog(
            null, EntityType.ESTIMATE, savedEst.estimateId(), "DRAFT", "PENDING", userId,
            "Drafted Revision " + revisionNo, Instant.now()
        ));
        statusLogRepository.save(new StatusLog(
            null, EntityType.REPAIR, ro.repairId(), fromStatus.name(), RepairOrderStatus.AWAITING_APPROVAL.name(), userId,
            "Awaiting Approval Rev " + revisionNo, Instant.now()
        ));

        List<EstimateLine> savedLines = estimateLineRepository.findByEstimateId(savedEst.estimateId());
        return new EstimateResponse(savedEst, savedLines);
    }

    @Transactional
    public EstimateDecisionResponse processEstimateDecision(Long estimateId, String decision, Boolean insuranceDocsReceived, Long userId) {
        Estimate est = estimateRepository.findById(estimateId)
            .orElseThrow(() -> new ResourceNotFoundException("Estimate not found: " + estimateId));
        RepairOrder ro = repairOrderRepository.findById(est.repairId())
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + est.repairId()));

        if (!"APPROVED".equalsIgnoreCase(decision) && !"DECLINED".equalsIgnoreCase(decision)) {
            throw new ValidationException("Decision must be APPROVED or DECLINED");
        }

        // State Machine Guards
        if (ro.status() == RepairOrderStatus.COMPLETED || ro.status() == RepairOrderStatus.CANCELLED) {
            throw new InvalidStatusException("Cannot decide estimate for " + ro.status() + " repair order");
        }
        if (ro.status() != RepairOrderStatus.AWAITING_APPROVAL && ro.status() != RepairOrderStatus.IN_DIAGNOSIS) {
            throw new InvalidStatusException("Repair order must be awaiting approval or in diagnosis to decide estimate, current status is " + ro.status());
        }
        if (est.status() != EstimateStatus.PENDING) {
            throw new InvalidStatusException("Estimate is already decided: " + est.status());
        }

        if ("APPROVED".equalsIgnoreCase(decision)) {
            // Insurance Gatekeeper Check
            boolean docs = insuranceDocsReceived != null ? insuranceDocsReceived : ro.insuranceDocsReceived();
            if (ro.insurerName() != null && !ro.insurerName().isBlank()) {
                if (!docs) {
                    throw new InsuranceDocsMissingException("Insurance claim requires documents received before approval");
                }
            }

            estimateRepository.updateStatus(est.estimateId(), EstimateStatus.APPROVED);
            statusLogRepository.save(new StatusLog(
                null, EntityType.ESTIMATE, est.estimateId(), "PENDING", "APPROVED", userId,
                "Customer Approved", Instant.now()
            ));

            // Whole-line stock reservation
            List<EstimateLine> lines = estimateLineRepository.findByEstimateId(est.estimateId()).stream()
                .filter(l -> l.lineType() == EstimateLineType.PART)
                .toList();

            boolean hasBackorder = false;
            for (EstimateLine line : lines) {
                Part part = partRepository.findById(line.partId()).orElseThrow();
                int available = part.onHand() - part.reserved();

                PartRequestStatus reqStatus = PartRequestStatus.RESERVED;
                if (available < line.qty()) {
                    reqStatus = PartRequestStatus.BACKORDERED;
                    hasBackorder = true;
                } else {
                    stockService.executeStockMovement(
                        part.partId(), MovementType.RESERVE, 0, line.qty(),
                        null, null, "Reserved for Repair #" + ro.ticketNo(), userId
                    );
                }

                PartRequest pr = new PartRequest(
                    null, line.lineId(), null, line.partId(), line.qty(), 0, 0, reqStatus, Instant.now()
                );
                partRequestRepository.save(pr);
            }

            RepairOrderStatus fromStatus = ro.status();
            RepairOrderStatus targetStatus;
            String holdReason = null;
            Long bayId = ro.bayId();

            if (hasBackorder) {
                targetStatus = RepairOrderStatus.ON_HOLD;
                holdReason = "WAITING_PARTS";
                bayId = null; // Bay released when on hold!
            } else {
                targetStatus = RepairOrderStatus.IN_REPAIR;
            }

            RepairOrder updatedRo = new RepairOrder(
                ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(), ro.priorityReason(),
                ro.queuedAt(), targetStatus, holdReason, bayId, ro.mechanicId(), ro.insurerName(), ro.claimNo(),
                docs, ro.insuranceCoveredAmount(), ro.createdBy(), ro.createdAt(), ro.closedAt()
            );
            repairOrderRepository.update(updatedRo);

            statusLogRepository.save(new StatusLog(
                null, EntityType.REPAIR, ro.repairId(), fromStatus.name(), targetStatus.name(), userId,
                hasBackorder ? "Holding for Backordered Parts" : "All Parts Reserved - In Repair", Instant.now()
            ));

            return new EstimateDecisionResponse(estimateRepository.findById(estimateId).orElseThrow(), updatedRo);
        } else {
            // DECLINED
            estimateRepository.updateStatus(est.estimateId(), EstimateStatus.DECLINED);
            statusLogRepository.save(new StatusLog(
                null, EntityType.ESTIMATE, est.estimateId(), "PENDING", "DECLINED", userId,
                "Customer Declined", Instant.now()
            ));

            RepairOrderStatus targetStatus;
            Long bayId = ro.bayId();
            if (est.revisionNo() == 1) {
                targetStatus = RepairOrderStatus.CANCELLED;
                bayId = null; // Bay released
            } else {
                targetStatus = RepairOrderStatus.IN_REPAIR; // Return to previous approved scope
            }

            RepairOrder updatedRo = new RepairOrder(
                ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(), ro.priorityReason(),
                ro.queuedAt(), targetStatus, ro.holdReason(), bayId, ro.mechanicId(), ro.insurerName(), ro.claimNo(),
                ro.insuranceDocsReceived(), ro.insuranceCoveredAmount(), ro.createdBy(), ro.createdAt(), ro.closedAt()
            );
            repairOrderRepository.update(updatedRo);

            statusLogRepository.save(new StatusLog(
                null, EntityType.REPAIR, ro.repairId(), ro.status().name(), targetStatus.name(), userId,
                est.revisionNo() == 1 ? "Revision 1 Declined" : "Revision " + est.revisionNo() + " Declined, returning to previous scope",
                Instant.now()
            ));

            return new EstimateDecisionResponse(estimateRepository.findById(estimateId).orElseThrow(), updatedRo);
        }
    }

    @Transactional
    public EstimateDecisionResponse processRepairApproval(Long repairId, String decision, Boolean insuranceDocsReceived, Long userId) {
        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        if (ro.status() == RepairOrderStatus.COMPLETED || ro.status() == RepairOrderStatus.CANCELLED) {
            throw new InvalidStatusException("Cannot approve " + ro.status() + " repair order");
        }
        if (ro.status() != RepairOrderStatus.AWAITING_APPROVAL && ro.status() != RepairOrderStatus.IN_DIAGNOSIS) {
            throw new InvalidStatusException("Repair order must be awaiting approval or in diagnosis to approve, current status is " + ro.status());
        }

        Estimate target = estimateRepository.findByRepairId(repairId).stream()
            .filter(e -> e.status() == EstimateStatus.PENDING)
            .max(java.util.Comparator.comparingInt(Estimate::revisionNo))
            .or(() -> estimateRepository.findLatestRevision(repairId))
            .orElseThrow(() -> new ResourceNotFoundException("Estimate not found for repair: " + repairId));

        return processEstimateDecision(target.estimateId(), decision, insuranceDocsReceived, userId);
    }

    @Transactional
    public RepairOrder updateRepairStatus(Long repairId, String statusStr, String note, Long userId) {
        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        if (ro.status() == RepairOrderStatus.COMPLETED || ro.status() == RepairOrderStatus.CANCELLED) {
            throw new InvalidStatusException("Cannot update status of " + ro.status() + " repair order");
        }

        RepairOrderStatus targetStatus;
        try {
            targetStatus = RepairOrderStatus.valueOf(statusStr);
        } catch (IllegalArgumentException e) {
            if ("QC_PENDING".equals(statusStr)) {
                targetStatus = RepairOrderStatus.QC;
            } else {
                throw new ValidationException("Invalid status: " + statusStr);
            }
        }

        if (ro.status() == targetStatus) {
            return ro;
        }

        if (targetStatus == RepairOrderStatus.QC && ro.status() != RepairOrderStatus.IN_REPAIR) {
            throw new InvalidStatusException("Cannot move to QC from " + ro.status());
        }
        if (targetStatus == RepairOrderStatus.IN_REPAIR && ro.status() != RepairOrderStatus.ON_HOLD && ro.status() != RepairOrderStatus.QC) {
            throw new InvalidStatusException("Cannot transition to IN_REPAIR from " + ro.status());
        }

        RepairOrderStatus fromStatus = ro.status();
        Long bayId = ro.bayId();
        if (targetStatus == RepairOrderStatus.AWAITING_PAYMENT || targetStatus == RepairOrderStatus.COMPLETED || targetStatus == RepairOrderStatus.CANCELLED) {
            bayId = null;
        }

        RepairOrder updated = new RepairOrder(
            ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(), ro.priorityReason(),
            ro.queuedAt(), targetStatus, ro.holdReason(), bayId, ro.mechanicId(), ro.insurerName(), ro.claimNo(),
            ro.insuranceDocsReceived(), ro.insuranceCoveredAmount(), ro.createdBy(), ro.createdAt(),
            targetStatus == RepairOrderStatus.COMPLETED ? Instant.now() : ro.closedAt()
        );
        repairOrderRepository.update(updated);

        statusLogRepository.save(new StatusLog(
            null, EntityType.REPAIR, ro.repairId(), fromStatus.name(), targetStatus.name(), userId,
            note != null ? note : ("Status changed to " + targetStatus.name()), Instant.now()
        ));

        return updated;
    }

    @Transactional
    public RepairOrder submitQC(Long repairId, Boolean passed, Long userId) {
        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        if (ro.status() != RepairOrderStatus.IN_REPAIR && ro.status() != RepairOrderStatus.QC) {
            throw new InvalidStatusException("Cannot submit QC from status " + ro.status());
        }

        if (passed == null) {
            throw new ValidationException("QC result (passed: true/false) required");
        }

        if (passed) {
            // Guard: all part requests must be ISSUED, RETURNED, or CANCELLED
            List<Estimate> approvedEstimates = estimateRepository.findByRepairId(ro.repairId()).stream()
                .filter(e -> e.status() == EstimateStatus.APPROVED)
                .toList();

            for (Estimate est : approvedEstimates) {
                List<EstimateLine> lines = estimateLineRepository.findByEstimateId(est.estimateId());
                for (EstimateLine el : lines) {
                    if (el.lineType() == EstimateLineType.PART) {
                        var prOpt = partRequestRepository.findByEstimateLineId(el.lineId());
                        if (prOpt.isPresent()) {
                            PartRequestStatus st = prOpt.get().status();
                            if (st != PartRequestStatus.ISSUED && st != PartRequestStatus.RETURNED && st != PartRequestStatus.CANCELLED) {
                                throw new PendingPartRequestException("All parts must be issued before passing QC");
                            }
                        }
                    }
                }
            }

            RepairOrder updatedRo = new RepairOrder(
                ro.repairId(), ro.ticketNo(), ro.vehicleId(), ro.complaint(), ro.queueClass(), ro.priorityReason(),
                ro.queuedAt(), RepairOrderStatus.AWAITING_PAYMENT, null, null, // Bay is released!
                ro.mechanicId(), ro.insurerName(), ro.claimNo(), ro.insuranceDocsReceived(), ro.insuranceCoveredAmount(),
                ro.createdBy(), ro.createdAt(), ro.closedAt()
            );
            repairOrderRepository.update(updatedRo);

            statusLogRepository.save(new StatusLog(
                null, EntityType.REPAIR, ro.repairId(), ro.status().name(), "QC", userId, "QC Passed", Instant.now()
            ));
            statusLogRepository.save(new StatusLog(
                null, EntityType.REPAIR, ro.repairId(), "QC", "AWAITING_PAYMENT", userId,
                "Bay Released, Awaiting Payment", Instant.now()
            ));

            return updatedRo;
        } else {
            // QC Failed - Rework Required
            statusLogRepository.save(new StatusLog(
                null, EntityType.REPAIR, ro.repairId(), ro.status().name(), "IN_REPAIR", userId,
                "QC Failed - Rework Required", Instant.now()
            ));
            return ro;
        }
    }
}
