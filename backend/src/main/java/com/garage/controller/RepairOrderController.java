package com.garage.controller;

import com.garage.dto.RepairDtos.*;
import com.garage.model.entity.RepairOrder;
import com.garage.model.entity.UserAccount;
import com.garage.service.AuthService;
import com.garage.service.QueueService;
import com.garage.service.RepairOrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.garage.model.entity.Customer;
import com.garage.model.entity.Vehicle;
import com.garage.repository.CustomerRepository;
import com.garage.repository.VehicleRepository;
import com.garage.repository.EstimateLineRepository;
import com.garage.repository.EstimateRepository;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class RepairOrderController {

    private final QueueService queueService;
    private final RepairOrderService repairOrderService;
    private final AuthService authService;

    private final VehicleRepository vehicleRepository;
    private final CustomerRepository customerRepository;
    private final EstimateRepository estimateRepository;
    private final EstimateLineRepository estimateLineRepository;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    /** Adds customer / vehicle display fields to a repair order (read model for UI). */
    private Map<String, Object> view(RepairOrder ro) {
        Map<String, Object> m = new LinkedHashMap<>(mapper.convertValue(ro, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}));
        Vehicle v = ro.vehicleId() == null ? null : vehicleRepository.findById(ro.vehicleId()).orElse(null);
        if (v != null) {
            m.put("licensePlate", v.plate());
            m.put("vehicleModel", ((v.make() == null ? "" : v.make()) + " " + (v.model() == null ? "" : v.model())).trim());
            Customer c = v.customerId() == null ? null : customerRepository.findById(v.customerId()).orElse(null);
            if (c != null) {
                m.put("customerId", c.customerId());
                m.put("customerName", c.name());
                m.put("customerPhone", c.phone());
            }
        }
        BigDecimal labor = BigDecimal.ZERO, parts = BigDecimal.ZERO;
        var est = estimateRepository.findLatestRevision(ro.repairId()).orElse(null);
        if (est != null) {
            for (var l : estimateLineRepository.findByEstimateId(est.estimateId())) {
                BigDecimal amt = l.unitPrice().multiply(BigDecimal.valueOf(l.qty()));
                if (l.lineType() == com.garage.model.entity.EstimateLine.EstimateLineType.LABOR) labor = labor.add(amt); else parts = parts.add(amt);
            }
        }
        m.put("laborTotal", labor);
        m.put("partsTotal", parts);
        m.put("subtotal", labor.add(parts));
        return m;
    }

    public RepairOrderController(QueueService queueService, RepairOrderService repairOrderService, AuthService authService,
                                 VehicleRepository vehicleRepository, CustomerRepository customerRepository,
                                 EstimateRepository estimateRepository, EstimateLineRepository estimateLineRepository) {
        this.estimateRepository = estimateRepository;
        this.estimateLineRepository = estimateLineRepository;
        this.vehicleRepository = vehicleRepository;
        this.customerRepository = customerRepository;
        this.queueService = queueService;
        this.repairOrderService = repairOrderService;
        this.authService = authService;
    }

    private UserAccount resolveUser(HttpServletRequest request) {
        UserAccount user = (UserAccount) request.getAttribute("currentUser");
        if (user == null) {
            String header = request.getHeader("Authorization");
            user = authService.resolveUserFromToken(header);
        }
        return user;
    }

    @PostMapping({"/repairs", "/queue/check-in"})
    public ResponseEntity<RepairOrder> checkin(@RequestBody RegisterRepairRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        RepairOrder ro = queueService.checkin(req, userId);
        return ResponseEntity.ok(ro);
    }

    @PostMapping({"/repairs/queue/call-next", "/queue/call-next"})
    public ResponseEntity<RepairOrder> callNext(@RequestBody CallNextRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        RepairOrder ro = queueService.callNext(req.bayId(), req.mechanicId(), userId);
        return ResponseEntity.ok(ro);
    }

    @PostMapping("/repairs/{id}/hold")
    public ResponseEntity<RepairOrder> holdRepair(@PathVariable Long id, @RequestBody(required = false) HoldRepairRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        String reason = req != null ? req.holdReason() : null;
        RepairOrder ro = queueService.holdRepair(id, reason, userId);
        return ResponseEntity.ok(ro);
    }

    @PostMapping("/repairs/{id}/cancel")
    public ResponseEntity<RepairOrder> cancelRepair(@PathVariable Long id, @RequestBody(required = false) CancelRepairRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        String reason = req != null ? req.reason() : null;
        RepairOrder ro = queueService.cancelRepair(id, reason, userId);
        return ResponseEntity.ok(ro);
    }

    @PostMapping("/repairs/{id}/priority-override")
    public ResponseEntity<RepairOrder> overridePriority(@PathVariable Long id, @RequestBody PriorityOverrideRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        RepairOrder ro = queueService.overridePriority(id, req != null ? req.priorityReason() : null, user);
        return ResponseEntity.ok(ro);
    }

    @PostMapping({"/repairs/{id}/qc", "/repairs/{id}/qc-complete"})
    public ResponseEntity<RepairOrder> submitQC(@PathVariable Long id, @RequestBody(required = false) QCRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 3L;
        RepairOrder ro = repairOrderService.submitQC(id, req != null ? req.passed() : true, userId);
        return ResponseEntity.ok(ro);
    }

    @PostMapping("/repairs/{id}/status")
    public ResponseEntity<RepairOrder> updateStatus(
        @PathVariable Long id,
        @RequestBody(required = false) UpdateRepairStatusRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        String statusStr = req != null && req.status() != null ? req.status().trim().toUpperCase() : "";
        String note = req != null ? req.note() : null;

        if ("ON_HOLD".equals(statusStr)) {
            return ResponseEntity.ok(queueService.holdRepair(id, note, userId));
        } else if ("CANCELLED".equals(statusStr)) {
            return ResponseEntity.ok(queueService.cancelRepair(id, note, userId));
        } else if ("AWAITING_PAYMENT".equals(statusStr)) {
            return ResponseEntity.ok(repairOrderService.submitQC(id, true, userId));
        } else {
            return ResponseEntity.ok(repairOrderService.updateRepairStatus(id, statusStr, note, userId));
        }
    }

    @GetMapping("/repairs")
    public ResponseEntity<List<Map<String, Object>>> getAllRepairs(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(repairOrderService.getAllRepairs(status).stream().map(this::view).toList());
    }

    @GetMapping("/repairs/{id}")
    public ResponseEntity<Map<String, Object>> getRepairById(@PathVariable Long id) {
        return ResponseEntity.ok(view(repairOrderService.getRepairById(id)));
    }

    @GetMapping({"/queue", "/queue/board"})
    public ResponseEntity<List<Map<String, Object>>> getQueue() {
        return ResponseEntity.ok(queueService.getQueue().stream().map(this::view).toList());
    }
}
