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

    private final com.garage.repository.PoLineRepository poLineRepository;
    private final com.garage.repository.PartRepository partRepository;

    public PurchaseOrderController(StockService stockService, PurchaseOrderRepository purchaseOrderRepository, AuthService authService,
                                   com.garage.repository.PoLineRepository poLineRepository, com.garage.repository.PartRepository partRepository) {
        this.poLineRepository = poLineRepository;
        this.partRepository = partRepository;
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
    public ResponseEntity<List<java.util.Map<String, Object>>> getAllPOs() {
        return ResponseEntity.ok(purchaseOrderRepository.findAll().stream().map(this::toView).toList());
    }

    @GetMapping({"/warehouse/pos/{id}", "/purchase-orders/{id}"})
    public ResponseEntity<java.util.Map<String, Object>> getPOById(@PathVariable Long id) {
        return purchaseOrderRepository.findById(id)
            .map(po -> ResponseEntity.ok(toView(po)))
            .orElse(ResponseEntity.notFound().build());
    }

    /** PO header plus its lines and total cost, so the UI can show the full document. */
    private java.util.Map<String, Object> toView(PurchaseOrder po) {
        java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("poId", po.poId());
        m.put("id", po.poId());
        m.put("poNo", po.poNo());
        m.put("poNumber", po.poNo());
        m.put("supplierName", po.supplierName());
        m.put("status", po.status());
        m.put("expectedDate", po.expectedDate());
        m.put("createdBy", po.createdBy());
        m.put("createdAt", po.createdAt());
        m.put("orderedAt", po.orderedAt());
        java.math.BigDecimal total = java.math.BigDecimal.ZERO;
        List<java.util.Map<String, Object>> lines = new java.util.ArrayList<>();
        for (com.garage.model.entity.PoLine l : poLineRepository.findByPoId(po.poId())) {
            java.util.Map<String, Object> lm = new java.util.LinkedHashMap<>();
            var part = partRepository.findById(l.partId()).orElse(null);
            lm.put("id", l.poLineId());
            lm.put("poLineId", l.poLineId());
            lm.put("poId", l.poId());
            lm.put("partId", l.partId());
            lm.put("partCode", part != null ? part.sku() : "");
            lm.put("partName", part != null ? part.name() : "");
            lm.put("qtyOrdered", l.qtyOrdered());
            lm.put("qtyReceived", l.qtyReceived());
            lm.put("unitCost", l.unitCost());
            total = total.add(l.unitCost().multiply(java.math.BigDecimal.valueOf(l.qtyOrdered())));
            lines.add(lm);
        }
        m.put("totalCost", total);
        m.put("lines", lines);
        return m;
    }
}
