package com.garage.repository;

import com.garage.model.entity.InvoiceLine;

import java.util.List;
import java.util.Optional;

public interface InvoiceLineRepository {
    InvoiceLine save(InvoiceLine line);
    void batchInsert(List<InvoiceLine> lines);
    Optional<InvoiceLine> findById(Long lineId);
    List<InvoiceLine> findByInvoiceId(Long invoiceId);
    List<InvoiceLine> findAll();
    long count();
}
