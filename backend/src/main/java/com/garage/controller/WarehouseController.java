package com.garage.controller;

import com.garage.dto.WarehouseDtos.*;
import com.garage.model.entity.Part;
import com.garage.model.entity.StockMovement;
import com.garage.model.entity.UserAccount;
import com.garage.repository.PartRepository;
import com.garage.service.AuthService;
import com.garage.service.StockService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class WarehouseController {

    private final StockService stockService;
    private final PartRepository partRepository;
    private final AuthService authService;

    public WarehouseController(StockService stockService, PartRepository partRepository, AuthService authService) {
        this.stockService = stockService;
        this.partRepository = partRepository;
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

    @PostMapping({"/warehouse/parts", "/parts"})
    public ResponseEntity<Part> upsertPart(@RequestBody PartUpsertRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;

        boolean exists = req != null && req.sku() != null && partRepository.findBySku(req.sku().trim()).isPresent();
        Part part = stockService.upsertPart(req, userId);
        return ResponseEntity.status(exists ? HttpStatus.OK : HttpStatus.CREATED).body(part);
    }

    @GetMapping({"/warehouse/parts", "/parts"})
    public ResponseEntity<List<Part>> getAllParts() {
        return ResponseEntity.ok(partRepository.findAllActive());
    }

    @GetMapping("/parts/{id}")
    public ResponseEntity<Part> getPartById(@PathVariable Long id) {
        return partRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping({"/warehouse/issue", "/requisitions/issue", "/requisitions/{id}/issue"})
    public ResponseEntity<IssuePartResponse> issuePart(
        @PathVariable(required = false) Long id,
        @RequestBody(required = false) IssuePartRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;
        Long requestId = id != null ? id : (req != null ? req.requestId() : null);
        IssuePartResponse response = stockService.issuePart(requestId, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/warehouse/return", "/requisitions/return", "/requisitions/{id}/return"})
    public ResponseEntity<ReturnPartResponse> returnPart(
        @PathVariable(required = false) Long id,
        @RequestBody(required = false) ReturnPartRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;
        Long requestId = id != null ? id : (req != null ? req.requestId() : null);
        int qty = req != null && req.qty() != null ? req.qty() : 1;
        ReturnPartResponse response = stockService.returnPart(requestId, qty, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/warehouse/adjust", "/inventory/adjust", "/inventory/audit-adjust"})
    public ResponseEntity<Part> adjustStock(@RequestBody StockAdjustRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;
        Part part = stockService.adjustStock(
            req != null ? req.partId() : null,
            req != null && req.delta() != null ? req.delta() : 0,
            req != null ? req.reason() : null,
            userId
        );
        return ResponseEntity.ok(part);
    }

    @GetMapping({"/warehouse/ledger", "/inventory/ledger", "/inventory/movements"})
    public ResponseEntity<List<StockMovement>> getLedger(
        @RequestParam(required = false) Long partId,
        @RequestParam(required = false) String movementType
    ) {
        return ResponseEntity.ok(stockService.getLedger(partId, movementType));
    }

    @GetMapping({"/warehouse/low-stock", "/parts/low-stock"})
    public ResponseEntity<List<Part>> getLowStock() {
        return ResponseEntity.ok(stockService.getLowStockParts());
    }

    @GetMapping({"/requisitions", "/warehouse/requisitions", "/warehouse/requests"})
    public ResponseEntity<List<PartRequestDto>> getRequisitions() {
        return ResponseEntity.ok(stockService.getAllRequisitions());
    }

    @PostMapping({"/requisitions", "/warehouse/requisitions"})
    public ResponseEntity<PartRequestDto> createRequisition(
        @RequestBody CreatePartRequestInput req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 3L;
        PartRequestDto dto = stockService.createPartRequest(
            req != null ? req.repairId() : null,
            req != null ? req.partId() : null,
            req != null && req.qty() != null ? req.qty() : 1,
            userId
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }
}
