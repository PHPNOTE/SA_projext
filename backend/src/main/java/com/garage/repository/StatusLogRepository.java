package com.garage.repository;

import com.garage.model.entity.StatusLog;

import java.util.List;
import java.util.Optional;

public interface StatusLogRepository {
    StatusLog save(StatusLog log);
    Optional<StatusLog> findById(Long logId);
    List<StatusLog> findByEntity(StatusLog.EntityType entityType, Long entityId);
    List<StatusLog> findRecent(int limit);
    List<StatusLog> findAll();
    long count();
}
