'use client';

import React, { useEffect, useState } from 'react';
import { apiGetQueue, apiCallNext, apiGetBays, apiUpdateRepairStatus } from '@/lib/api';
import { RepairOrder, RepairBay } from '@/lib/types';
import {
  Layers,
  PhoneCall,
  Clock,
  Car,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Wrench,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function QueueBoardPage() {
  const [queue, setQueue] = useState<RepairOrder[]>([]);
  const [bays, setBays] = useState<RepairBay[]>([]);
  const [loading, setLoading] = useState(true);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [selectedBayId, setSelectedBayId] = useState<number>(1);
  const [selectedMechanicId, setSelectedMechanicId] = useState<number>(3);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [q, b] = await Promise.all([apiGetQueue(), apiGetBays()]);
      setQueue(q);
      setBays(b);
      const freeBay = b.find((x) => !x.isOccupied);
      if (freeBay) setSelectedBayId(freeBay.id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleCallNext = async () => {
    try {
      const called = await apiCallNext(selectedBayId, selectedMechanicId);
      if (called) {
        setActionMessage(`เรียกคิวสำเร็จ: ${called.ticketNumber} (${called.licensePlate}) เข้าสู่ช่อง ${called.assignedBayNumber || 'ซ่อม'}`);
      } else {
        setActionMessage('ไม่มีรถรอในแถวคอยขณะนี้');
      }
      setCallModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเรียกคิว');
    }
  };

  const handleHold = async (roId: number) => {
    if (!confirm('ยืนยันการพักงานรออะไหล่ / ตัดสินใจ (ON_HOLD)? ช่องซ่อมจะถูกปล่อยว่าง')) return;
    try {
      await apiUpdateRepairStatus(roId, 'ON_HOLD', 'พักงานรอการยืนยันอะไหล่');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (roId: number) => {
    if (!confirm('ยืนยันการยกเลิกใบสั่งซ่อมนี้?')) return;
    try {
      await apiUpdateRepairStatus(roId, 'CANCELLED', 'ลูกค้ายกเลิกคิวบริการ');
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Layers className="w-4 h-4" /> แผนกต้อนรับ • Use Case UC01
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            กระดานคิวและเรียกคิวบริการ (Queue Board & Call-Next)
          </h1>
          <p className="text-xs text-slate-500">
            ระบบจัดคิวอัจฉริยะ (Priority First + ป้องกันคิวตกหล่น 120 นาที) และควบคุมสถานะช่องซ่อม
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
            onClick={() => setCallModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/20 active:scale-95 transition-transform"
          >
            <PhoneCall className="w-4 h-4" />
            <span>เรียกคิวถัดไป (Call Next)</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 font-bold">
            ปิด
          </button>
        </div>
      )}

      {/* Repair Bays Status Bar */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          สถานะช่องบริการซ่อม (Repair Bays Occupancy):
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {bays.map((bay) => (
            <div
              key={bay.id}
              className={`rounded-2xl border p-4 transition-all ${
                bay.isOccupied
                  ? 'bg-rose-50/60 border-rose-200'
                  : 'bg-emerald-50/60 border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-xs text-slate-800">{bay.bayNumber}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    bay.isOccupied
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {bay.isOccupied ? 'มีรถซ่อมอยู่' : 'ว่างพร้อมรับรถ'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800 mt-2 line-clamp-1">{bay.name}</p>
              <p className="text-[10px] text-slate-500 mt-1">ประเภท: {bay.bayType}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Waiting Queue List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 text-sm">
              รายการรถในแถวคอย (Waiting Queue List)
            </h2>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
              {queue.length} คัน
            </span>
          </div>
          <p className="text-xs text-slate-400">
            * คิว NORMAL ที่รอนานเกิน 120 นาทีจะได้รับสิทธิ์เลื่อนลำดับเทียบเท่า PRIORITY อัตโนมัติ
          </p>
        </div>

        {queue.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            ไม่มีรถรอคิวอยู่ในระบบในขณะนี้ สามารถลงทะเบียนเปิดคิวใหม่ได้ที่แท็บ Check-In
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {queue.map((item, index) => {
              const isPriority = item.queueClass === 'PRIORITY';

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-bold font-mono text-sm shadow-sm ${
                        isPriority
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <span className="text-[9px] uppercase font-sans">คิวที่</span>
                      <span>#{index + 1}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 text-sm">
                          {item.ticketNumber}
                        </span>
                        <StatusBadge status={item.queueClass} />
                        <StatusBadge status={item.status} />
                        {item.assignedBayNumber && (
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                            ช่อง: {item.assignedBayNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="font-bold text-slate-900 flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          {item.licensePlate} ({item.vehicleModel})
                        </span>
                        <span>ลูกค้า: {item.customerName} ({item.customerPhone})</span>
                      </div>

                      <p className="text-xs text-slate-500 line-clamp-1">
                        อาการ: {item.symptoms}
                      </p>
                      {item.priorityReason && (
                        <p className="text-[11px] text-rose-600 font-semibold">
                          * เหตุผลเร่งด่วน: {item.priorityReason}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center">
                    {item.status === 'QUEUED' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedBayId(1);
                            setCallModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold border border-blue-200"
                        >
                          ส่งมอบช่องซ่อม
                        </button>
                        <button
                          onClick={() => handleHold(item.id)}
                          title="พักงาน"
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancel(item.id)}
                          title="ยกเลิก"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Call Next Modal */}
      <Modal
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title="เรียกคิวถัดไปและมอบหมายช่องซ่อม (Call Next in Queue)"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            ระบบจะเลือกคิวอันดับสูงสุดตามเกณฑ์ Priority และเวลาที่รอคอย (&gt; 120 นาที) และล็อคช่องซ่อมที่เลือก
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              เลือกช่องบริการซ่อม (Repair Bay)
            </label>
            <select
              value={selectedBayId}
              onChange={(e) => setSelectedBayId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
            >
              {bays.map((b) => (
                <option key={b.id} value={b.id} disabled={b.isOccupied}>
                  {b.bayNumber} - {b.name} {b.isOccupied ? '(มีรถซ่อมอยู่)' : '(ว่าง)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              หัวหน้าช่างผู้รับผิดชอบตรวจเช็ค (Lead Mechanic)
            </label>
            <select
              value={selectedMechanicId}
              onChange={(e) => setSelectedMechanicId(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
            >
              <option value={3}>วิชัย ช่างเครื่องยนต์หัวหน้าทีม (Lead Mechanic)</option>
              <option value={4}>อนุชา ช่างช่วงล่างและเบรก (Brake Specialist)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              onClick={() => setCallModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleCallNext}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
            >
              ยืนยันเรียกคิว (Confirm Call Next)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
