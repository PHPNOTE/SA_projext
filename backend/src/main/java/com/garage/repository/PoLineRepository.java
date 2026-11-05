package com.garage.repository;

import com.garage.model.entity.PoLine;

import java.util.List;
import java.util.Optional;

public interface PoLineRepository {
    PoLine save(PoLine line);
    void batchInsert(List<PoLine> lines);
    Optional<PoLine> findById(Long poLineId);
    List<PoLine> findByPoId(Long poId);
    void updateQtyReceived(Long poLineId, int qtyReceived);
    List<PoLine> findAll();
    long count();
}
