'use client';

import React, { useEffect, useState } from 'react';
import { apiGetRepairSummaryReport } from '@/lib/api';
import { RepairSummaryReport } from '@/lib/types';
import {
  FileText,
  Printer,
  Download,
  Filter,
  Calendar,
  Clock,
  DollarSign,
  Car,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { PrintHeader, PrintSignatures } from '@/components/ui/PrintHeader';

export default function RepairSummaryReportPage() {
  const [report, setReport] = useState<RepairSummaryReport | null>(null);
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-30');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mechanicFilter, setMechanicFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const loadReport = async () => {
    setLoading(true);
    try {
      const mechId = mechanicFilter !== 'ALL' ? Number(mechanicFilter) : undefined;
      const data = await apiGetRepairSummaryReport(startDate, endDate, statusFilter, mechId);
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, statusFilter, mechanicFilter]);

  const handleStartDateChange = (nextStart: string) => {
    if (!nextStart) return;
    setStartDate(nextStart);
    if (endDate && nextStart > endDate) {
      setEndDate(nextStart);
    }
  };

  const handleEndDateChange = (nextEnd: string) => {
    if (!nextEnd) return;
    setEndDate(nextEnd);
    if (startDate && nextEnd < startDate) {
      setStartDate(nextEnd);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!report || report.records.length === 0) return;

    const headers = [
      'เลขที่ใบสั่งซ่อม (RO No.)',
      'หมายเลขคิว (Ticket)',
      'วันที่รับรถ',
      'ทะเบียนรถ',
      'รุ่นรถยนต์',
      'ชื่อลูกค้า',
      'เบอร์โทรศัพท์',
      'อาการชำรุด',
      'ช่างผู้รับผิดชอบ',
      'สถานะ',
      'ค่าแรง (฿)',
      'ค่าอะไหล่ (฿)',
      'ยอดรวมสุทธิ (฿)',
    ];

    const rows = report.records.map((r) => [
      r.roNumber,
      r.ticketNumber,
      new Date(r.queuedAt).toLocaleDateString('th-TH'),
      `"${r.licensePlate}"`,
      `"${r.vehicleModel}"`,
      `"${r.customerName}"`,
      r.customerPhone,
      `"${r.symptoms.replace(/"/g, '""')}"`,
      `"${r.assignedMechanicName || 'ยังไม่ระบุ'}"`,
      r.status,
      r.laborTotal || 0,
      r.partsTotal || 0,
      r.subtotal || 0,
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Repair_Operations_Report_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <FileText className="w-4 h-4" /> Operational Report 1 • Use Case UC16
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            รายงานสรุปใบสั่งซ่อมและสถานะงานบริการ (Repair Operations Report)
          </h1>
          <p className="text-xs text-slate-500">
            วิเคราะห์ปริมาณงานซ่อม, ระยะเวลาซ่อมเฉลี่ย (Turnaround Time), รายได้ค่าแรง vs อะไหล่, และสถานะงานคงค้าง
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={!report || report.records.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออก CSV (Excel)</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>พิมพ์รายงาน (Print / PDF)</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4 print:hidden text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">ตั้งแต่วันที่:</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">ถึงวันที่:</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-600">สถานะ:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="ALL">ทุกสถานะ (All Statuses)</option>
              <option value="QUEUED">รอคิว (QUEUED)</option>
              <option value="IN_DIAGNOSIS">ตรวจเช็ค (IN_DIAGNOSIS)</option>
              <option value="AWAITING_APPROVAL">รออนุมัติราคา (AWAITING_APPROVAL)</option>
              <option value="IN_REPAIR">กำลังซ่อม (IN_REPAIR)</option>
              <option value="QC">ตรวจรับรอง QC (QC)</option>
              <option value="AWAITING_PAYMENT">รอชำระเงิน (AWAITING_PAYMENT)</option>
              <option value="COMPLETED">ซ่อมเสร็จสิ้น (COMPLETED)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">ช่างซ่อม:</span>
            <select
              value={mechanicFilter}
              onChange={(e) => setMechanicFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
            >
              <option value="ALL">ช่างทุกคน (All Mechanics)</option>
              <option value="3">วิชัย (Lead Mechanic)</option>
              <option value="4">อนุชา (Brake Specialist)</option>
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
            title="จำนวนงานซ่อมทั้งหมดในงวด"
            value={`${report.totalJobs} คัน`}
            subtitle={`เสร็จแล้ว: ${report.completedJobs} • รอดำเนินการ: ${report.pendingJobs}`}
            icon={<Car className="w-6 h-6 text-blue-600" />}
          />
          <StatCard
            title="เวลาซ่อมเฉลี่ยต่อคัน (Turnaround)"
            value={`${report.avgTurnaroundHours} ชม.`}
            subtitle="คำนวณจาก Check-in จนถึง QC ผ่าน"
            icon={<Clock className="w-6 h-6 text-purple-600" />}
          />
          <StatCard
            title="รายได้ค่าแรงรวม (Labor Revenue)"
            value={`฿${report.totalLaborRevenue.toLocaleString()}`}
            subtitle="ช่างเทคนิคและงานบริการ"
            icon={<DollarSign className="w-6 h-6 text-emerald-600" />}
          />
          <StatCard
            title="ยอดรวมค่าบริการและอะไหล่สุทธิ"
            value={`฿${report.totalRevenue.toLocaleString()}`}
            subtitle={`ค่าอะไหล่: ฿${report.totalPartsRevenue.toLocaleString()}`}
            icon={<CheckCircle2 className="w-6 h-6 text-amber-600" />}
          />
        </div>
      )}

      {/* Printable Report View (Visible in print and standard web table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden">
        {/* Printable Header */}
        <PrintHeader
          title="รายงานสรุปใบสั่งซ่อมและสถานะงานบริการ (Repair Operations Summary)"
          subtitle={`ช่วงวันที่ตรวจสอบ: ${startDate} ถึง ${endDate} | ตัวกรองสถานะ: ${statusFilter}`}
          documentNo="RPT-OPS-20261105"
        />

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-300 font-bold text-slate-800 uppercase tracking-wider">
                <th className="py-2.5 px-3">เลขที่ RO / คิว</th>
                <th className="py-2.5 px-3">วัน-เวลา รับรถ</th>
                <th className="py-2.5 px-3">ยานพาหนะ & ทะเบียน</th>
                <th className="py-2.5 px-3">ลูกค้า / เบอร์ติดต่อ</th>
                <th className="py-2.5 px-3">อาการชำรุดเบื้องต้น</th>
                <th className="py-2.5 px-3">ช่างผู้รับผิดชอบ</th>
                <th className="py-2.5 px-3 text-center">สถานะ</th>
                <th className="py-2.5 px-3 text-right">ค่าแรง (฿)</th>
                <th className="py-2.5 px-3 text-right">ค่าอะไหล่ (฿)</th>
                <th className="py-2.5 px-3 text-right">ยอดสุทธิ (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report?.records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    ไม่พบข้อมูลงานซ่อมในช่วงเวลาที่เลือก
                  </td>
                </tr>
              ) : (
                report?.records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {r.roNumber}
                      <span className="block text-[10px] text-slate-400">{r.ticketNumber}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(r.queuedAt).toLocaleDateString('th-TH')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block">{r.licensePlate}</span>
                      <span className="text-[10px] text-slate-500">{r.vehicleModel}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-800 block">{r.customerName}</span>
                      <span className="text-[10px] text-slate-400">{r.customerPhone}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">{r.symptoms}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      {r.assignedMechanicName || 'ยังไม่กำหนด'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {r.laborTotal ? `฿${r.laborTotal.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {r.partsTotal ? `฿${r.partsTotal.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {r.subtotal ? `฿${r.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {report && report.records.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-xs">
                  <td colSpan={7} className="py-2.5 px-3 text-right">
                    ยอดรวมสะสมทั้งสิ้น (Grand Total):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-800">
                    ฿{report.totalLaborRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-800">
                    ฿{report.totalPartsRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-950 font-black">
                    ฿{report.totalRevenue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Printable Signatures */}
        <PrintSignatures
          signers={[
            { label: 'เจ้าหน้าที่ผู้จัดทำรายงาน', name: '...................................................' },
            { label: 'หัวหน้าช่างเทคนิคผู้ตรวจทาน', name: '...................................................' },
            { label: 'ผู้จัดการศูนย์บริการ (ผู้อนุมัติ)', name: '...................................................' },
          ]}
        />
      </div>
    </div>
  );
}
