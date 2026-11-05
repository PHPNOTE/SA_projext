package com.garage.repository;

import com.garage.model.entity.SaleOrder;

import java.util.List;
import java.util.Optional;

public interface SaleOrderRepository {
    SaleOrder save(SaleOrder sale);
    Optional<SaleOrder> findById(Long saleId);
    Optional<SaleOrder> findBySaleNo(String saleNo);
    List<SaleOrder> findByStatus(SaleOrder.SaleOrderStatus status);
    void updateStatus(Long saleId, SaleOrder.SaleOrderStatus status);
    List<SaleOrder> findAll();
    long count();
}
