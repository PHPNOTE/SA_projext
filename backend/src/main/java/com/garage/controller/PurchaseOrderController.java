package com.garage.controller;

import com.garage.dto.WarehouseDtos.CreatePORequest;
import com.garage.dto.WarehouseDtos.POResponse;
import com.garage.dto.WarehouseDtos.ReceivePORequest;
import com.garage.model.entity.PurchaseOrder;
import com.garage.model.entity.UserAccount;
import com.garage.repository.PurchaseOrderRepository;
import com.garage.service.AuthService;
import com.garage.service.StockService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class PurchaseOrderController {

    private final StockService stockService;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final AuthService authService;

    public PurchaseOrderController(StockService stockService, PurchaseOrderRepository purchaseOrderRepository, AuthService authService) {
        this.stockService = stockService;
        this.purchaseOrderRepository = purchaseOrderRepository;
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

    @PostMapping({"/warehouse/pos", "/purchase-orders"})
    public ResponseEntity<POResponse> createPO(@RequestBody CreatePORequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;
        POResponse response = stockService.createPO(req, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping({"/warehouse/pos/{id}/receive", "/purchase-orders/{id}/receive"})
    public ResponseEntity<POResponse> receivePO(
        @PathVariable Long id,
        @RequestBody ReceivePORequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 5L;
        POResponse response = stockService.receivePO(id, req != null ? req.lines() : null, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping({"/warehouse/pos", "/purchase-orders"})
    public ResponseEntity<List<PurchaseOrder>> getAllPOs() {
        return ResponseEntity.ok(purchaseOrderRepository.findAll());
    }

    @GetMapping({"/warehouse/pos/{id}", "/purchase-orders/{id}"})
    public ResponseEntity<PurchaseOrder> getPOById(@PathVariable Long id) {
        return purchaseOrderRepository.findById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
