package com.garage.repository;

import com.garage.model.entity.UserAccount;

import java.util.List;
import java.util.Optional;

public interface UserAccountRepository {
    UserAccount save(UserAccount user);
    Optional<UserAccount> findById(Long userId);
    Optional<UserAccount> findByUsername(String username);
    List<UserAccount> findAllActive();
    List<UserAccount> findAll();
    void update(UserAccount user);
    long count();
}
