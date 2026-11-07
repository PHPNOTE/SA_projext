package com.garage.service;

import com.garage.util.DocNo;
import com.garage.dto.RepairDtos.RegisterRepairRequest;
import com.garage.exception.GarageException.*;
import com.garage.model.entity.*;
import com.garage.model.entity.PartRequest.PartRequestStatus;
import com.garage.model.entity.RepairOrder.QueueClass;
import com.garage.model.entity.RepairOrder.RepairOrderStatus;
import com.garage.model.entity.StatusLog.EntityType;
import com.garage.model.entity.StockMovement.MovementType;
import com.garage.model.entity.UserAccount.UserRole;
import com.garage.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class QueueService {

    private final RepairOrderRepository repairOrderRepository;
    private final CustomerRepository customerRepository;
    private final VehicleRepository vehicleRepository;
    private final RepairBayRepository repairBayRepository;
    private final EstimateRepository estimateRepository;
    private final EstimateLineRepository estimateLineRepository;
    private final PartRequestRepository partRequestRepository;
    private final StatusLogRepository statusLogRepository;
    private final StockService stockService;

    public QueueService(
        RepairOrderRepository repairOrderRepository,
        CustomerRepository customerRepository,
        VehicleRepository vehicleRepository,
        RepairBayRepository repairBayRepository,
        EstimateRepository estimateRepository,
        EstimateLineRepository estimateLineRepository,
        PartRequestRepository partRequestRepository,
        StatusLogRepository statusLogRepository,
        StockService stockService
    ) {
        this.repairOrderRepository = repairOrderRepository;
        this.customerRepository = customerRepository;
        this.vehicleRepository = vehicleRepository;
        this.repairBayRepository = repairBayRepository;
        this.estimateRepository = estimateRepository;
        this.estimateLineRepository = estimateLineRepository;
        this.partRequestRepository = partRequestRepository;
        this.statusLogRepository = statusLogRepository;
        this.stockService = stockService;
    }

    @Transactional
    public RepairOrder checkin(RegisterRepairRequest req, Long userId) {
        if (req == null || req.customerPhone() == null || req.customerPhone().trim().isEmpty()
            || req.customerName() == null || req.customerName().trim().isEmpty()) {
            throw new ValidationException("Customer name and phone required");
        }
        if (req.licensePlate() == null || req.licensePlate().trim().isEmpty()) {
            throw new ValidationException("License plate required");
        }
        if ("PRIORITY".equalsIgnoreCase(req.queueClass())
            && (req.priorityReason() == null || req.priorityReason().trim().isEmpty())) {
            throw new ValidationException("Priority reason mandatory for PRIORITY queue");
        }

        String phone = req.customerPhone().trim();
        String name = req.customerName().trim();
        String plate = req.licensePlate().trim();

        Customer customer = customerRepository.findByPhone(phone).orElseGet(() -> {
            Customer newCust = new Customer(null, name, phone, req.customerNote());
            return customerRepository.save(newCust);
        });

        Vehicle vehicle = vehicleRepository.findByPlate(plate).orElseGet(() -> {
            Vehicle newVeh = new Vehicle(
                null,
                customer.customerId(),
                plate,
                req.make() != null ? req.make() : "Toyota",
                req.model() != null ? req.model() : "Unknown",
                req.year() != null ? req.year() : 2022
            );
            return vehicleRepository.save(newVeh);
        });

        // Verify active repair order duplicate constraint
        List<RepairOrder> activeOrders = repairOrderRepository.findAll().stream()
            .filter(r -> r.vehicleId().equals(vehicle.vehicleId())
                && r.status() != RepairOrderStatus.COMPLETED
                && r.status() != RepairOrderStatus.CANCELLED)
            .toList();

        if (!activeOrders.isEmpty()) {
            throw new DuplicateTicketException("Active repair order already exists for vehicle");
        }

        Instant queuedAt = Instant.now();
        if (req.queuedAt() != null && !req.queuedAt().isBlank()) {
            try {
                queuedAt = Instant.parse(req.queuedAt().trim());
            } catch (DateTimeParseException ignored) {}
        }

        QueueClass queueClass = "PRIORITY".equalsIgnoreCase(req.queueClass()) ? QueueClass.PRIORITY : QueueClass.NORMAL;
        String priorityReason = (queueClass == QueueClass.PRIORITY) ? req.priorityReason().trim() : null;
        BigDecimal insuranceCovered = req.insuranceCoveredAmount() != null ? req.insuranceCoveredAmount() : BigDecimal.ZERO;
        boolean docsReceived = Boolean.TRUE.equals(req.insuranceDocsReceived());

        String ticketNo = DocNo.next("RO", repairOrderRepository.count());
        RepairOrder ro = new RepairOrder(
            null,
            ticketNo,
            vehicle.vehicleId(),
            req.complaint() != null ? req.complaint() : "ตรวจเช็คตามระยะ",
            queueClass,
            priorityReason,
            queuedAt,
            RepairOrderStatus.QUEUED,
            null,
            null,
            null,
            req.insurerName(),
            req.claimNo(),
            docsReceived,
            insuranceCovered,
            userId != null ? userId : 2L,
            Instant.now(),
            null
        );

        RepairOrder saved = repairOrderRepository.save(ro);
        statusLogRepository.save(new StatusLog(
            null,
            EntityType.REPAIR,
            saved.repairId(),
            null,
            "QUEUED",
            userId,
            "Registered & Queued",
            Instant.now()
        ));

        return saved;
    }

    @Transactional
    public RepairOrder callNext(Long bayId, Long mechanicId, Long userId) {
        if (bayId == null || mechanicId == null) {
            throw new ValidationException("bayId and mechanicId required");
        }

        if (repairBayRepository.isBayOccupied(bayId)) {
            throw new NoFreeBayException("Selected bay is currently occupied by active job");
        }

        RepairOrder chosen = repairOrderRepository.findNextQueuedForUpdate()
            .orElseThrow(() -> new EmptyQueueException("Queue is currently empty"));

        RepairOrderStatus fromStatus = chosen.status();

        // Check if resuming an approved job whose parts are all reserved
        boolean hasApprovedLines = estimateRepository.findByRepairId(chosen.repairId()).stream()
            .filter(e -> e.status() == Estimate.EstimateStatus.APPROVED)
            .anyMatch(e -> !estimateLineRepository.findByEstimateId(e.estimateId()).isEmpty());

        RepairOrderStatus targetStatus = hasApprovedLines ? RepairOrderStatus.IN_REPAIR : RepairOrderStatus.IN_DIAGNOSIS;

        RepairOrder updated = new RepairOrder(
            chosen.repairId(),
            chosen.ticketNo(),
            chosen.vehicleId(),
            chosen.complaint(),
            chosen.queueClass(),
            chosen.priorityReason(),
            chosen.queuedAt(),
            targetStatus,
            null,
            bayId,
            mechanicId,
            chosen.insurerName(),
            chosen.claimNo(),
            chosen.insuranceDocsReceived(),
            chosen.insuranceCoveredAmount(),
            chosen.createdBy(),
            chosen.createdAt(),
            chosen.closedAt()
        );
        repairOrderRepository.update(updated);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.REPAIR,
            chosen.repairId(),
            fromStatus.name(),
            targetStatus.name(),
            userId,
            "Called next: Bay " + bayId,
            Instant.now()
        ));

        return updated;
    }

    @Transactional
    public RepairOrder holdRepair(Long repairId, String holdReason, Long userId) {
        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        if (ro.status() != RepairOrderStatus.IN_DIAGNOSIS
            && ro.status() != RepairOrderStatus.AWAITING_APPROVAL
            && ro.status() != RepairOrderStatus.IN_REPAIR) {
            throw new InvalidStatusException("Cannot hold from status " + ro.status());
        }

        RepairOrderStatus fromStatus = ro.status();
        RepairOrder updated = new RepairOrder(
            ro.repairId(),
            ro.ticketNo(),
            ro.vehicleId(),
            ro.complaint(),
            ro.queueClass(),
            ro.priorityReason(),
            ro.queuedAt(),
            RepairOrderStatus.ON_HOLD,
            holdReason != null ? holdReason : "WAITING_PARTS",
            null, // Bay released!
            ro.mechanicId(),
            ro.insurerName(),
            ro.claimNo(),
            ro.insuranceDocsReceived(),
            ro.insuranceCoveredAmount(),
            ro.createdBy(),
            ro.createdAt(),
            ro.closedAt()
        );
        repairOrderRepository.update(updated);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.REPAIR,
            ro.repairId(),
            fromStatus.name(),
            RepairOrderStatus.ON_HOLD.name(),
            userId,
            updated.holdReason(),
            Instant.now()
        ));

        return updated;
    }

    @Transactional
    public RepairOrder cancelRepair(Long repairId, String reason, Long userId) {
        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        if (ro.status() == RepairOrderStatus.COMPLETED || ro.status() == RepairOrderStatus.CANCELLED) {
            throw new InvalidStatusException("Order already finished");
        }

        RepairOrderStatus fromStatus = ro.status();

        // Release any reserved stock
        List<Estimate> estimates = estimateRepository.findByRepairId(ro.repairId());
        for (Estimate est : estimates) {
            List<EstimateLine> lines = estimateLineRepository.findByEstimateId(est.estimateId());
            for (EstimateLine line : lines) {
                partRequestRepository.findByEstimateLineId(line.lineId()).ifPresent(pr -> {
                    if (pr.status() == PartRequestStatus.RESERVED) {
                        stockService.executeStockMovement(
                            pr.partId(),
                            MovementType.RELEASE,
                            0,
                            -pr.qty(),
                            pr.requestId(),
                            null,
                            "Repair Order Cancelled",
                            userId
                        );
                        partRequestRepository.updateStatusAndQtys(pr.requestId(), PartRequestStatus.CANCELLED, pr.qtyIssued(), pr.qtyReturned());
                    }
                });
            }
        }

        RepairOrder updated = new RepairOrder(
            ro.repairId(),
            ro.ticketNo(),
            ro.vehicleId(),
            ro.complaint(),
            ro.queueClass(),
            ro.priorityReason(),
            ro.queuedAt(),
            RepairOrderStatus.CANCELLED,
            ro.holdReason(),
            null, // Bay released!
            ro.mechanicId(),
            ro.insurerName(),
            ro.claimNo(),
            ro.insuranceDocsReceived(),
            ro.insuranceCoveredAmount(),
            ro.createdBy(),
            ro.createdAt(),
            ro.closedAt()
        );
        repairOrderRepository.update(updated);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.REPAIR,
            ro.repairId(),
            fromStatus.name(),
            RepairOrderStatus.CANCELLED.name(),
            userId,
            reason != null ? reason : "Cancelled",
            Instant.now()
        ));

        return updated;
    }

    @Transactional
    public RepairOrder overridePriority(Long repairId, String priorityReason, UserAccount currentUser) {
        if (currentUser == null || currentUser.role() != UserRole.MANAGER) {
            throw new AccessDeniedException("Only MANAGER can override queue priority");
        }
        if (priorityReason == null || priorityReason.trim().isEmpty()) {
            throw new ValidationException("Priority reason required");
        }

        RepairOrder ro = repairOrderRepository.findById(repairId)
            .orElseThrow(() -> new ResourceNotFoundException("Repair order not found: " + repairId));

        if (ro.status() == RepairOrderStatus.COMPLETED || ro.status() == RepairOrderStatus.CANCELLED) {
            throw new InvalidStatusException("Cannot override priority for " + ro.status() + " repair order");
        }

        RepairOrder updated = new RepairOrder(
            ro.repairId(),
            ro.ticketNo(),
            ro.vehicleId(),
            ro.complaint(),
            QueueClass.PRIORITY,
            priorityReason.trim(),
            ro.queuedAt(),
            ro.status(),
            ro.holdReason(),
            ro.bayId(),
            ro.mechanicId(),
            ro.insurerName(),
            ro.claimNo(),
            ro.insuranceDocsReceived(),
            ro.insuranceCoveredAmount(),
            ro.createdBy(),
            ro.createdAt(),
            ro.closedAt()
        );
        repairOrderRepository.update(updated);

        statusLogRepository.save(new StatusLog(
            null,
            EntityType.REPAIR,
            ro.repairId(),
            ro.status().name(),
            ro.status().name(),
            currentUser.userId(),
            "Priority Override: " + priorityReason.trim(),
            Instant.now()
        ));

        return updated;
    }

    public List<RepairOrder> getQueue() {
        return repairOrderRepository.findByStatus(RepairOrderStatus.QUEUED);
    }
}
