'use client';

import React, { useEffect, useState } from 'react';
import { apiGetRepairs, apiUpdateRepairStatus, apiGetBays } from '@/lib/api';
import { RepairOrder, RepairBay } from '@/lib/types';
import {
  ShieldCheck,
  Wrench,
  CheckCircle2,
  Clock,
  Car,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function MechanicBayPage() {
  const [repairs, setRepairs] = useState<RepairOrder[]>([]);
  const [bays, setBays] = useState<RepairBay[]>([]);
  const [loading, setLoading] = useState(true);
  const [qcModalOpen, setQcModalOpen] = useState(false);
  const [selectedRo, setSelectedRo] = useState<RepairOrder | null>(null);
  const [qcNotes, setQcNotes] = useState('ทดสอบขับขี่รอบสั้น ระบบเบรกทำงานปกติ ไฟเตือนดับสนิท ส่งมอบงานได้');
  const [qcChecklist, setQcChecklist] = useState({
    brakeChecked: true,
    fluidsChecked: true,
    noWarningLights: true,
    testDrivePass: true,
    bayCleaned: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [roList, bayList] = await Promise.all([apiGetRepairs(), apiGetBays()]);
      setRepairs(roList.filter((r) => r.status === 'IN_REPAIR' || r.status === 'QC' || r.status === 'IN_DIAGNOSIS'));
      setBays(bayList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenQc = (ro: RepairOrder) => {
    setSelectedRo(ro);
    setQcModalOpen(true);
  };

  const handleCompleteQc = async () => {
    if (!selectedRo) return;
    try {
      await apiUpdateRepairStatus(selectedRo.id, 'AWAITING_PAYMENT', qcNotes);
      alert(`การตรวจเช็ค QC สำเร็จ! รถยนต์ ${selectedRo.licensePlate} ปล่อยช่องซ่อมและส่งต่อไปยังแคชเชียร์`);
      setQcModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึก QC');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> ฝ่ายช่างเทคนิค • Use Case R4 / R5
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ติดตามงานซ่อมในช่องบริการ & ตรวจสอบคุณภาพ (Active Bay & QC Tracker)
          </h1>
          <p className="text-xs text-slate-500">
            ควบคุมความคืบหน้าระหว่างการซ่อมจริงในแต่ละช่องบริการ (Repair Bay) และตรวจรับรองงานก่อนส่งมอบ (Quality Control)
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชสถานะ</span>
        </button>
      </div>

      {/* Active Jobs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {repairs.length === 0 ? (
          <div className="col-span-3 p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            ไม่มีงานซ่อมที่กำลังดำเนินการอยู่ในช่องบริการขณะนี้
          </div>
        ) : (
          repairs.map((ro) => (
            <div
              key={ro.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                    {ro.assignedBayNumber || 'ช่องซ่อม'}
                  </span>
                  <StatusBadge status={ro.status} />
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-base">{ro.licensePlate}</h3>
                  <p className="text-xs text-slate-500">{ro.vehicleModel}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">เลขที่ RO:</span>
                    <span className="font-mono font-bold text-slate-700">{ro.roNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ช่างผู้รับผิดชอบ:</span>
                    <span className="font-medium text-slate-800">{ro.assignedMechanicName || 'ทีมช่าง'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ค่าบริการสุทธิ:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ฿{ro.subtotal?.toLocaleString() || '-'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-slate-500 block mb-0.5">อาการชำรุด:</span>
                  <p className="text-xs text-slate-700 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 line-clamp-2">
                    {ro.symptoms}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                {ro.status === 'IN_REPAIR' && (
                  <button
                    onClick={() => handleOpenQc(ro)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/20"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>ส่งตรวจคุณภาพ (Trigger QC)</span>
                  </button>
                )}
                {ro.status === 'QC' && (
                  <button
                    onClick={() => handleOpenQc(ro)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>บันทึกผ่าน QC & ปล่อยช่องซ่อม</span>
                  </button>
                )}
                {ro.status === 'IN_DIAGNOSIS' && (
                  <span className="text-[11px] text-slate-400 italic text-center w-full block">
                    อยู่ระหว่างการตรวจเช็คและทำใบประเมินราคา
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* QC Modal */}
      {selectedRo && (
        <Modal
          isOpen={qcModalOpen}
          onClose={() => setQcModalOpen(false)}
          title={`ตรวจสอบคุณภาพงานซ่อม (QC Inspection): ${selectedRo.roNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              กรุณาตรวจสอบรายการตรวจเช็ค 5 ข้อมาตรฐานก่อนอนุมัติปล่อยช่องซ่อมและส่งมอบสู่ขั้นตอนการเงิน
            </p>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcChecklist.brakeChecked}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, brakeChecked: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">1. ระบบเบรกและระยะแป้นเบรกทำงานถูกต้อง ปลอดภัย</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcChecklist.fluidsChecked}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, fluidsChecked: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">2. ระดับของเหลวและน้ำมันหล่อลื่นอยู่ในเกณฑ์มาตรฐาน ไม่มีการรั่วซึม</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcChecklist.noWarningLights}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, noWarningLights: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">3. สแกนคอมพิวเตอร์ OBD-II ไม่พบรหัสข้อบกพร่อง ไฟเตือนดับสนิท</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcChecklist.testDrivePass}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, testDrivePass: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">4. ผลการทดสอบขับขี่ ไม่มีเสียงดังผิดปกติ ทรงตัวปกติ</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={qcChecklist.bayCleaned}
                  onChange={(e) => setQcChecklist({ ...qcChecklist, bayCleaned: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <span className="font-semibold text-slate-800">5. ทำความสะอาดยานพาหนะและเก็บอุปกรณ์ออกจากช่องบริการเรียบร้อย</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">บันทึกผลการตรวจสอบ QC</label>
              <textarea
                rows={2}
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => setQcModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCompleteQc}
                disabled={!Object.values(qcChecklist).every(Boolean)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                ผ่านการตรวจ QC & ส่งไปปิดงานซ่อม
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
