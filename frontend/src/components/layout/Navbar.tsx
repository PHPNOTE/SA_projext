'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types';
import { Wrench, Shield, LogOut, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export function Navbar() {
  const { user, role, switchRole, logout } = useAuth();
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const roles: { id: UserRole; label: string; color: string }[] = [
    { id: 'FRONT_DESK', label: 'ต้อนรับ (Front Desk)', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { id: 'MECHANIC', label: 'ช่างซ่อม (Mechanic)', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { id: 'WAREHOUSE', label: 'คลังสินค้า (Warehouse)', color: 'bg-amber-600 hover:bg-amber-700 text-white' },
    { id: 'SALES', label: 'ขายหน้าร้าน (Sales)', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
    { id: 'MANAGER', label: 'ผู้จัดการ (Manager)', color: 'bg-rose-600 hover:bg-rose-700 text-white' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white px-4 lg:px-6 py-2.5 print:hidden">
      <div className="flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                AUTO GARAGE <span className="text-blue-400">OS</span>
              </span>
              <span className="text-[10px] text-slate-400 block leading-none">
                ระบบจัดการคิวและออเดอร์อู่ซ่อมรถ
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Role Switcher for Demo */}
        <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <span className="text-[11px] font-semibold text-slate-400 px-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-blue-400" /> สลับบทบาท:
          </span>
          {roles.map((r) => {
            const isActive = role === r.id;
            return (
              <button
                key={r.id}
                onClick={() => switchRole(r.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  isActive
                    ? `${r.color} shadow-sm font-bold scale-[1.02]`
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-4">
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{timeStr}</span>
          </div>

          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-white leading-tight">{user?.fullName || 'ผู้ใช้งาน'}</p>
              <p className="text-[10px] text-blue-400 font-medium">@{user?.username || 'user'} • {role}</p>
            </div>
            <Link
              href="/login"
              onClick={logout}
              title="ออกจากระบบ"
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 border border-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
