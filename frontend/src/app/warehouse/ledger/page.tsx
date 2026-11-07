'use client';

import React, { useEffect, useState } from 'react';
import { apiGetStockLedger } from '@/lib/api';
import { StockMovement } from '@/lib/types';
import { Layers, Search, Filter, RefreshCw, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export default function StockLedgerPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiGetStockLedger();
      setMovements(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = movements.filter((m) => {
    const matchesSearch =
      m.partCode.toLowerCase().includes(search.toLowerCase()) ||
      m.partName.toLowerCase().includes(search.toLowerCase()) ||
      (m.reason && m.reason.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'ALL' || m.movementType === typeFilter;
    return matchesSearch && matchesType;
  });

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'RECEIPT':
        return <Badge variant="success">รับเข้าสต็อก (RECEIPT)</Badge>;
      case 'RESERVE':
        return <Badge variant="warning">จองเพื่อซ่อม (RESERVE)</Badge>;
      case 'RELEASE':
        return <Badge variant="neutral">ปลดการจอง (RELEASE)</Badge>;
      case 'ISSUE':
        return <Badge variant="info">เบิกจ่ายจริง (ISSUE)</Badge>;
      case 'RETURN':
        return <Badge variant="purple">รับคืนเข้าคลัง (RETURN)</Badge>;
      case 'ADJUST':
        return <Badge variant="danger">ปรับยอดตรวจนับ (ADJUST)</Badge>;
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <Layers className="w-4 h-4" /> แผนกคลังพัสดุ • Use Case UC14
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            สมุดบันทึกการเคลื่อนไหวสต็อก (Stock Movement Audit Ledger)
          </h1>
          <p className="text-xs text-slate-500">
            ระบบตรวจสอบการเข้า-ออกของสินค้าคงคลังแบบ Append-only (Single-Door Stock Engine Invariants)
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชประวัติ</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="ค้นหา SKU, ชื่ออะไหล่, เหตุผล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">ประเภท:</span>
          {['ALL', 'RECEIPT', 'RESERVE', 'ISSUE', 'RETURN', 'ADJUST'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                typeFilter === t
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">วันที่ / เวลา</th>
                <th className="py-3 px-4">รหัสอะไหล่ & รายการ</th>
                <th className="py-3 px-4 text-center">ประเภทรายการ</th>
                <th className="py-3 px-4 text-center">Δ บนชั้นวาง (On Hand)</th>
                <th className="py-3 px-4 text-center">Δ ยอดจอง (Reserved)</th>
                <th className="py-3 px-4">เหตุผล / อ้างอิงเอกสาร</th>
                <th className="py-3 px-4">ผู้บันทึก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{item.partName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.partCode}</span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {getMovementBadge(item.movementType)}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold">
                    <span
                      className={
                        item.deltaOnHand > 0
                          ? 'text-emerald-600'
                          : item.deltaOnHand < 0
                          ? 'text-rose-600'
                          : 'text-slate-400'
                      }
                    >
                      {item.deltaOnHand > 0 ? `+${item.deltaOnHand}` : item.deltaOnHand}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold">
                    <span
                      className={
                        item.deltaReserved > 0
                          ? 'text-amber-600'
                          : item.deltaReserved < 0
                          ? 'text-blue-600'
                          : 'text-slate-400'
                      }
                    >
                      {item.deltaReserved > 0 ? `+${item.deltaReserved}` : item.deltaReserved}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate">
                    {item.reason || '-'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-medium">
                    {item.userName || 'ระบบ (System)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
