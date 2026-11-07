'use client';

import React, { useEffect, useState } from 'react';
import { apiGetParts, apiCreatePart, apiDeletePart } from '@/lib/api';
import { Part } from '@/lib/types';
import {
  blockInvalidDecimalKeys,
  blockInvalidIntKeys,
  sanitizeCodeUpper,
  sanitizeGeneralText,
  validateMeaningfulText,
  validateShelfLocation,
  validateSku,
} from '@/lib/validation';
import {
  Boxes,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';

export default function WarehouseInventoryPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [partError, setPartError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newPart, setNewPart] = useState({
    partCode: '',
    name: '',
    category: 'FLUIDS',
    shelfLocation: 'A-01-01',
    unitPrice: '1000',
    costPrice: '650',
    reorderLevel: '10',
    description: '',
    isActive: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiGetParts();
      setParts(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeletePart = async (part: Part) => {
    if (!confirm(`ยืนยันการลบอะไหล่ ${part.partCode}? (ลบได้เฉพาะรายการที่ไม่เคยมีการเคลื่อนไหวสต็อก)`)) return;
    try {
      await apiDeletePart(part.id);
      setMsg({ type: 'success', text: `ลบรายการอะไหล่ ${part.partCode} เรียบร้อยแล้ว` });
      loadData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'ไม่สามารถลบรายการอะไหล่ได้' });
    }
  };

  const filtered = parts.filter((p) => {
    const matchesSearch =
      p.partCode.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.shelfLocation.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const lowStockCount = parts.filter((p) => p.onHand <= p.reorderLevel && p.onHand > 0).length;
  const outOfStockCount = parts.filter((p) => p.onHand === 0).length;
  const totalValuation = parts.reduce((acc, p) => acc + p.onHand * p.costPrice, 0);

  const handleCreatePart = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartError(null);

    const skuErr = validateSku(newPart.partCode);
    if (skuErr) {
      setPartError(skuErr);
      return;
    }

    const nameErr = validateMeaningfulText(newPart.name, 'ชื่ออะไหล่', 2);
    if (nameErr) {
      setPartError(nameErr);
      return;
    }

    const shelfErr = validateShelfLocation(newPart.shelfLocation);
    if (shelfErr) {
      setPartError(shelfErr);
      return;
    }

    const costNum = newPart.costPrice.trim() === '' ? NaN : Number(newPart.costPrice);
    const priceNum = newPart.unitPrice.trim() === '' ? NaN : Number(newPart.unitPrice);
    const reorderNum = newPart.reorderLevel.trim() === '' ? NaN : Number(newPart.reorderLevel);

    if (!Number.isFinite(costNum) || costNum < 0 || costNum > 1000000) {
      setPartError('ราคาต้นทุน (Cost) ต้องเป็นตัวเลข 0 ขึ้นไป และไม่เกิน 1,000,000 บาท');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0 || priceNum > 1000000) {
      setPartError('ราคาขายปลีก (Price) ต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท');
      return;
    }
    if (priceNum < costNum) {
      setPartError('ราคาขายปลีกต้องไม่ต่ำกว่าราคาต้นทุน');
      return;
    }
    if (!Number.isInteger(reorderNum) || reorderNum < 0 || reorderNum > 100000) {
      setPartError('จุดสั่งซื้อซ้ำ (Reorder Level) ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
      return;
    }

    try {
      await apiCreatePart({
        partCode: newPart.partCode.trim().toUpperCase(),
        name: newPart.name.trim(),
        category: newPart.category,
        shelfLocation: newPart.shelfLocation.trim().toUpperCase(),
        unitPrice: priceNum,
        costPrice: costNum,
        reorderLevel: reorderNum,
        description: newPart.description,
        isActive: true,
      });
      setMsg({
        type: 'success',
        text: `เพิ่ม/อัปเดตรายการอะไหล่ ${newPart.partCode.trim().toUpperCase()} สำเร็จ`,
      });
      setAddModalOpen(false);
      setNewPart({
        partCode: '',
        name: '',
        category: 'FLUIDS',
        shelfLocation: 'A-01-01',
        unitPrice: '1000',
        costPrice: '650',
        reorderLevel: '10',
        description: '',
        isActive: true,
      });
      loadData();
    } catch (err: any) {
      setPartError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มอะไหล่');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <Boxes className="w-4 h-4" /> แผนกคลังพัสดุ • Use Case UC12
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            จัดการคลังและตรวจสอบอะไหล่ (Spare Parts Catalog & Inventory)
          </h1>
          <p className="text-xs text-slate-500">
            ระบบติดตามสินค้าคงคลัง Shelf Location, ยอดจอง (Reserved), และจุดสั่งซื้อซ้ำ (Reorder Point - ROP)
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
            onClick={() => {
              setPartError(null);
              setAddModalOpen(true);
            }}
            className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มรายการอะไหล่ใหม่</span>
          </button>
        </div>
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
          <button onClick={() => setMsg(null)} className="font-bold">
            ปิด
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="รายการอะไหล่ทั้งหมด"
          value={`${parts.length} รายการ`}
          subtitle="ในฐานข้อมูล Master Data"
          icon={<Boxes className="w-6 h-6 text-amber-600" />}
        />
        <StatCard
          title="มูลค่าสินค้าคงคลังรวม (ต้นทุน)"
          value={`฿${totalValuation.toLocaleString()}`}
          subtitle="คำนวณจาก On Hand * Cost"
          icon={<DollarSign className="w-6 h-6 text-blue-600" />}
        />
        <StatCard
          title="สินค้าใกล้หมด (Low Stock)"
          value={`${lowStockCount} รายการ`}
          subtitle="ยอดสต็อก <= Reorder Point"
          trend="แจ้งเตือนจัดซื้อ"
          trendType="down"
          icon={<TrendingDown className="w-6 h-6 text-amber-600" />}
        />
        <StatCard
          title="สินค้าหมดสต็อก (Out of Stock)"
          value={`${outOfStockCount} รายการ`}
          subtitle="On Hand = 0 หน่วย"
          trend="สั่งด่วน"
          trendType="down"
          icon={<AlertTriangle className="w-6 h-6 text-rose-600" />}
        />
      </div>

      {/* Filter & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            maxLength={80}
            placeholder="ค้นหา SKU, ชื่ออะไหล่, ตำแหน่งวาง..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">หมวดหมู่:</span>
          {['ALL', 'FLUIDS', 'FILTERS', 'BRAKES', 'IGNITION', 'BELTS', 'ELECTRICAL', 'SUSPENSION'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Parts Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">รหัสอะไหล่ (SKU)</th>
                <th className="py-3 px-4">ชื่ออะไหล่ & หมวดหมู่</th>
                <th className="py-3 px-4">ชั้นวาง (Shelf)</th>
                <th className="py-3 px-4 text-right">ราคาขาย (฿)</th>
                <th className="py-3 px-4 text-center">คงเหลือ (On Hand)</th>
                <th className="py-3 px-4 text-center">ยอดจอง (Reserved)</th>
                <th className="py-3 px-4 text-center">พร้อมเบิก (Available)</th>
                <th className="py-3 px-4 text-center">สถานะสต็อก</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((part) => {
                const available = Math.max(0, part.onHand - part.reserved);
                let stockStatus = 'NORMAL';
                if (part.onHand === 0) stockStatus = 'OUT_OF_STOCK';
                else if (part.onHand <= part.reorderLevel) stockStatus = 'LOW_STOCK';

                return (
                  <tr key={part.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{part.partCode}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{part.name}</span>
                      <span className="text-[10px] text-amber-600 font-semibold uppercase">{part.category}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        {part.shelfLocation}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                      ฿{part.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                      {part.onHand}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-amber-700 font-semibold">
                      {part.reserved}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-black text-emerald-700">
                      {available}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={stockStatus} />
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDeletePart(part)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Part Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="เพิ่มรายการอะไหล่ใหม่ (Add Spare Part Master)"
      >
        <form onSubmit={handleCreatePart} className="space-y-4 text-xs">
          {partError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{partError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                รหัสอะไหล่ (SKU Code) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={30}
                placeholder="เช่น BRK-PAD-HON02"
                value={newPart.partCode}
                onChange={(e) => {
                  setPartError(null);
                  setNewPart({ ...newPart, partCode: sanitizeCodeUpper(e.target.value, 30) });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">หมวดหมู่อะไหล่</label>
              <select
                value={newPart.category}
                onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="FLUIDS">FLUIDS (ของเหลว/น้ำมันเครื่อง)</option>
                <option value="FILTERS">FILTERS (ไส้กรอง)</option>
                <option value="BRAKES">BRAKES (ระบบเบรก)</option>
                <option value="IGNITION">IGNITION (ระบบจุดระเบิด)</option>
                <option value="BELTS">BELTS (สายพาน)</option>
                <option value="ELECTRICAL">ELECTRICAL (ระบบไฟ/แบตเตอรี่)</option>
                <option value="SUSPENSION">SUSPENSION (ช่วงล่าง)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              ชื่ออะไหล่และรุ่นที่รองรับ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              placeholder="เช่น ผ้าเบรกหลัง Honda Civic FE (Ceramic)"
              value={newPart.name}
              onChange={(e) => {
                setPartError(null);
                setNewPart({ ...newPart, name: sanitizeGeneralText(e.target.value, 150) });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">ตำแหน่งชั้นวาง (Bin/Shelf)</label>
              <input
                type="text"
                required
                maxLength={20}
                placeholder="เช่น B-02-04"
                value={newPart.shelfLocation}
                onChange={(e) => {
                  setPartError(null);
                  setNewPart({ ...newPart, shelfLocation: sanitizeCodeUpper(e.target.value, 20) });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono uppercase"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">ราคาต้นทุน (Cost)</label>
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={newPart.costPrice}
                onKeyDown={blockInvalidDecimalKeys}
                onChange={(e) => {
                  setPartError(null);
                  setNewPart({ ...newPart, costPrice: e.target.value });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">ราคาขายปลีก (Price)</label>
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                required
                value={newPart.unitPrice}
                onKeyDown={blockInvalidDecimalKeys}
                onChange={(e) => {
                  setPartError(null);
                  setNewPart({ ...newPart, unitPrice: e.target.value });
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">จุดสั่งซื้อซ้ำ (Reorder Level)</label>
            <input
              type="number"
              min="0"
              max="100000"
              step="1"
              required
              value={newPart.reorderLevel}
              onKeyDown={blockInvalidIntKeys}
              onChange={(e) => {
                setPartError(null);
                setNewPart({ ...newPart, reorderLevel: e.target.value.replace(/[^0-9]/g, '') });
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20"
            >
              บันทึกรายการอะไหล่
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
