package com.garage.repository;

import com.garage.model.entity.RepairOrder;

import java.util.List;
import java.util.Optional;

public interface RepairOrderRepository {
    RepairOrder save(RepairOrder repairOrder);
    Optional<RepairOrder> findById(Long repairId);
    Optional<RepairOrder> findByTicketNo(String ticketNo);
    Optional<RepairOrder> findNextQueuedForUpdate();
    List<RepairOrder> findByStatus(RepairOrder.RepairOrderStatus status);
    List<RepairOrder> findAll();
    void updateStatusAndBay(Long repairId, RepairOrder.RepairOrderStatus status, Long bayId, Long mechanicId);
    void updateClosedAt(Long repairId);
    void update(RepairOrder repairOrder);
    long count();
}
