'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from './types';
import { apiLogin, ApiError, setStoredToken } from './api';
import { INITIAL_USERS } from './mock-data';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  token: string | null;
  login: (username: string, role?: UserRole, password?: string) => Promise<void>;
  switchRole: (newRole: UserRole) => void;
  logout: () => void;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('garage_user');
    const savedToken = localStorage.getItem('garage_auth_token');

    if (savedUser && savedToken) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setToken(savedToken);
      } catch {
        setDefaultUser('FRONT_DESK');
      }
    } else {
      setDefaultUser('FRONT_DESK');
    }
    setIsInitialized(true);
  }, []);

  const setDefaultUser = (role: UserRole) => {
    const matched = INITIAL_USERS.find((u) => u.role === role) || INITIAL_USERS[1];
    setUser(matched);
    const mockToken = `mock-token-${matched.id}-${matched.role}`;
    setToken(mockToken);
    setStoredToken(mockToken);
    localStorage.setItem('garage_user', JSON.stringify(matched));
  };

  const login = async (username: string, role?: UserRole, password = 'password123') => {
    try {
      const res = await apiLogin(username, password, role);
      setUser(res.user);
      setToken(res.token);
      setStoredToken(res.token);
      localStorage.setItem('garage_user', JSON.stringify(res.user));
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      setDefaultUser(role || 'FRONT_DESK');
    }
  };

  const switchRole = (newRole: UserRole) => {
    const matched = INITIAL_USERS.find((u) => u.role === newRole) || {
      id: 99,
      username: newRole.toLowerCase(),
      fullName: `ผู้ใช้งาน (${newRole})`,
      role: newRole,
      isActive: true,
    };
    setUser(matched);
    const mockToken = `mock-token-${matched.id}-${matched.role}`;
    setToken(mockToken);
    setStoredToken(mockToken);
    localStorage.setItem('garage_user', JSON.stringify(matched));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setStoredToken(null);
    localStorage.removeItem('garage_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'FRONT_DESK',
        token,
        login,
        switchRole,
        logout,
        isInitialized,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
