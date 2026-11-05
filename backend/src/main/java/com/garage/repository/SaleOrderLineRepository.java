package com.garage.repository;

import com.garage.model.entity.SaleOrderLine;

import java.util.List;
import java.util.Optional;

public interface SaleOrderLineRepository {
    SaleOrderLine save(SaleOrderLine line);
    void batchInsert(List<SaleOrderLine> lines);
    Optional<SaleOrderLine> findById(Long lineId);
    List<SaleOrderLine> findBySaleId(Long saleId);
    List<SaleOrderLine> findAll();
    long count();
}
