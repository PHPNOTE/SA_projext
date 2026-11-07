'use client';

import React, { useEffect, useState } from 'react';
import {
  apiGetPurchaseOrders,
  apiCreatePurchaseOrder,
  apiReceivePurchaseOrder,
  apiGetParts,
} from '@/lib/api';
import { PurchaseOrder, Part } from '@/lib/types';
import {
  PackagePlus,
  Truck,
  Plus,
  CheckCircle2,
  Boxes,
  Calendar,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('บริษัท อะไหล่สยามออโต้พาร์ท จำกัด');
  const [poLines, setPoLines] = useState<
    { partId: number; qtyOrdered: number; unitCost: number }[]
  >([{ partId: 1, qtyOrdered: 20, unitCost: 950 }]);
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pos, pList] = await Promise.all([apiGetPurchaseOrders(), apiGetParts()]);
      setOrders(pos);
      setParts(pList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newPo = await apiCreatePurchaseOrder(supplierName, poLines);
      setMsg(`สร้างใบสั่งซื้อใหม่สำเร็จ: ${newPo.poNumber} ยอดรวม ฿${newPo.totalCost.toLocaleString()}`);
      setCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ');
    }
  };

  const handleReceivePo = async (po: PurchaseOrder) => {
    if (!confirm(`ยืนยันการรับสินค้าตามใบสั่งซื้อ ${po.poNumber}? ระบบจะเพิ่มสต็อกและจัดสรรค้างส่ง (FIFO Backorder) อัตโนมัติ`))
      return;
    try {
      await apiReceivePurchaseOrder(
        po.id,
        po.lines.map((l) => ({ poLineId: l.id, qtyReceived: l.qtyOrdered }))
      );
      setMsg(`รับสินค้าตามใบสั่งซื้อ ${po.poNumber} เรียบร้อยแล้ว! สต็อกปรับเพิ่มและจัดสรรให้กับงานซ่อมที่รออะไหล่อัตโนมัติ`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการรับสินค้า');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <Truck className="w-4 h-4" /> แผนกคลังพัสดุ • Use Case UC06 / UC13
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            สั่งซื้ออะไหล่และรับเข้าสต็อก (Purchase Orders & Receiving)
          </h1>
          <p className="text-xs text-slate-500">
            ระบบจัดซื้อและรับอะไหล่จากคู่ค้า (Supplier PO) พร้อมระบบ FIFO Backorder Auto-Allocation จัดสรรอะไหล่ให้กับงานซ่อมที่รอคอยทันที
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>ออกใบสั่งซื้อ (Create PO)</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{msg}</span>
          </div>
          <button onClick={() => setMsg(null)} className="text-emerald-700">ปิด</button>
        </div>
      )}

      {/* PO List */}
      <div className="space-y-4">
        {orders.map((po) => {
          const isReceived = po.status === 'RECEIVED';

          return (
            <div
              key={po.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">{po.poNumber}</span>
                      <StatusBadge status={po.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">ผู้จำหน่าย: {po.supplierName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">มูลค่าการสั่งซื้อรวม</span>
                    <span className="font-mono font-black text-slate-900 text-sm">
                      ฿{po.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {!isReceived && (
                    <button
                      onClick={() => handleReceivePo(po)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>รับของเข้าสต็อก (Receive & Allocate)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Line items table */}
              <div className="bg-slate-50/70 rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-100/50">
                      <th className="py-2 px-3">รหัสอะไหล่</th>
                      <th className="py-2 px-3">ชื่อรายการ</th>
                      <th className="py-2 px-3 text-center">สั่งซื้อ</th>
                      <th className="py-2 px-3 text-center">รับแล้ว</th>
                      <th className="py-2 px-3 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-2 px-3 text-right">รวมเงิน (฿)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {po.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{l.partCode}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{l.partName}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold">{l.qtyOrdered}</td>
                        <td className="py-2 px-3 text-center font-mono text-emerald-700 font-bold">
                          {l.qtyReceived}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">฿{l.unitCost.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          ฿{(l.qtyOrdered * l.unitCost).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create PO Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="ออกใบสั่งซื้ออะไหล่ใหม่ (Create Supplier Purchase Order)"
        maxWidth="xl"
      >
        <form onSubmit={handleCreatePo} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้จัดจำหน่าย / ซัพพลายเออร์</label>
            <input
              type="text"
              required
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="space-y-3">
            <label className="block font-semibold text-slate-700">รายการอะไหล่ที่ต้องการสั่งซื้อ</label>
            {poLines.map((line, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                <select
                  value={line.partId}
                  onChange={(e) => {
                    const copy = [...poLines];
                    const selected = parts.find((p) => p.id === Number(e.target.value));
                    copy[idx].partId = Number(e.target.value);
                    if (selected) copy[idx].unitCost = selected.costPrice;
                    setPoLines(copy);
                  }}
                  className="flex-1 min-w-0 w-0 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.partCode}] {p.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400">จน.:</span>
                  <input
                    type="number"
                    min="1"
                    value={line.qtyOrdered}
                    onChange={(e) => {
                      const copy = [...poLines];
                      copy[idx].qtyOrdered = Math.max(1, Number(e.target.value));
                      setPoLines(copy);
                    }}
                    className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-center"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-slate-400">ต้นทุน:</span>
                  <input
                    type="number"
                    value={line.unitCost}
                    onChange={(e) => {
                      const copy = [...poLines];
                      copy[idx].unitCost = Number(e.target.value);
                      setPoLines(copy);
                    }}
                    className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono text-right"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20"
            >
              ยืนยันออกใบสั่งซื้อ
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
