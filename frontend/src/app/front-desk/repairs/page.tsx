'use client';

import React, { useEffect, useState } from 'react';
import { apiGetRepairs, apiApproveEstimate, apiUpdateRepairStatus } from '@/lib/api';
import { RepairOrder } from '@/lib/types';
import {
  FileCheck2,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  FileText,
  Car,
  Calendar,
  AlertCircle,
  Receipt,
  Lock,
} from 'lucide-react';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';

export default function RepairOrdersPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedRo, setSelectedRo] = useState<RepairOrder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiGetRepairs();
      setRepairs(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = repairs.filter((r) => {
    const matchesSearch =
      r.roNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (roId: number) => {
    setActionLoading(true);
    try {
      await apiApproveEstimate(roId, 'APPROVED', true);
      alert('อนุมัติใบประเมินราคาเรียบร้อยแล้ว งานซ่อมเริ่มดำเนินการ (IN_REPAIR)');
      setDetailModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (roId: number) => {
    if (!confirm('ยืนยันว่าลูกค้าปฏิเสธการซ่อม? ใบสั่งซ่อมจะถูกยกเลิก (CANCELLED) และปล่อยช่องซ่อม')) return;
    setActionLoading(true);
    try {
      await apiApproveEstimate(roId, 'DECLINED');
      setDetailModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <FileCheck2 className="w-4 h-4" /> แผนกต้อนรับ • Use Case UC04
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            รายการใบสั่งซ่อมทั้งหมด (Repair Orders Directory)
          </h1>
          <p className="text-xs text-slate-500">
            ติดตามสถานะงานซ่อม, ตรวจสอบการอนุมัติราคา (Estimate Approval), และส่งต่อไปยังการเงิน
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ RO, ทะเบียนรถ, ชื่อลูกค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">สถานะ:</span>
          {['ALL', 'QUEUED', 'IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'IN_REPAIR', 'ON_HOLD', 'QC', 'AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Repairs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">เลขที่ RO / คิว</th>
                <th className="py-3 px-4">ยานพาหนะ / ทะเบียน</th>
                <th className="py-3 px-4">ลูกค้า / เบอร์ติดต่อ</th>
                <th className="py-3 px-4">ช่องซ่อม / ช่างผู้ดูแล</th>
                <th className="py-3 px-4 text-center">สถานะงานซ่อม</th>
                <th className="py-3 px-4 text-right">ยอดรวมประเมิน</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    ไม่พบรายการใบสั่งซ่อมที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              ) : (
                filtered.map((ro) => (
                  <tr key={ro.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-blue-700 block">{ro.roNumber}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{ro.ticketNumber}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{ro.licensePlate}</span>
                      <span className="text-[10px] text-slate-500">{ro.vehicleModel}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800 block">{ro.customerName}</span>
                      <span className="text-[10px] text-slate-400">{ro.customerPhone}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700 block">
                        {ro.assignedBayNumber ? `ช่อง: ${ro.assignedBayNumber}` : '-'}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {ro.assignedMechanicName || 'ยังไม่กำหนดช่าง'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={ro.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      {ro.subtotal ? `฿${ro.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedRo(ro);
                            setDetailModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1"
                          title="ดูรายละเอียด"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {ro.status === 'AWAITING_PAYMENT' && (
                          <Link
                            href="/front-desk/billing"
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-xs flex items-center gap-1"
                            title="ไปปิดงานออกใบเสร็จ"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RO Detail Modal */}
      {selectedRo && (
        <Modal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          title={`รายละเอียดใบสั่งซ่อม: ${selectedRo.roNumber}`}
          maxWidth="2xl"
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block">หมายเลขคิว:</span>
                <span className="font-mono font-bold text-blue-700">{selectedRo.ticketNumber}</span>
              </div>
              <div>
                <span className="text-slate-400 block">สถานะปัจจุบัน:</span>
                <StatusBadge status={selectedRo.status} />
              </div>
              <div>
                <span className="text-slate-400 block">ประเภทคิว:</span>
                <Badge variant={selectedRo.queueClass === 'PRIORITY' ? 'danger' : 'neutral'}>
                  {selectedRo.queueClass}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400 block">ทะเบียนรถ:</span>
                <span className="font-bold text-slate-800">{selectedRo.licensePlate}</span>
              </div>
              <div>
                <span className="text-slate-400 block">รุ่นรถยนต์:</span>
                <span className="font-medium text-slate-700">{selectedRo.vehicleModel}</span>
              </div>
              <div>
                <span className="text-slate-400 block">ช่องบริการ:</span>
                <span className="font-medium text-slate-700">{selectedRo.assignedBayNumber || 'ปล่อยว่าง'}</span>
              </div>
            </div>

            <div>
              <span className="font-bold text-slate-800 block mb-1">อาการชำรุดที่ลูกค้าแจ้ง:</span>
              <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700">
                {selectedRo.symptoms}
              </p>
            </div>

            {selectedRo.insurerName && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                <span className="font-bold text-blue-900 block mb-1">ข้อมูลงานประกันภัย:</span>
                <p className="text-blue-800">
                  บริษัท: {selectedRo.insurerName} | เลขที่เคลม: {selectedRo.insuranceClaimNo || '-'}
                </p>
                <p className="text-blue-700 mt-1">
                  เอกสารเคลม: {selectedRo.insuranceDocsReceived ? '✓ ได้รับครบถ้วนแล้ว' : '✗ ยังไม่ได้รับเอกสาร'} | ยอดประกันคุ้มครอง: ฿{selectedRo.insuranceCoveredAmount?.toLocaleString() || '0'}
                </p>
              </div>
            )}

            {/* Price breakdown */}
            <div className="border-t border-slate-200 pt-3 flex justify-between items-center text-sm">
              <span className="font-bold text-slate-700">ยอดรวมค่าแรงและอะไหล่ประเมิน:</span>
              <span className="font-mono font-black text-slate-900 text-base">
                ฿{selectedRo.subtotal?.toLocaleString('th-TH', { minimumFractionDigits: 2 }) || '0.00'}
              </span>
            </div>

            {/* State Banners */}
            {selectedRo.status === 'COMPLETED' && (
              <div className="p-3.5 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-between text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    <b>งานซ่อมนี้ปิดสมบูรณ์แล้ว (COMPLETED)</b> • ส่งมอบรถและชำระเงินเรียบร้อยแล้ว
                  </span>
                </div>
                <span className="flex items-center gap-1 font-bold text-slate-500 uppercase text-[10px] bg-slate-200 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" /> โหมดอ่านอย่างเดียว (Read-Only)
                </span>
              </div>
            )}

            {selectedRo.status === 'CANCELLED' && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>
                    <b>ใบสั่งซ่อมนี้ถูกยกเลิกแล้ว (CANCELLED)</b> • ยุติขั้นตอนบริการแล้ว
                  </span>
                </div>
                <span className="flex items-center gap-1 font-bold text-rose-700 uppercase text-[10px] bg-rose-100 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" /> ยกเลิกแล้ว (Cancelled)
                </span>
              </div>
            )}

            {selectedRo.status === 'QC' && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span>
                    <b>งานซ่อมอยู่ในขั้นตอนตรวจคุณภาพ (QC)</b> • รอฝ่ายช่างตรวจและบันทึกผล
                  </span>
                </div>
              </div>
            )}

            {selectedRo.status === 'AWAITING_PAYMENT' && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-800">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>
                    <b>งานซ่อมผ่าน QC แล้ว (AWAITING_PAYMENT)</b> • รอออกใบแจ้งหนี้และรับชำระเงินที่แผนกการเงิน
                  </span>
                </div>
              </div>
            )}

            {/* Approval Action Buttons strictly only when AWAITING_APPROVAL */}
            {selectedRo.status === 'AWAITING_APPROVAL' && (
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDecline(selectedRo.id)}
                  className="px-4 py-2 border border-rose-300 text-rose-700 rounded-xl font-bold hover:bg-rose-50 disabled:opacity-50"
                >
                  ลูกค้าปฏิเสธราคา (Decline)
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleApprove(selectedRo.id)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  อนุมัติใบเสนอราคา (Approve & Start Repair)
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
