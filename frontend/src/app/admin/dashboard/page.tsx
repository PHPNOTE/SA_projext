'use client';

import React, { useEffect, useState } from 'react';
import { apiGetRepairs, apiGetBays, apiGetParts, apiGetStockLedger } from '@/lib/api';
import { RepairOrder, RepairBay, Part, StockMovement } from '@/lib/types';
import {
  LayoutDashboard,
  DollarSign,
  Car,
  Wrench,
  Boxes,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Users,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [bays, setBays] = useState<RepairBay[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGetRepairs(), apiGetBays(), apiGetParts(), apiGetStockLedger()])
      .then(([r, b, p, m]) => {
        setRepairs(r);
        setBays(b);
        setParts(p);
        setMovements(m);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = repairs
    .filter((r) => r.status === 'COMPLETED' || r.status === 'AWAITING_PAYMENT')
    .reduce((acc, r) => acc + (r.subtotal || 0), 0);

  const activeJobs = repairs.filter(
    (r) => r.status === 'IN_REPAIR' || r.status === 'IN_DIAGNOSIS' || r.status === 'QC'
  ).length;

  const queuedJobs = repairs.filter((r) => r.status === 'QUEUED').length;
  const completedJobs = repairs.filter((r) => r.status === 'COMPLETED').length;
  const stockValuation = parts.reduce((acc, p) => acc + p.onHand * p.costPrice, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wider">
            <LayoutDashboard className="w-4 h-4" /> แผนกบริหาร • Management KPI Dashboard
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            แดชบอร์ดภาพรวมการดำเนินงานศูนย์บริการ (Garage Operations Overview)
          </h1>
          <p className="text-xs text-slate-500">
            ตัวชี้วัดประสิทธิภาพ (KPIs), สถานะช่องซ่อมแบบ Real-time, และสมุดบันทึกประวัติการทำงาน
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reports/repairs"
            className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>รายงานสรุปงานซ่อม</span>
          </Link>
          <Link
            href="/reports/inventory"
            className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold border border-amber-200 flex items-center gap-1.5"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>รายงานการใช้อะไหล่</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รายได้รวมงานซ่อมและบริการ"
          value={`฿${totalRevenue.toLocaleString()}`}
          subtitle="คำนวณจากงานซ่อมและใบแจ้งหนี้"
          trend="+18% vs สัปดาห์ก่อน"
          trendType="up"
          icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
        />
        <StatCard
          title="รถที่อยู่ระหว่างการซ่อมในช่อง"
          value={`${activeJobs} คัน`}
          subtitle={`กำลังรอคิวบริการ: ${queuedJobs} คัน`}
          icon={<Car className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title="งานซ่อมที่ส่งมอบเสร็จสิ้นแล้ว"
          value={`${completedJobs} คัน`}
          subtitle="ผ่าน QC และปิดงานสมบูรณ์"
          trend="เฉลี่ย 3.8 ชม./คัน"
          icon={<ShieldCheck className="w-6 h-6 text-purple-600" />}
        />
        <StatCard
          title="มูลค่าอะไหล่คงคลังรวม (ต้นทุน)"
          value={`฿${stockValuation.toLocaleString()}`}
          subtitle={`${parts.length} รายการในคลังสินค้า`}
          icon={<Boxes className="w-6 h-6 text-amber-600" />}
        />
      </div>

      {/* Bay Occupancy Live Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-600" />
            <span>สถานะช่องบริการซ่อมสด (Live Bay Occupancy Monitor)</span>
          </h2>
          <span className="text-xs text-slate-400">
            {bays.filter((b) => b.isOccupied).length} / {bays.length} ช่องกำลังทำงาน
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {bays.map((bay) => {
            const currentRo = repairs.find((r) => r.id === bay.currentRepairId);

            return (
              <div
                key={bay.id}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  bay.isOccupied
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-emerald-50/50 border-emerald-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-slate-800">{bay.bayNumber}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        bay.isOccupied ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {bay.isOccupied ? 'ไม่ว่าง' : 'ว่าง'}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs mt-1.5 line-clamp-1">{bay.name}</h4>
                  <p className="text-[10px] text-slate-400">ประเภท: {bay.bayType}</p>
                </div>

                {bay.isOccupied && currentRo && (
                  <div className="bg-white p-2.5 rounded-lg border border-rose-100 text-[11px] space-y-0.5">
                    <span className="font-bold text-slate-900 block">{currentRo.licensePlate}</span>
                    <span className="text-slate-500 block truncate">{currentRo.vehicleModel}</span>
                    <span className="text-[10px] font-mono text-blue-600 block">{currentRo.roNumber}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Recent ROs & Stock Movements Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent ROs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">ใบสั่งซ่อมล่าสุด (Recent Orders)</h3>
            <Link href="/front-desk/repairs" className="text-xs text-blue-600 font-bold hover:underline">
              ดูทั้งหมด
            </Link>
          </div>

          <div className="space-y-2.5">
            {repairs.slice(0, 5).map((ro) => (
              <div
                key={ro.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{ro.roNumber}</span>
                    <StatusBadge status={ro.status} />
                  </div>
                  <p className="font-semibold text-slate-900 mt-0.5">{ro.licensePlate} ({ro.vehicleModel})</p>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-slate-800 block">
                    {ro.subtotal ? `฿${ro.subtotal.toLocaleString()}` : '-'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {ro.assignedBayNumber ? `ช่อง: ${ro.assignedBayNumber}` : 'รอเรียกคิว'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Ledger Audit Trail */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">ความเคลื่อนไหวสต็อกล่าสุด (Audit Trail)</h3>
            <Link href="/warehouse/ledger" className="text-xs text-amber-600 font-bold hover:underline">
              ดูสมุดบัญชี
            </Link>
          </div>

          <div className="space-y-2.5">
            {movements.slice(0, 5).map((m) => (
              <div
                key={m.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-700">{m.partCode}</span>
                    <Badge variant={m.movementType === 'RECEIPT' ? 'success' : m.movementType === 'ISSUE' ? 'info' : 'warning'}>
                      {m.movementType}
                    </Badge>
                  </div>
                  <p className="text-slate-600 mt-0.5 truncate max-w-xs">{m.reason || m.partName}</p>
                </div>

                <div className="text-right">
                  <span
                    className={`font-mono font-bold text-xs ${
                      m.deltaOnHand > 0 ? 'text-emerald-600' : m.deltaOnHand < 0 ? 'text-rose-600' : 'text-slate-600'
                    }`}
                  >
                    {m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : m.deltaOnHand} On-Hand
                  </span>
                  <span className="text-[10px] text-slate-400 block">{m.userName || 'คลัง'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
