package com.garage.controller;

import com.garage.dto.EstimateDtos.*;
import com.garage.model.entity.UserAccount;
import com.garage.service.AuthService;
import com.garage.service.RepairOrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class EstimateController {

    private final RepairOrderService repairOrderService;
    private final AuthService authService;

    public EstimateController(RepairOrderService repairOrderService, AuthService authService) {
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

    @PostMapping("/estimates")
    public ResponseEntity<EstimateResponse> createEstimate(@RequestBody CreateEstimateRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 3L;
        EstimateResponse response = repairOrderService.createEstimate(req, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/estimates/{id}/decision")
    public ResponseEntity<EstimateDecisionResponse> decideEstimate(
        @PathVariable Long id,
        @RequestBody(required = false) EstimateDecisionRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        String decision = req != null && req.decision() != null ? req.decision() : "APPROVED";
        Boolean docsReceived = req != null ? req.insuranceDocsReceived() : null;
        EstimateDecisionResponse response = repairOrderService.processEstimateDecision(id, decision, docsReceived, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/repairs/{id}/approve")
    public ResponseEntity<EstimateDecisionResponse> approveRepair(
        @PathVariable Long id,
        @RequestBody(required = false) EstimateDecisionRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        String decision = req != null && req.decision() != null ? req.decision() : "APPROVED";
        Boolean docsReceived = req != null ? req.insuranceDocsReceived() : null;
        EstimateDecisionResponse response = repairOrderService.processRepairApproval(id, decision, docsReceived, userId);
        return ResponseEntity.ok(response);
    }
}
