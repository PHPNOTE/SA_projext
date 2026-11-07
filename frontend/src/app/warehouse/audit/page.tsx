'use client';

import React, { useEffect, useState } from 'react';
import { apiGetParts, apiAdjustStock } from '@/lib/api';
import { Part } from '@/lib/types';
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Search,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge, Badge } from '@/components/ui/Badge';

export default function WarehouseAuditPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [reason, setReason] = useState<string>('ตรวจนับสต็อกประจำสัปดาห์ (Cycle Count Audit)');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiGetParts();
      setParts(data);
      if (data.length > 0 && !selectedPartId) {
        setSelectedPartId(data[0].id);
        setPhysicalCount(data[0].onHand);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedPart = parts.find((p) => p.id === selectedPartId);
  const delta = selectedPart ? physicalCount - selectedPart.onHand : 0;
  const isBelowReserved = selectedPart ? physicalCount < selectedPart.reserved : false;

  const handleSelectPart = (p: Part) => {
    setSelectedPartId(p.id);
    setPhysicalCount(p.onHand);
    setMsg(null);
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) return;

    if (!reason.trim()) {
      setMsg({ type: 'error', text: 'กรุณาระบุเหตุผลประกอบการปรับปรุงยอดสต็อก (Mandatory Reason)' });
      return;
    }

    if (isBelowReserved) {
      setMsg({
        type: 'error',
        text: `ไม่สามารถปรับสต็อกต่ำกว่ายอดที่ถูกจองแล้ว (${selectedPart.reserved} หน่วย) ได้ตามกฎระบบ!`,
      });
      return;
    }

    setSubmitting(true);
    try {
      await apiAdjustStock(selectedPart.id, delta, reason);
      setMsg({
        type: 'success',
        text: `ปรับยอดสต็อกสำเร็จ: ${selectedPart.name} ปรับ ${delta >= 0 ? `+${delta}` : delta} หน่วย (คงเหลือใหม่: ${physicalCount})`,
      });
      loadData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'เกิดข้อผิดพลาดในการปรับยอดสต็อก' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <FileSpreadsheet className="w-4 h-4" /> แผนกคลังพัสดุ • Use Case UC14
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ตรวจนับสต็อกและปรับยอดสินค้า (Cycle Count Stock Audit)
          </h1>
          <p className="text-xs text-slate-500">
            กระทบยอดสินค้าจริงบนชั้นวาง (Physical Count) เทียบกับระบบ พร้อมบันทึกเหตุผลความคลาดเคลื่อนลงสมุดบัญชีสต็อก (Ledger)
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชยอดสต็อก</span>
        </button>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)}>ปิด</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parts Selection List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-sm">เลือกอะไหล่ที่ต้องการตรวจนับ</h2>
            <span className="text-xs text-slate-400 font-mono">{parts.length} รายการ</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหา SKU หรือชื่ออะไหล่..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="max-h-[500px] overflow-y-auto space-y-1.5 divide-y divide-slate-50">
            {parts
              .filter(
                (p) =>
                  p.partCode.toLowerCase().includes(search.toLowerCase()) ||
                  p.name.toLowerCase().includes(search.toLowerCase())
              )
              .map((p) => {
                const isSelected = p.id === selectedPartId;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPart(p)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono font-bold text-slate-900">{p.partCode}</span>
                      <span className="font-mono text-slate-600">ชั้น: {p.shelfLocation}</span>
                    </div>
                    <p className="font-medium text-slate-700 line-clamp-1 mt-0.5">{p.name}</p>
                    <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                      <span>คงเหลือ: <b className="text-slate-800">{p.onHand}</b></span>
                      <span>จอง: <b className="text-amber-700">{p.reserved}</b></span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Audit Form */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPart ? (
            <form onSubmit={handleAdjust} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="font-mono font-bold text-amber-700 text-xs">{selectedPart.partCode}</span>
                  <h2 className="text-base font-bold text-slate-900 mt-0.5">{selectedPart.name}</h2>
                  <p className="text-xs text-slate-500">ตำแหน่งจัดเก็บ: {selectedPart.shelfLocation}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">ราคาต้นทุน</span>
                  <span className="font-mono font-bold text-slate-800">฿{selectedPart.costPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* Comparison Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                  <span className="text-xs text-slate-500 block">ยอดในระบบปัจจุบัน (System On Hand)</span>
                  <span className="font-mono font-black text-2xl text-slate-800 mt-1 block">
                    {selectedPart.onHand}
                  </span>
                  <span className="text-[10px] text-slate-400">หน่วย</span>
                </div>

                <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200 text-center">
                  <span className="text-xs text-amber-800 block">ยอดติดจองใช้งาน (Reserved Stock)</span>
                  <span className="font-mono font-black text-2xl text-amber-700 mt-1 block">
                    {selectedPart.reserved}
                  </span>
                  <span className="text-[10px] text-amber-600">* ห้ามปรับต่ำกว่ายอดนี้</span>
                </div>

                <div
                  className={`rounded-xl p-4 border text-center ${
                    delta === 0
                      ? 'bg-slate-50 border-slate-200'
                      : delta > 0
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <span className="text-xs text-slate-500 block">ผลต่างการตรวจนับ (Variance / Delta)</span>
                  <span
                    className={`font-mono font-black text-2xl mt-1 block ${
                      delta === 0
                        ? 'text-slate-700'
                        : delta > 0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {delta === 0 ? 'ตรงกับสต็อก' : delta > 0 ? 'สินค้าเกิน' : 'สินค้าขาดหาย'}
                  </span>
                </div>
              </div>

              {/* Physical Count Input */}
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    ยอดตรวจนับจริงบนชั้นวาง (Physical Count on Shelf) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={physicalCount}
                    onChange={(e) => setPhysicalCount(Number(e.target.value))}
                    className="w-full sm:w-1/2 px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    เหตุผลความจำเป็นในการปรับปรุงยอด (Mandatory Reason) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="เช่น ตรวจนับสต็อกประจำเดือนพบสินค้าเสียหายจากการจัดวาง นำส่งทำลาย..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    * ข้อกำหนดระบบ: ช่องเหตุผลต้องไม่ว่างเปล่า และระบบจะบันทึกประวัติการปรับยอดเข้าสู่สมุดบัญชีสต็อก (ADJUST)
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || delta === 0 || isBelowReserved}
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 disabled:opacity-40 flex items-center gap-2"
                >
                  <Scale className="w-4 h-4" />
                  <span>บันทึกปรับยอดสต็อก (Confirm Stock Adjustment)</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
              กรุณาเลือกรายการอะไหล่จากคอลัมน์ซ้ายเพื่อเริ่มตรวจนับ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
