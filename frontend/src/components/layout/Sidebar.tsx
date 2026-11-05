'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  ClipboardList,
  Layers,
  Wrench,
  Boxes,
  ShoppingCart,
  LayoutDashboard,
  FileText,
  UserCheck,
  CheckCircle2,
  PackagePlus,
  ArrowRightLeft,
  FileSpreadsheet,
  Settings,
  Flame,
  ShieldCheck,
  Receipt,
  FileCheck2,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAuth();

  const sections = [
    {
      title: 'แผนกต้อนรับ (Front Desk)',
      highlightRole: 'FRONT_DESK',
      items: [
        { label: 'ลงทะเบียนรับรถ / เปิดคิว', href: '/front-desk/check-in', icon: ClipboardList, uc: 'R1' },
        { label: 'กระดานคิวและเรียกคิว', href: '/front-desk/queue', icon: Layers, uc: 'R2' },
        { label: 'รายการใบสั่งซ่อม (RO)', href: '/front-desk/repairs', icon: FileCheck2, uc: 'R3' },
        { label: 'ออกใบเสร็จ & ปิดงานซ่อม', href: '/front-desk/billing', icon: Receipt, uc: 'R6' },
      ],
    },
    {
      title: 'ฝ่ายช่างเทคนิค (Mechanic)',
      highlightRole: 'MECHANIC',
      items: [
        { label: 'บันทึกตรวจเช็ค & ประเมินราคา', href: '/mechanic/diagnostics', icon: Wrench, uc: 'R2-R3' },
        { label: 'ติดตามงานซ่อม & ตรวจ QC', href: '/mechanic/bay', icon: ShieldCheck, uc: 'R4-R5' },
        { label: 'ขอเบิกอะไหล่ซ่อม', href: '/mechanic/requisitions', icon: PackagePlus, uc: 'W2' },
      ],
    },
    {
      title: 'คลังสินค้า & พัสดุ (Warehouse)',
      highlightRole: 'WAREHOUSE',
      items: [
        { label: 'รายการอะไหล่ & เช็คสต็อก', href: '/warehouse/inventory', icon: Boxes, uc: 'W1' },
        { label: 'จ่าย & รับคืนอะไหล่', href: '/warehouse/issuance', icon: ArrowRightLeft, uc: 'W2-W3' },
        { label: 'ใบสั่งซื้อ & รับเข้าสต็อก (PO)', href: '/warehouse/purchase-orders', icon: PackagePlus, uc: 'W4-W5' },
        { label: 'ตรวจนับสต็อก & ปรับยอด', href: '/warehouse/audit', icon: FileSpreadsheet, uc: 'W6' },
        { label: 'สมุดบันทึกความเคลื่อนไหว', href: '/warehouse/ledger', icon: Layers, uc: 'W7' },
      ],
    },
    {
      title: 'ขายหน้าร้าน (Sales Counter)',
      highlightRole: 'SALES',
      items: [
        { label: 'ขายอะไหล่หน้าร้าน (POS)', href: '/sales/counter', icon: ShoppingCart, uc: 'S1-S2' },
      ],
    },
    {
      title: 'ผู้บริหารและผู้ดูแล (Admin)',
      highlightRole: 'MANAGER',
      items: [
        { label: 'แดชบอร์ดภาพรวมระบบ', href: '/admin/dashboard', icon: LayoutDashboard, uc: 'KPI' },
        { label: 'ตั้งค่าระบบ & ช่องซ่อม', href: '/admin/settings', icon: Settings, uc: 'A1-A2' },
      ],
    },
    {
      title: 'รายงานการดำเนินงาน (Reports)',
      highlightRole: 'ALL',
      items: [
        { label: 'รายงานสรุปงานซ่อม (Repairs)', href: '/reports/repairs', icon: FileText, uc: 'Report 1' },
        { label: 'รายงานการใช้อะไหล่ (Inventory)', href: '/reports/inventory', icon: FileSpreadsheet, uc: 'Report 2' },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex-shrink-0 flex flex-col h-[calc(100vh-57px)] sticky top-[57px] print:hidden overflow-y-auto">
      <div className="p-3 space-y-6">
        {sections.map((sec, idx) => {
          const isCurrentSectionRole = sec.highlightRole === role || sec.highlightRole === 'ALL';

          return (
            <div key={idx} className="space-y-1">
              <div className="flex items-center justify-between px-3 py-1">
                <span
                  className={`text-[11px] font-extrabold uppercase tracking-wider ${
                    isCurrentSectionRole ? 'text-blue-400' : 'text-slate-500'
                  }`}
                >
                  {sec.title}
                </span>
                {sec.highlightRole === role && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>

              <div className="space-y-0.5">
                {sec.items.map((it) => {
                  const isActive = pathname === it.href;
                  const Icon = it.icon;

                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                          }`}
                        />
                        <span>{it.label}</span>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          isActive
                            ? 'bg-blue-700/60 text-blue-100'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {it.uc}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
