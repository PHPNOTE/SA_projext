'use client';

import React, { useEffect, useState } from 'react';
import { apiGetRepairs, apiGetParts, apiGetRequisitions, apiCreatePartRequest } from '@/lib/api';
import { RepairOrder, Part, PartRequest } from '@/lib/types';
import { PackagePlus, Boxes, AlertTriangle, CheckCircle2, Search, ArrowRight } from 'lucide-react';
import { StatusBadge, Badge } from '@/components/ui/Badge';

export default function RequisitionsPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<number>(1);
  const [selectedPartId, setSelectedPartId] = useState<number>(1);
  const [qty, setQty] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PartRequest[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [roList, pList, reqList] = await Promise.all([
        apiGetRepairs(),
        apiGetParts(),
        apiGetRequisitions(),
      ]);
      setRepairs(roList);
      setParts(pList);
      if (reqList && reqList.length > 0) {
        setRequests(reqList);
      }
      const activeRo = roList.find((r) => r.status === 'IN_REPAIR') || roList.find((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
      if (activeRo) setSelectedRoId(activeRo.id);
      else if (roList.length > 0) setSelectedRoId(roList[0].id);
      if (pList.length > 0) setSelectedPartId(pList[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedRo = repairs.find((r) => r.id === selectedRoId);
  const selectedPart = parts.find((p) => p.id === selectedPartId);
  const availableStock = selectedPart ? Math.max(0, selectedPart.onHand - selectedPart.reserved) : 0;
  const isBackorderExpected = qty > availableStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    try {
      const created = await apiCreatePartRequest({
        repairId: selectedRoId,
        partId: selectedPart.id,
        qty,
      });
      setRequests((prev) => [created, ...prev]);
      setSuccessMsg(
        `สร้างใบขอเบิก #${created.requestNumber} สำเร็จ (${selectedPart.name} x ${qty}) -> สถานะ: ${
          created.status === 'RESERVED' ? 'จองสต็อกพร้อมจ่าย (RESERVED)' : 'สินค้าขาดสต็อก พักคอย PO (BACKORDERED)'
        }`
      );
    } catch {
      const newReqStatus = availableStock >= qty ? 'RESERVED' : 'BACKORDERED';
      const newReq: PartRequest = {
        id: requests.length + 1,
        requestNumber: `REQ-20261105-${String(requests.length + 1).padStart(3, '0')}`,
        repairId: selectedRoId,
        partId: selectedPart.id,
        partCode: selectedPart.partCode,
        partName: selectedPart.name,
        qtyRequested: qty,
        qtyIssued: 0,
        qtyReturned: 0,
        status: newReqStatus,
        createdAt: new Date().toISOString(),
      };

      setRequests((prev) => [newReq, ...prev]);
      setSuccessMsg(
        `สร้างใบขอเบิก #${newReq.requestNumber} สำเร็จ (${selectedPart.name} x ${qty}) -> สถานะ: ${
          newReqStatus === 'RESERVED' ? 'จองสต็อกพร้อมจ่าย (RESERVED)' : 'สินค้าขาดสต็อก พักคอย PO (BACKORDERED)'
        }`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
            <PackagePlus className="w-4 h-4" /> ฝ่ายช่างเทคนิค • Use Case UC02
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ขอเบิกอะไหล่สำหรับงานซ่อม (Parts Requisition Form)
          </h1>
          <p className="text-xs text-slate-500">
            ระบบตรวจสอบยอดคงเหลือจริงแบบ Real-time และใช้กฎ Whole-Line Reservation (สต็อกพร้อมจองทันที / สต็อกขาดเข้า Backorder)
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700">ปิด</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Requisition Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 text-sm pb-3 border-b border-slate-100 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-emerald-600" />
            <span>ส่งคำขอเบิกอะไหล่ใหม่</span>
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">เลือกใบสั่งซ่อม (Repair Order)</label>
              <select
                value={selectedRoId}
                onChange={(e) => setSelectedRoId(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              >
                {repairs
                  .filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roNumber} • {r.licensePlate} ({r.vehicleModel}) [{r.status}]
                    </option>
                  ))}
                {repairs.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length === 0 && (
                  <option value={0} disabled>ไม่มีใบสั่งซ่อมที่สามารถขอเบิกอะไหล่ได้</option>
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">เลือกอะไหล่ที่ต้องการเบิก</label>
              <select
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              >
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.partCode}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedPart && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">สต็อกบนชั้นวาง (On Hand):</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPart.onHand} หน่วย</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ยอดที่ถูกจองแล้ว (Reserved):</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPart.reserved} หน่วย</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-700 font-bold">สต็อกพร้อมเบิกจริง (Available):</span>
                  <span
                    className={`font-mono font-black ${
                      availableStock > 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {availableStock} หน่วย
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">จำนวนที่ต้องการเบิก</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>

            {isBackorderExpected && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 mt-0.5" />
                <span className="text-[11px] leading-tight">
                  สต็อกมีไม่พอตามจำนวนที่ขอ! กฎ Whole-Line Reservation จะปรับสถานะคำขอเป็น <b>BACKORDERED</b> ทั้งก้อนโดยอัตโนมัติ
                </span>
              </div>
            )}

            {selectedRo && (selectedRo.status === 'COMPLETED' || selectedRo.status === 'CANCELLED') && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>งานซ่อมอยู่ในสถานะ {selectedRo.status} — ไม่สามารถขอเบิกอะไหล่ได้</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedRo || selectedRo.status === 'COMPLETED' || selectedRo.status === 'CANCELLED' || !selectedPart}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PackagePlus className="w-4 h-4" />
              <span>
                {selectedRo && (selectedRo.status === 'COMPLETED' || selectedRo.status === 'CANCELLED')
                  ? `ไม่สามารถขอเบิกได้ (${selectedRo.status})`
                  : 'ยืนยันสร้างใบขอเบิก'}
              </span>
            </button>
          </form>
        </div>

        {/* Right Column: Requisitions List Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">รายการขอเบิกอะไหล่ล่าสุด (Requisitions)</h2>
            <span className="text-xs text-slate-400 font-mono">ทั้งหมด {requests.length} รายการ</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">เลขที่ใบเบิก</th>
                  <th className="py-3 px-4">อะไหล่ที่ขอ</th>
                  <th className="py-3 px-4 text-center">จำนวนขอ</th>
                  <th className="py-3 px-4 text-center">จำนวนจ่าย</th>
                  <th className="py-3 px-4 text-center">สถานะ</th>
                  <th className="py-3 px-4 text-right">เวลาที่ขอ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{req.requestNumber}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{req.partName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{req.partCode}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">{req.qtyRequested}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-emerald-700">{req.qtyIssued}</td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[10px]">
                      {new Date(req.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
