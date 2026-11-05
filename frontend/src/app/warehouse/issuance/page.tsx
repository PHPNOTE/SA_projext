'use client';

import React, { useState, useEffect } from 'react';
import { apiGetParts, apiIssueParts, apiReturnParts } from '@/lib/api';
import { Part, PartRequest } from '@/lib/types';
import {
  ArrowRightLeft,
  CheckCircle2,
  Undo2,
  PackageCheck,
  Search,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function WarehouseIssuancePage() {
  const [activeTab, setActiveTab] = useState<'ISSUE' | 'RETURN'>('ISSUE');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  // Sample pending requisitions to issue
  const [pendingRequests, setPendingRequests] = useState<PartRequest[]>([
    {
      id: 101,
      requestNumber: 'REQ-20261105-002',
      repairId: 1,
      partId: 3,
      partCode: 'BRK-PAD-FR01',
      partName: 'ผ้าเบรกหน้า Ceramic Bendix Ultra Premium',
      qtyRequested: 1,
      qtyIssued: 0,
      qtyReturned: 0,
      status: 'RESERVED',
      createdAt: '2026-11-05T08:50:00Z',
    },
    {
      id: 102,
      requestNumber: 'REQ-20261105-004',
      repairId: 2,
      partId: 1,
      partCode: 'OIL-SYN-5W30',
      partName: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4L)',
      qtyRequested: 1,
      qtyIssued: 0,
      qtyReturned: 0,
      status: 'RESERVED',
      createdAt: '2026-11-05T09:10:00Z',
    },
  ]);

  // Sample issued parts available for return
  const [issuedRequests, setIssuedRequests] = useState<PartRequest[]>([
    {
      id: 99,
      requestNumber: 'REQ-20261105-001',
      repairId: 1,
      partId: 1,
      partCode: 'OIL-SYN-5W30',
      partName: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4L)',
      qtyRequested: 1,
      qtyIssued: 1,
      qtyReturned: 0,
      status: 'ISSUED',
      createdAt: '2026-11-05T08:45:00Z',
    },
    {
      id: 98,
      requestNumber: 'REQ-20261104-012',
      repairId: 5,
      partId: 2,
      partCode: 'FLT-OIL-TY01',
      partName: 'ไส้กรองน้ำมันเครื่อง Toyota/Honda',
      qtyRequested: 2,
      qtyIssued: 2,
      qtyReturned: 0,
      status: 'ISSUED',
      createdAt: '2026-11-04T10:15:00Z',
    },
  ]);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedReturnReq, setSelectedReturnReq] = useState<PartRequest | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('อะไหล่เหลือจากการซ่อม นำคืนเข้าสต็อก');
  const [msg, setMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const pList = await apiGetParts();
      setParts(pList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIssue = async (req: PartRequest) => {
    try {
      await apiIssueParts(req.id, req.partId, req.qtyRequested);
      setPendingRequests(pendingRequests.filter((r) => r.id !== req.id));
      setIssuedRequests([
        {
          ...req,
          qtyIssued: req.qtyRequested,
          status: 'ISSUED',
        },
        ...issuedRequests,
      ]);
      setMsg(`จ่ายอะไหล่สำเร็จ: ${req.partName} จำนวน ${req.qtyRequested} หน่วย (หักยอด On Hand & Reserved)`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการจ่ายอะไหล่');
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedReturnReq) return;
    try {
      await apiReturnParts(selectedReturnReq.id, selectedReturnReq.partId, returnQty, returnReason);
      setIssuedRequests(
        issuedRequests.map((r) =>
          r.id === selectedReturnReq.id
            ? { ...r, qtyReturned: r.qtyReturned + returnQty, status: 'RETURNED' }
            : r
        )
      );
      setMsg(`รับคืนอะไหล่ ${selectedReturnReq.partName} จำนวน ${returnQty} หน่วยเข้าสู่สต็อกเรียบร้อยแล้ว`);
      setReturnModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการรับคืนอะไหล่');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <ArrowRightLeft className="w-4 h-4" /> แผนกคลังพัสดุ • Use Case W2 / W3
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            อนุมัติจ่ายและรับคืนอะไหล่ (Parts Issuance & Return)
          </h1>
          <p className="text-xs text-slate-500">
            ควบคุมการเบิกจ่ายตามคำขอช่าง และรับคืนอะไหล่เหลือใช้เพื่อหักลดค่าบริการในใบเสร็จของลูกค้าอย่างถูกต้อง
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('ISSUE')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'ISSUE'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            รายการรอจ่ายอะไหล่ (Issuance)
          </button>
          <button
            onClick={() => setActiveTab('RETURN')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'RETURN'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            รับคืนอะไหล่เข้าสต็อก (Returns)
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

      {activeTab === 'ISSUE' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                รายการอะไหล่ที่จองแล้ว รอเจ้าหน้าที่จ่ายของ (Pending Issuance)
              </h2>
              <p className="text-xs text-slate-400">
                เมื่อกด "จ่ายอะไหล่" ระบบจะตัด On-Hand และ Reserved พร้อมบันทึก ISSUE ลงสมุดบัญชีสต็อก
              </p>
            </div>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold font-mono">
              {pendingRequests.length} รายการ
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                ไม่มีรายการขอเบิกค้างจ่ายในขณะนี้
              </div>
            ) : (
              pendingRequests.map((req) => {
                const partInfo = parts.find((p) => p.id === req.partId);

                return (
                  <div
                    key={req.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700 text-xs">
                          {req.requestNumber}
                        </span>
                        <Badge variant="warning">จองสต็อกแล้ว (RESERVED)</Badge>
                        <span className="text-xs text-slate-400 font-mono">
                          RO #{req.repairId}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm">{req.partName}</h3>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="font-mono">รหัส: {req.partCode}</span>
                        {partInfo && (
                          <span className="flex items-center gap-1 font-semibold text-amber-700">
                            <MapPin className="w-3.5 h-3.5" /> ช่องชั้นวาง: {partInfo.shelfLocation}
                          </span>
                        )}
                        <span>จำนวนที่ต้องจ่าย: <b className="text-slate-900 font-mono text-sm">{req.qtyRequested}</b> หน่วย</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleIssue(req)}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 self-end sm:self-center"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>ยืนยันจ่ายอะไหล่ให้ช่าง</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                รายการอะไหล่ที่จ่ายไปแล้ว และสามารถรับคืนได้ (Issued Parts Eligible for Return)
              </h2>
              <p className="text-xs text-slate-400">
                รับคืนอะไหล่ที่ไม่ถูกใช้งานเข้าสต็อก เพื่อลดภาระค่าใช้จ่ายของลูกค้าตามเกณฑ์ Net Issued Parts
              </p>
            </div>
            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold font-mono">
              {issuedRequests.length} รายการ
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {issuedRequests.map((req) => (
              <div
                key={req.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700 text-xs">
                      {req.requestNumber}
                    </span>
                    <Badge variant="success">จ่ายแล้ว (ISSUED)</Badge>
                    {req.qtyReturned > 0 && (
                      <Badge variant="purple">รับคืนแล้ว {req.qtyReturned} หน่วย</Badge>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{req.partName}</h3>
                  <p className="text-xs text-slate-500">
                    รหัส: {req.partCode} • จ่ายไปแล้ว: {req.qtyIssued} หน่วย (คืนแล้ว: {req.qtyReturned} หน่วย)
                  </p>
                </div>

                <button
                  onClick={() => {
                    setSelectedReturnReq(req);
                    setReturnQty(1);
                    setReturnModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 self-end sm:self-center"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>รับคืนเข้าสต็อก</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return Modal */}
      {selectedReturnReq && (
        <Modal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          title={`รับคืนอะไหล่เข้าสต็อก: ${selectedReturnReq.partCode}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500">รายการอะไหล่:</span>
              <p className="font-bold text-slate-800 text-sm">{selectedReturnReq.partName}</p>
              <p className="text-slate-500">จำนวนที่เคยจ่าย: {selectedReturnReq.qtyIssued} หน่วย</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">จำนวนที่รับคืน</label>
              <input
                type="number"
                min="1"
                max={selectedReturnReq.qtyIssued - selectedReturnReq.qtyReturned}
                value={returnQty}
                onChange={(e) => setReturnQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">เหตุผลการรับคืน</label>
              <textarea
                rows={2}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => setReturnModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmReturn}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
              >
                บันทึกรับคืนเข้าสต็อก
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
