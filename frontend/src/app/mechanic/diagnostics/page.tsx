'use client';

import React, { useEffect, useState } from 'react';
import { apiGetRepairs, apiGetParts, apiSubmitEstimate } from '@/lib/api';
import { RepairOrder, Part } from '@/lib/types';
import {
  blockInvalidIntKeys,
  blockInvalidDecimalKeys,
  sanitizeGeneralText,
  validateMeaningfulText,
} from '@/lib/validation';
import {
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Car,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';

export default function DiagnosticsPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estimate line items
  const [lines, setLines] = useState<
    { lineType: 'LABOR' | 'PART'; partId?: number; description: string; qty: number; unitPrice: number }[]
  >([
    { lineType: 'LABOR', description: 'ค่าแรงตรวจเช็คระบบเบรกและช่วงล่างอย่างละเอียด', qty: 1, unitPrice: 600 },
    { lineType: 'PART', partId: 3, description: 'ผ้าเบรกหน้า Ceramic Bendix Ultra Premium', qty: 1, unitPrice: 1850 },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [roList, pList] = await Promise.all([apiGetRepairs(), apiGetParts()]);
      setRepairs(roList);
      setParts(pList);

      const diagnosing = roList.find((r) => r.status === 'IN_DIAGNOSIS' || r.status === 'IN_REPAIR');
      const fallback = roList.find((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
      if (!selectedRoId) {
        if (diagnosing) setSelectedRoId(diagnosing.id);
        else if (fallback) setSelectedRoId(fallback.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedRo = repairs.find((r) => r.id === selectedRoId);
  const canSubmitEstimate =
    !!selectedRo && (selectedRo.status === 'IN_DIAGNOSIS' || selectedRo.status === 'IN_REPAIR');

  const addLine = (type: 'LABOR' | 'PART') => {
    if (type === 'LABOR') {
      setLines([
        ...lines,
        { lineType: 'LABOR', description: 'ค่าบริการซ่อมและเปลี่ยนอะไหล่', qty: 1, unitPrice: 500 },
      ]);
    } else {
      const defaultPart = parts[0];
      setLines([
        ...lines,
        {
          lineType: 'PART',
          partId: defaultPart?.id,
          description: defaultPart?.name || 'อะไหล่',
          qty: 1,
          unitPrice: defaultPart?.unitPrice || 100,
        },
      ]);
    }
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const updateLinePart = (idx: number, partId: number) => {
    const p = parts.find((x) => x.id === partId);
    if (!p) return;
    const copy = [...lines];
    copy[idx] = {
      ...copy[idx],
      partId: p.id,
      description: p.name,
      unitPrice: p.unitPrice,
    };
    setLines(copy);
  };

  const totalLabor = lines
    .filter((l) => l.lineType === 'LABOR')
    .reduce((acc, l) => acc + (Number.isFinite(l.qty * l.unitPrice) ? l.qty * l.unitPrice : 0), 0);

  const totalParts = lines
    .filter((l) => l.lineType === 'PART')
    .reduce((acc, l) => acc + (Number.isFinite(l.qty * l.unitPrice) ? l.qty * l.unitPrice : 0), 0);

  const grandTotal = totalLabor + totalParts;

  const handleSubmitEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);

    if (!selectedRoId || !selectedRo) {
      setErrorMsg('กรุณาเลือกใบสั่งซ่อมที่ต้องการทำใบประเมินราคา');
      return;
    }
    if (!canSubmitEstimate) {
      setErrorMsg(
        `ไม่สามารถบันทึกใบประเมินราคาในสถานะ ${selectedRo.status} ได้ (อนุญาตเฉพาะสถานะ IN_DIAGNOSIS หรือ IN_REPAIR)`
      );
      return;
    }
    if (lines.length === 0) {
      setErrorMsg('กรุณาเพิ่มรายการค่าแรงหรืออะไหล่อย่างน้อย 1 รายการ');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.lineType === 'LABOR') {
        const descErr = validateMeaningfulText(l.description, `รายละเอียดค่าแรงรายการที่ ${i + 1}`, 2);
        if (descErr) {
          setErrorMsg(descErr);
          return;
        }
      } else if (!l.partId) {
        setErrorMsg(`กรุณาเลือกอะไหล่ในรายการที่ ${i + 1}`);
        return;
      }

      if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 999) {
        setErrorMsg(`จำนวนในรายการที่ ${i + 1} ต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง 999`);
        return;
      }

      if (!Number.isFinite(l.unitPrice) || l.unitPrice <= 0 || l.unitPrice > 1000000) {
        setErrorMsg(`ราคาต่อหน่วยในรายการที่ ${i + 1} ต้องมากกว่า 0 และไม่เกิน 1,000,000 บาท`);
        return;
      }
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const sanitizedLines = lines.map((l) => ({
        ...l,
        description: l.description.trim(),
        qty: Math.trunc(l.qty),
        unitPrice: +l.unitPrice.toFixed(2),
      }));
      await apiSubmitEstimate(selectedRoId, sanitizedLines);
      setSuccessMsg(`บันทึกใบประเมินราคาสำเร็จ! ใบสั่งซ่อมปรับสถานะเป็น "รออนุมัติราคา (AWAITING_APPROVAL)"`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการบันทึกใบประเมินราคา');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
            <Wrench className="w-4 h-4" /> ฝ่ายช่างเทคนิค • Use Case UC04
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            บันทึกการตรวจเช็คและการประเมินราคา (Diagnostics & Repair Estimate)
          </h1>
          <p className="text-xs text-slate-500">
            วิเคราะห์สาเหตุความเสียหาย เสนอรายการค่าแรงและอะไหล่ (Revision 1 / Revision N) เพื่อขออนุมัติจากลูกค้า
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

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-700">ปิด</button>
        </div>
      )}

      <form onSubmit={handleSubmitEstimate} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: RO Selection & Vehicle Info */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 pb-3 border-b border-slate-100">
              <Car className="w-4 h-4 text-emerald-600" />
              <span>1. เลือกงานซ่อมที่ต้องการประเมินราคา</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ใบสั่งซ่อมที่กำลังตรวจเช็ค (Active Jobs)
              </label>
              <select
                value={selectedRoId || ''}
                onChange={(e) => {
                  setSelectedRoId(Number(e.target.value));
                  setErrorMsg(null);
                }}
                disabled={loading}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              >
                {repairs
                  .filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roNumber} • {r.licensePlate} ({r.vehicleModel}) [{r.status}]
                    </option>
                  ))}
                {repairs.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED').length === 0 && (
                  <option value="" disabled>ไม่มีใบสั่งซ่อมที่รอการตรวจเช็คหรือประเมินราคา</option>
                )}
              </select>
            </div>

            {selectedRo && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">สถานะ:</span>
                  <StatusBadge status={selectedRo.status} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ช่องบริการ:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedRo.assignedBayNumber || 'ยังไม่กำหนด'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">เลขไมล์:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedRo.mileage.toLocaleString()} กม.
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-0.5">อาการชำรุดที่ลูกค้าแจ้ง:</span>
                  <p className="text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                    {selectedRo.symptoms}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Estimate Line Items Generator */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>2. รายการเสนอราคาค่าแรงและชิ้นส่วนอะไหล่ (Estimate Lines)</span>
                </h2>
                <p className="text-xs text-slate-500">
                  ระบุรายละเอียดงานบริการและเลือกอะไหล่จากคลังสินค้าพร้อมราคามาตรฐาน
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addLine('LABOR')}
                  className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มค่าแรง (Labor)</span>
                </button>
                <button
                  type="button"
                  onClick={() => addLine('PART')}
                  className="px-3 py-1.5 rounded-xl border border-blue-300 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ เพิ่มอะไหล่ (Part)</span>
                </button>
              </div>
            </div>

            {/* Line items table */}
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      line.lineType === 'LABOR'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {line.lineType === 'LABOR' ? 'ค่าแรง' : 'อะไหล่'}
                  </span>

                  {line.lineType === 'PART' ? (
                    <div className="flex-1 w-full sm:w-auto">
                      <select
                        value={line.partId || ''}
                        onChange={(e) => updateLinePart(idx, Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        {parts.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.partCode}] {p.name} (คงเหลือ: {p.onHand - p.reserved})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex-1 w-full sm:w-auto">
                      <input
                        type="text"
                        maxLength={200}
                        value={line.description}
                        onChange={(e) => {
                          const copy = [...lines];
                          copy[idx].description = sanitizeGeneralText(e.target.value, 200);
                          setLines(copy);
                        }}
                        placeholder="รายละเอียดรายการบริการ / ค่าแรง (ต้องมีตัวอักษร)..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">จน.:</span>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        step="1"
                        onKeyDown={blockInvalidIntKeys}
                        value={line.qty}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          const parsed = raw === '' ? 1 : Math.min(999, Math.max(1, parseInt(raw, 10)));
                          const copy = [...lines];
                          copy[idx].qty = parsed;
                          setLines(copy);
                        }}
                        className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-center font-mono font-bold"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-slate-400">฿:</span>
                      <input
                        type="number"
                        min="0"
                        max="1000000"
                        step="0.01"
                        onKeyDown={blockInvalidDecimalKeys}
                        value={line.unitPrice}
                        onChange={(e) => {
                          const val = e.target.value;
                          const parsed = val === '' ? 0 : Math.min(1000000, Math.max(0, Number(val)));
                          const copy = [...lines];
                          copy[idx].unitPrice = Number.isFinite(parsed) ? parsed : 0;
                          setLines(copy);
                        }}
                        className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs text-right font-mono font-bold"
                      />
                    </div>

                    <span className="w-20 text-right font-mono font-bold text-slate-800">
                      ฿{(line.qty * line.unitPrice).toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>รวมค่าแรง (Labor Subtotal):</span>
                <span className="font-mono">฿{totalLabor.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>รวมค่าอะไหล่ (Parts Subtotal):</span>
                <span className="font-mono">฿{totalParts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900 text-sm">
                <span>ยอดรวมทั้งสิ้น (Estimated Grand Total):</span>
                <span className="font-mono text-emerald-700 text-base">฿{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Warning if not in IN_DIAGNOSIS / IN_REPAIR */}
            {selectedRo && !canSubmitEstimate && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  ใบสั่งซ่อมอยู่ในสถานะ <b>{selectedRo.status}</b> — สามารถสร้างหรือแก้ไขใบเสนอราคาได้เฉพาะงานในสถานะ{' '}
                  <b>IN_DIAGNOSIS</b> หรือ <b>IN_REPAIR</b> เท่านั้น
                </span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={saving || !canSubmitEstimate}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50 text-xs disabled:cursor-not-allowed"
            >
              {saving ? (
                <span>กำลังบันทึกใบประเมินราคา...</span>
              ) : selectedRo && !canSubmitEstimate ? (
                <span>ไม่สามารถเสนอราคาได้ (สถานะปัจจุบัน: {selectedRo.status})</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>บันทึกใบเสนอราคาและส่งขออนุมัติ (Submit Estimate Revision)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
