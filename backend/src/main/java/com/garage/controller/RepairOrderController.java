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

import java.util.List;

@RestController
@RequestMapping("/api")
public class RepairOrderController {

    private final QueueService queueService;
    private final RepairOrderService repairOrderService;
    private final AuthService authService;

    public RepairOrderController(QueueService queueService, RepairOrderService repairOrderService, AuthService authService) {
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
    public ResponseEntity<RepairOrder> submitQC(@PathVariable Long id, @RequestBody QCRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 3L;
        RepairOrder ro = repairOrderService.submitQC(id, req != null ? req.passed() : null, userId);
        return ResponseEntity.ok(ro);
    }

    @GetMapping("/repairs")
    public ResponseEntity<List<RepairOrder>> getAllRepairs(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(repairOrderService.getAllRepairs(status));
    }

    @GetMapping("/repairs/{id}")
    public ResponseEntity<RepairOrder> getRepairById(@PathVariable Long id) {
        return ResponseEntity.ok(repairOrderService.getRepairById(id));
    }

    @GetMapping({"/queue", "/queue/board"})
    public ResponseEntity<List<RepairOrder>> getQueue() {
        return ResponseEntity.ok(queueService.getQueue());
    }
}
