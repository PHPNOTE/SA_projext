package com.garage.controller;

import com.garage.dto.InvoiceDtos.*;
import com.garage.model.entity.Invoice;
import com.garage.model.entity.UserAccount;
import com.garage.repository.InvoiceLineRepository;
import com.garage.repository.InvoiceRepository;
import com.garage.service.AuthService;
import com.garage.service.BillingService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final BillingService billingService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final AuthService authService;

    public InvoiceController(
        BillingService billingService,
        InvoiceRepository invoiceRepository,
        InvoiceLineRepository invoiceLineRepository,
        AuthService authService
    ) {
        this.billingService = billingService;
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineRepository = invoiceLineRepository;
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
    public ResponseEntity<InvoiceResponse> generateInvoice(@RequestBody GenerateInvoiceRequest req, HttpServletRequest request) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        InvoiceResponse response = billingService.generateInvoice(req, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<PayInvoiceResponse> payInvoice(
        @PathVariable Long id,
        @RequestBody PayInvoiceRequest req,
        HttpServletRequest request
    ) {
        UserAccount user = resolveUser(request);
        Long userId = user != null ? user.userId() : 2L;
        PayInvoiceResponse response = billingService.payInvoice(
            id,
            req,
            userId
        );
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<Invoice>> getAllInvoices() {
        return ResponseEntity.ok(billingService.getAllInvoices());
    }

    @GetMapping("/{id}")
    public ResponseEntity<InvoiceResponse> getInvoiceById(@PathVariable Long id) {
        Invoice invoice = billingService.getInvoiceById(id);
        return ResponseEntity.ok(new InvoiceResponse(invoice, invoiceLineRepository.findByInvoiceId(invoice.invoiceId())));
    }
}
