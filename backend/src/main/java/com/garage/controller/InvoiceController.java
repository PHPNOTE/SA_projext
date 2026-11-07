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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.garage.model.entity.Customer;
import com.garage.model.entity.Payment;
import com.garage.repository.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private final BillingService billingService;
    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final AuthService authService;
    private final PaymentRepository paymentRepository;
    private final RepairOrderRepository repairOrderRepository;
    private final SaleOrderRepository saleOrderRepository;
    private final VehicleRepository vehicleRepository;
    private final CustomerRepository customerRepository;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public InvoiceController(
        BillingService billingService,
        InvoiceRepository invoiceRepository,
        InvoiceLineRepository invoiceLineRepository,
        AuthService authService,
        PaymentRepository paymentRepository,
        RepairOrderRepository repairOrderRepository,
        SaleOrderRepository saleOrderRepository,
        VehicleRepository vehicleRepository,
        CustomerRepository customerRepository
    ) {
        this.paymentRepository = paymentRepository;
        this.repairOrderRepository = repairOrderRepository;
        this.saleOrderRepository = saleOrderRepository;
        this.vehicleRepository = vehicleRepository;
        this.customerRepository = customerRepository;
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

    /** Read model for the UI: invoice + payments + paid/unpaid state + referenced RO / sale and customer. */
    private Map<String, Object> view(Invoice inv) {
        Map<String, Object> m = new LinkedHashMap<>(mapper.convertValue(inv, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}));
        List<Payment> pays = paymentRepository.findByInvoiceId(inv.invoiceId());
        BigDecimal custPaid = BigDecimal.ZERO;
        List<Map<String, Object>> pv = new ArrayList<>();
        for (Payment pay : pays) {
            if (pay.payerType() == Payment.PayerType.CUSTOMER) custPaid = custPaid.add(pay.amount());
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("paymentId", pay.paymentId());
            pm.put("payerType", pay.payerType().name());
            pm.put("amount", pay.amount());
            pm.put("method", pay.method());
            pm.put("paidAt", pay.paidAt() == null ? null : pay.paidAt().toString());
            pm.put("receiptNumber", "RCP-" + String.format("%04d", pay.paymentId()));
            pv.add(pm);
        }
        boolean paid = inv.status() != Invoice.InvoiceStatus.VOID && custPaid.compareTo(inv.customerDue()) >= 0;
        m.put("id", inv.invoiceId());
        m.put("invoiceNumber", inv.invoiceNo());
        m.put("status", inv.status() == Invoice.InvoiceStatus.VOID ? "VOID" : (paid ? "PAID" : "ISSUED"));
        m.put("payments", pv);
        Long customerId = null;
        if (inv.repairId() != null) {
            var ro = repairOrderRepository.findById(inv.repairId()).orElse(null);
            if (ro != null) {
                m.put("roNumber", ro.ticketNo());
                var v = ro.vehicleId() == null ? null : vehicleRepository.findById(ro.vehicleId()).orElse(null);
                if (v != null) customerId = v.customerId();
            }
        } else if (inv.saleId() != null) {
            var so = saleOrderRepository.findById(inv.saleId()).orElse(null);
            if (so != null) { m.put("saleNumber", so.saleNo()); customerId = so.customerId(); }
        }
        Customer c = customerId == null ? null : customerRepository.findById(customerId).orElse(null);
        if (c != null) { m.put("customerName", c.name()); m.put("customerPhone", c.phone()); }
        return m;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllInvoices() {
        return ResponseEntity.ok(billingService.getAllInvoices().stream().map(this::view).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<InvoiceResponse> getInvoiceById(@PathVariable Long id) {
        Invoice invoice = billingService.getInvoiceById(id);
        return ResponseEntity.ok(new InvoiceResponse(invoice, invoiceLineRepository.findByInvoiceId(invoice.invoiceId())));
    }
}
