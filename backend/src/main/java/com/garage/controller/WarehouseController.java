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
import java.util.Map;

@RestController
@RequestMapping("/api")
public class WarehouseController {

    private final StockService stockService;
    private final PartRepository partRepository;
    private final AuthService authService;
    private final com.garage.repository.UserAccountRepository userAccountRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public WarehouseController(StockService stockService, PartRepository partRepository, AuthService authService,
                               com.garage.repository.UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
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

    @DeleteMapping({"/warehouse/parts/{id}", "/parts/{id}"})
    public ResponseEntity<Map<String, Object>> deletePart(@PathVariable Long id, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;
        stockService.deletePart(id, userId);
        return ResponseEntity.ok(Map.of("message", "Part " + id + " deleted"));
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
    public ResponseEntity<List<java.util.Map<String, Object>>> getLedger(
        @RequestParam(required = false) Long partId,
        @RequestParam(required = false) String movementType
    ) {
        java.util.Map<Long, Part> parts = new java.util.HashMap<>();
        java.util.Map<Long, String> users = new java.util.HashMap<>();
        List<java.util.Map<String, Object>> out = new java.util.ArrayList<>();
        for (StockMovement mv : stockService.getLedger(partId, movementType)) {
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>(mapper.convertValue(mv, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {}));
            Part part = parts.computeIfAbsent(mv.partId(), id -> partRepository.findById(id).orElse(null));
            if (part != null) { m.put("partCode", part.sku()); m.put("partName", part.name()); }
            if (mv.userId() != null) {
                String name = users.computeIfAbsent(mv.userId(), id -> userAccountRepository.findById(id).map(u -> u.fullName()).orElse(null));
                if (name != null) m.put("userName", name);
            }
            out.add(m);
        }
        return ResponseEntity.ok(out);
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
