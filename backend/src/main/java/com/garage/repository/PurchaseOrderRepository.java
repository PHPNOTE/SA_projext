package com.garage.repository;

import com.garage.model.entity.PurchaseOrder;

import java.util.List;
import java.util.Optional;

public interface PurchaseOrderRepository {
    PurchaseOrder save(PurchaseOrder po);
    Optional<PurchaseOrder> findById(Long poId);
    Optional<PurchaseOrder> findByPoNo(String poNo);
    List<PurchaseOrder> findByStatus(PurchaseOrder.PurchaseOrderStatus status);
    void updateStatus(Long poId, PurchaseOrder.PurchaseOrderStatus status);
    List<PurchaseOrder> findAll();
    long count();
}
