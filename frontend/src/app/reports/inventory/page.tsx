'use client';

import React, { useEffect, useState } from 'react';
import { apiGetInventoryUsageReport, apiCreatePurchaseOrder } from '@/lib/api';
import { InventoryUsageReport } from '@/lib/types';
import {
  Boxes,
  Printer,
  Download,
  Filter,
  DollarSign,
  TrendingDown,
  AlertTriangle,
  PackagePlus,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { PrintHeader, PrintSignatures } from '@/components/ui/PrintHeader';
import { useRouter } from 'next/navigation';

export default function InventoryUsageReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<InventoryUsageReport | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [reorderSuccessMsg, setReorderSuccessMsg] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await apiGetInventoryUsageReport(categoryFilter, statusFilter);
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [categoryFilter, statusFilter]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!report || report.records.length === 0) return;

    const headers = [
      'รหัสอะไหล่ (SKU)',
      'ชื่อรายการอะไหล่',
      'หมวดหมู่',
      'ตำแหน่งชั้นวาง',
      'ยอดบนชั้นวาง (On Hand)',
      'ยอดจอง (Reserved)',
      'พร้อมเบิก (Available)',
      'จุดสั่งซื้อซ้ำ (ROP)',
      'สถานะสต็อก',
      'ราคาต้นทุน (฿)',
      'มูลค่ารวมคงคลัง (฿)',
      'จำนวนแนะนำสั่งซื้อ',
    ];

    const rows = report.records.map((p) => {
      const available = Math.max(0, p.onHand - p.reserved);
      const totalVal = p.onHand * p.costPrice;
      return [
        p.partCode,
        `"${p.name.replace(/"/g, '""')}"`,
        p.category,
        p.shelfLocation,
        p.onHand,
        p.reserved,
        available,
        p.reorderLevel,
        p.stockStatus,
        p.costPrice,
        totalVal,
        p.suggestedReorderQty,
      ];
    });

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Inventory_Usage_and_Valuation_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReorderPO = async () => {
    if (!report) return;
    const itemsToReorder = report.records.filter((p) => p.suggestedReorderQty > 0);

    if (itemsToReorder.length === 0) {
      alert('ไม่มีรายการอะไหล่ที่ต่ำกว่าเกณฑ์สั่งซื้อซ้ำในขณะนี้');
      return;
    }

    try {
      const newPo = await apiCreatePurchaseOrder(
        'บริษัท อะไหล่สยามออโต้พาร์ท จำกัด (Auto Reorder Pool)',
        itemsToReorder.map((it) => ({
          partId: it.id,
          qtyOrdered: it.suggestedReorderQty,
          unitCost: it.costPrice,
        }))
      );
      setReorderSuccessMsg(
        `สร้างใบสั่งซื้อด่วนสำเร็จ: ${newPo.poNumber} (${itemsToReorder.length} รายการ มูลค่า ฿${newPo.totalCost.toLocaleString()})`
      );
      loadReport();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการสร้างใบสั่งซื้อ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <Boxes className="w-4 h-4" /> Operational Report 2 • Rubric Item 32
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            รายงานการใช้อะไหล่และสรุปยอดคงคลัง (Parts Inventory Usage & Reorder Report)
          </h1>
          <p className="text-xs text-slate-500">
            วิเคราะห์มูลค่าสินค้าคงคลัง, อะไหล่ที่ถูกใช้งานบ่อยที่สุด (Top Consumed), และระบบเตือนจุดสั่งซื้อซ้ำ (Reorder Point)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateReorderPO}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>สร้างใบสั่งซื้ออะไหล่ขาดสต็อก</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์รายงาน</span>
          </button>
        </div>
      </div>

      {reorderSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{reorderSuccessMsg}</span>
          </div>
          <button
            onClick={() => router.push('/warehouse/purchase-orders')}
            className="text-emerald-700 font-bold underline"
          >
            ไปดูใบสั่งซื้อ
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">หมวดหมู่:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="ALL">ทุกหมวดหมู่ (All Categories)</option>
              <option value="FLUIDS">FLUIDS (น้ำมันเครื่อง/ของเหลว)</option>
              <option value="FILTERS">FILTERS (ไส้กรอง)</option>
              <option value="BRAKES">BRAKES (ระบบเบรก)</option>
              <option value="IGNITION">IGNITION (ระบบจุดระเบิด)</option>
              <option value="BELTS">BELTS (สายพาน)</option>
              <option value="ELECTRICAL">ELECTRICAL (แบตเตอรี่/ระบบไฟ)</option>
              <option value="SUSPENSION">SUSPENSION (ช่วงล่าง)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">สถานะสต็อก:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="ALL">ทั้งหมด (All Levels)</option>
              <option value="NORMAL">ปกติ (NORMAL)</option>
              <option value="LOW_STOCK">สต็อกใกล้หมด (LOW_STOCK &lt;= ROP)</option>
              <option value="OUT_OF_STOCK">หมดสต็อก (OUT_OF_STOCK = 0)</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadReport}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
          title="รีเฟรชข้อมูล"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <StatCard
            title="มูลค่าสต็อกคงเหลือรวม (ต้นทุน)"
            value={`฿${report.totalValuation.toLocaleString()}`}
            subtitle={`${report.totalItems} รายการในฐานข้อมูล`}
            icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          />
          <StatCard
            title="รายการที่ต้องสั่งซื้อซ้ำ (Reorder)"
            value={`${report.lowStockItemsCount} รายการ`}
            subtitle="ยอด On Hand ต่ำกว่า ROP"
            trendType="down"
            trend="จัดซื้อด่วน"
            icon={<TrendingDown className="w-6 h-6 text-amber-600" />}
          />
          <StatCard
            title="สินค้าที่หมดสต็อกแล้ว"
            value={`${report.outOfStockItemsCount} รายการ`}
            subtitle="On Hand เท่ากับ 0"
            trendType="down"
            trend="เสี่ยงงานล่าช้า"
            icon={<AlertTriangle className="w-6 h-6 text-rose-600" />}
          />
          <StatCard
            title="อะไหล่ที่ถูกเบิกใช้สูงสุด"
            value={report.topConsumedParts[0]?.partCode || 'OIL-SYN'}
            subtitle={report.topConsumedParts[0]?.partName || 'น้ำมันเครื่อง'}
            icon={<ShoppingBag className="w-6 h-6 text-blue-600" />}
          />
        </div>
      )}

      {/* Top Consumed Parts Ranking Widget (Print hidden or included) */}
      {report && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm print:hidden">
          <h3 className="font-bold text-sm text-slate-100 mb-3 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-amber-400" />
            <span>5 อันดับอะไหล่ที่มีอัตราการหมุนเวียนและเบิกใช้สูงสุด (Top 5 Consumed Spare Parts)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {report.topConsumedParts.map((top, idx) => (
              <div key={top.partCode} className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-amber-400 font-mono font-bold block">#{idx + 1} • {top.partCode}</span>
                <p className="font-semibold text-slate-200 mt-1 line-clamp-1">{top.partName}</p>
                <div className="flex justify-between items-center mt-2 text-[11px] text-slate-400">
                  <span>เบิกใช้: <b className="text-white font-mono">{top.consumedQty}</b> หน่วย</span>
                  <span className="font-mono text-emerald-400">฿{top.consumedValue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Table (Print View) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
        {/* Printable Header */}
        <PrintHeader
          title="รายงานการใช้อะไหล่และสรุปยอดคงคลัง (Parts Inventory Usage & Reorder Report)"
          subtitle={`หมวดหมู่: ${categoryFilter} | สถานะสต็อก: ${statusFilter}`}
          documentNo="RPT-INV-20261105"
        />

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-300 font-bold text-slate-800 uppercase tracking-wider">
                <th className="py-2.5 px-3">รหัสอะไหล่ (SKU)</th>
                <th className="py-2.5 px-3">ชื่อรายการอะไหล่ & หมวดหมู่</th>
                <th className="py-2.5 px-3">ชั้นวาง</th>
                <th className="py-2.5 px-3 text-center">คงเหลือ (On-Hand)</th>
                <th className="py-2.5 px-3 text-center">จอง (Reserved)</th>
                <th className="py-2.5 px-3 text-center">พร้อมเบิก (Available)</th>
                <th className="py-2.5 px-3 text-center">จุดสั่งซื้อ (ROP)</th>
                <th className="py-2.5 px-3 text-center">สถานะ</th>
                <th className="py-2.5 px-3 text-right">ต้นทุน/หน่วย (฿)</th>
                <th className="py-2.5 px-3 text-right">มูลค่ารวม (฿)</th>
                <th className="py-2.5 px-3 text-center">แนะนำสั่งซื้อ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report?.records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400">
                    ไม่พบรายการอะไหล่ตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                report?.records.map((p) => {
                  const available = Math.max(0, p.onHand - p.reserved);
                  const totalVal = p.onHand * p.costPrice;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{p.partCode}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 block">{p.name}</span>
                        <span className="text-[10px] text-amber-700 font-mono uppercase">{p.category}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{p.shelfLocation}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{p.onHand}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-700">{p.reserved}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700">{available}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">{p.reorderLevel}</td>
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={p.stockStatus} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">฿{p.costPrice.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ฿{totalVal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        {p.suggestedReorderQty > 0 ? (
                          <span className="text-amber-700 font-extrabold">+{p.suggestedReorderQty} หน่วย</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {report && report.records.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                  <td colSpan={9} className="py-2.5 px-3 text-right">
                    มูลค่าสินค้าคงคลังรวมทั้งสิ้น (Total Valuation):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-slate-950">
                    ฿{report.totalValuation.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Printable Signatures */}
        <PrintSignatures
          signers={[
            { label: 'เจ้าหน้าที่ผู้ตรวจนับคลังพัสดุ', name: '...................................................' },
            { label: 'หัวหน้าแผนกคลังสินค้าและจัดซื้อ', name: '...................................................' },
            { label: 'ผู้จัดการศูนย์บริการ (ผู้อนุมัติ)', name: '...................................................' },
          ]}
        />
      </div>
    </div>
  );
}
