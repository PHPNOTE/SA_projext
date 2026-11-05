'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types';
import { Wrench, Shield, Lock, User as UserIcon, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('frontdesk');
  const [password, setPassword] = useState('••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>('FRONT_DESK');
  const [loading, setLoading] = useState(false);

  const roleProfiles: { role: UserRole; label: string; desc: string; defaultUser: string; color: string }[] = [
    {
      role: 'FRONT_DESK',
      label: 'แผนกต้อนรับ (Front Desk)',
      desc: 'รับรถเปิดคิว, จัดการใบสั่งซ่อม, ปิดงานซ่อมออกใบเสร็จ (R1, R2, R6)',
      defaultUser: 'frontdesk',
      color: 'border-blue-500 bg-blue-50/10 text-blue-400',
    },
    {
      role: 'MECHANIC',
      label: 'ช่างเทคนิค (Mechanic)',
      desc: 'ตรวจเช็คประเมินราคา, เบิกอะไหล่ซ่อม, ตรวจสอบคุณภาพ QC (R2-R5)',
      defaultUser: 'mechanic1',
      color: 'border-emerald-500 bg-emerald-50/10 text-emerald-400',
    },
    {
      role: 'WAREHOUSE',
      label: 'คลังอะไหล่ (Warehouse)',
      desc: 'จ่าย/รับคืนอะไหล่, รับของเข้าสต็อก (PO), ตรวจนับสต็อก (W1-W7)',
      defaultUser: 'warehouse',
      color: 'border-amber-500 bg-amber-50/10 text-amber-400',
    },
    {
      role: 'SALES',
      label: 'ขายหน้าร้าน (Sales Counter)',
      desc: 'เปิดบิลขายอะไหล่หน้าร้าน, หักสต็อกและออกใบเสร็จทันที (S1-S2)',
      defaultUser: 'sales',
      color: 'border-purple-500 bg-purple-50/10 text-purple-400',
    },
    {
      role: 'MANAGER',
      label: 'ผู้จัดการอู่ (Shop Manager)',
      desc: 'แดชบอร์ด KPI, ตั้งค่าช่องซ่อม, รายงานสรุปการเงินและการใช้อะไหล่ (A1-A2)',
      defaultUser: 'admin',
      color: 'border-rose-500 bg-rose-50/10 text-rose-400',
    },
  ];

  const handleRoleSelect = (r: UserRole, user: string) => {
    setSelectedRole(r);
    setUsername(user);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await login(username, selectedRole);
    setLoading(false);

    switch (selectedRole) {
      case 'FRONT_DESK':
        router.push('/front-desk/check-in');
        break;
      case 'MECHANIC':
        router.push('/mechanic/diagnostics');
        break;
      case 'WAREHOUSE':
        router.push('/warehouse/inventory');
        break;
      case 'SALES':
        router.push('/sales/counter');
        break;
      case 'MANAGER':
        router.push('/admin/dashboard');
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
            <Wrench className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            AUTO GARAGE <span className="text-blue-400">OS</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ระบบจัดการคิวและออเดอร์อู่ซ่อมรถ • Relational Database & Spring Boot Core
          </p>
        </div>

        {/* Quick Role Profiles */}
        <div className="mb-6">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
            เลือกบทบาทผู้ใช้งาน (Quick Role Selector for Presentation Demo):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {roleProfiles.map((p) => {
              const isSelected = selectedRole === p.role;
              return (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => handleRoleSelect(p.role, p.defaultUser)}
                  className={`text-left p-3 rounded-xl border transition-all relative ${
                    isSelected
                      ? `${p.color} border-2 shadow-md`
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-blue-400 absolute top-2 right-2" />
                  )}
                  <p className="text-xs font-bold text-white leading-snug">{p.label}</p>
                  <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">ชื่อผู้ใช้งาน (Username)</label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">รหัสผ่าน (Password)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span>กำลังตรวจสอบสิทธิ์...</span>
            ) : (
              <>
                <span>เข้าสู่ระบบในฐานะ {selectedRole}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-[11px] text-slate-500">
            โครงงานวิศวกรรมซอฟต์แวร์ ภาควิชาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยเกษตรศาสตร์
          </p>
        </div>
      </div>
    </div>
  );
}
