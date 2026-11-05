package com.garage.repository;

import com.garage.model.entity.Payment;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository {
    Payment save(Payment payment);
    Optional<Payment> findById(Long paymentId);
    List<Payment> findByInvoiceId(Long invoiceId);
    BigDecimal getSumPaidByCustomer(Long invoiceId);
    BigDecimal getTotalPaid(Long invoiceId);
    List<Payment> findAll();
    long count();
}
