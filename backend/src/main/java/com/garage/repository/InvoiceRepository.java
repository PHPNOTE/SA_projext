package com.garage.repository;

import com.garage.model.entity.Invoice;

import java.util.List;
import java.util.Optional;

public interface InvoiceRepository {
    Invoice save(Invoice invoice);
    Optional<Invoice> findById(Long invoiceId);
    Optional<Invoice> findByInvoiceNo(String invoiceNo);
    Optional<Invoice> findByRepairId(Long repairId);
    Optional<Invoice> findBySaleId(Long saleId);
    void updateStatus(Long invoiceId, Invoice.InvoiceStatus status);
    List<Invoice> findAll();
    long count();
}
