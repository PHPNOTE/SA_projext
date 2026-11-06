package com.garage.controller;

import com.garage.dto.SaleDtos.*;
import com.garage.model.entity.SaleOrder;
import com.garage.model.entity.UserAccount;
import com.garage.repository.SaleOrderLineRepository;
import com.garage.repository.SaleOrderRepository;
import com.garage.service.AuthService;
import com.garage.service.SaleOrderService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sales")
public class SaleOrderController {

    private final SaleOrderService saleOrderService;
    private final SaleOrderRepository saleOrderRepository;
    private final SaleOrderLineRepository saleOrderLineRepository;
    private final AuthService authService;

    public SaleOrderController(
        SaleOrderService saleOrderService,
        SaleOrderRepository saleOrderRepository,
        SaleOrderLineRepository saleOrderLineRepository,
        AuthService authService
    ) {
        this.saleOrderService = saleOrderService;
        this.saleOrderRepository = saleOrderRepository;
        this.saleOrderLineRepository = saleOrderLineRepository;
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

    @PostMapping
    public ResponseEntity<SaleResponse> createSaleQuote(@RequestBody CreateSaleQuoteRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 6L;
        SaleResponse response = saleOrderService.createSaleQuote(req.customerId(), req.lines(), userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<SaleOrder> confirmSale(@PathVariable Long id, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 6L;
        SaleOrder sale = saleOrderService.confirmSale(id, userId);
        return ResponseEntity.ok(sale);
    }

    @PostMapping({"/{id}/complete", "/{id}/checkout"})
    public ResponseEntity<CompleteSaleResponse> completeSale(
        @PathVariable Long id,
        @RequestBody CompleteSaleRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 6L;
        CompleteSaleResponse response = saleOrderService.completeSale(
            id,
            req != null ? req.amountPaid() : null,
            req != null ? req.paymentMethod() : null,
            userId
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/complete")
    public ResponseEntity<CompleteSaleResponse> directCompleteSale(
        @RequestBody SingleShotSaleRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 6L;
        CompleteSaleResponse response = saleOrderService.directCounterSale(req, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<SaleOrder> cancelSale(@PathVariable Long id, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 6L;
        SaleOrder sale = saleOrderService.cancelSale(id, userId);
        return ResponseEntity.ok(sale);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaleResponse> getSaleById(@PathVariable Long id) {
        return saleOrderRepository.findById(id)
            .map(s -> new SaleResponse(s, saleOrderLineRepository.findBySaleId(s.saleId())))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<SaleOrder>> getAllSales() {
        return ResponseEntity.ok(saleOrderRepository.findAll());
    }
}
