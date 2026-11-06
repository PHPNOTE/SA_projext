'use client';

import React, { useEffect, useState } from 'react';
import { apiGetInvoices, apiGetRepairs, apiCreateInvoiceForRepair, apiPayInvoice } from '@/lib/api';
import { Invoice, RepairOrder } from '@/lib/types';
import {
  Receipt,
  Printer,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Car,
  User,
  PlusCircle,
} from 'lucide-react';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PrintHeader, PrintSignatures } from '@/components/ui/PrintHeader';

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [readyRepairs, setReadyRepairs] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('TRANSFER');
  const [payerType, setPayerType] = useState<'CUSTOMER' | 'INSURER'>('CUSTOMER');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invs, roList] = await Promise.all([apiGetInvoices(), apiGetRepairs()]);
      setInvoices(invs);
      const ready = roList.filter((r) => r.status === 'AWAITING_PAYMENT');
      setReadyRepairs(ready);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateInvoice = async (roId: number) => {
    try {
      const newInv = await apiCreateInvoiceForRepair(roId);
      setSelectedInvoice(newInv);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการออกใบเสร็จ');
    }
  };

  const isInvoicePaid = (inv: Invoice) => {
    const totalPaid = (inv.payments || [])
      .filter((p) => p.payerType === 'CUSTOMER')
      .reduce((acc, p) => acc + p.amount, 0);
    return (inv.status as string) === 'PAID' || totalPaid >= inv.customerDue;
  };

  const isInvoiceCancelled = (inv: Invoice) => {
    return inv.status === 'VOID' || (inv.status as string) === 'CANCELLED';
  };

  const handleOpenPay = (inv: Invoice) => {
    if (isInvoicePaid(inv) || isInvoiceCancelled(inv)) {
      alert('ไม่สามารถรับชำระเงินสำหรับใบแจ้งหนี้ที่ชำระแล้วหรือถูกยกเลิก');
      return;
    }
    setSelectedInvoice(inv);
    const paidCustomer = (inv.payments || [])
      .filter((p) => p.payerType === 'CUSTOMER')
      .reduce((acc, p) => acc + p.amount, 0);
    const remaining = Math.max(0, +(inv.customerDue - paidCustomer).toFixed(2));
    setPayAmount(remaining);
    setPayerType('CUSTOMER');
    setPayModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedInvoice) return;
    if (isInvoicePaid(selectedInvoice) || isInvoiceCancelled(selectedInvoice)) {
      alert('ไม่สามารถรับชำระเงินสำหรับใบแจ้งหนี้ที่ชำระแล้วหรือถูกยกเลิก');
      return;
    }
    try {
      const res = await apiPayInvoice(selectedInvoice.id, payAmount, payMethod, payerType);
      setPaymentSuccess(`บันทึกการชำระเงินสำเร็จ! เลขที่ใบเสร็จรับเงิน: ${res.receiptNumber}`);
      setPayModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกชำระเงิน');
    }
  };

  const handlePrint = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <Receipt className="w-4 h-4" /> แผนกต้อนรับและการเงิน • Use Case R6
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ตรวจสอบและปิดงานซ่อมออกใบเสร็จ (Repair Billing & Settlement)
          </h1>
          <p className="text-xs text-slate-500">
            คำนวณค่าแรงและอะไหล่สุทธิ (Net Issued), ภาษีมูลค่าเพิ่ม 7% (VAT), หักยอดประกัน และพิมพ์ใบเสร็จรับเงิน
          </p>
        </div>
      </div>

      {paymentSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{paymentSuccess}</span>
          </div>
          <button onClick={() => setPaymentSuccess(null)} className="text-emerald-700">ปิด</button>
        </div>
      )}

      {/* Repairs Waiting for Billing Section */}
      {readyRepairs.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <h2 className="font-bold text-amber-900 text-sm">
                งานซ่อมที่ผ่าน QC แล้ว รอการออกใบเสร็จและชำระเงิน ({readyRepairs.length} รายการ)
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readyRepairs.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-amber-200 p-4 flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800 text-xs">{r.roNumber}</span>
                    <Badge variant="warning">รอออกใบแจ้งหนี้</Badge>
                  </div>
                  <p className="text-xs font-bold text-slate-900 mt-1">{r.licensePlate} ({r.vehicleModel})</p>
                  <p className="text-[11px] text-slate-500">ลูกค้า: {r.customerName} • ฿{r.subtotal?.toLocaleString() || '-'}</p>
                </div>
                <button
                  onClick={() => handleGenerateInvoice(r.id)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>ออกใบแจ้งหนี้</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print:hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm">ประวัติใบแจ้งหนี้และใบเสร็จรับเงิน (Issued Invoices)</h2>
          <span className="text-xs text-slate-400 font-mono">ทั้งหมด {invoices.length} ฉบับ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">เลขที่ใบแจ้งหนี้</th>
                <th className="py-3 px-4">อ้างอิง RO / การขาย</th>
                <th className="py-3 px-4">ลูกค้า</th>
                <th className="py-3 px-4 text-right">ยอดก่อนภาษี</th>
                <th className="py-3 px-4 text-right">VAT 7%</th>
                <th className="py-3 px-4 text-right">ยอดที่ต้องชำระ</th>
                <th className="py-3 px-4 text-center">สถานะชำระ</th>
                <th className="py-3 px-4 text-center">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const isPaidFull = isInvoicePaid(inv);
                const isCancelled = isInvoiceCancelled(inv);

                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{inv.invoiceNumber}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{inv.roNumber || inv.saleNumber || '-'}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800 block">{inv.customerName}</span>
                      <span className="text-[10px] text-slate-400">{inv.customerPhone}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">฿{inv.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-500">฿{inv.vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ฿{inv.customerDue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isCancelled ? (
                        <Badge variant="danger">ยกเลิก ({inv.status})</Badge>
                      ) : isPaidFull ? (
                        <Badge variant="success">ชำระครบแล้ว</Badge>
                      ) : (
                        <Badge variant="warning">รอชำระเงิน</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!isPaidFull && !isCancelled && (
                          <button
                            onClick={() => handleOpenPay(inv)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>รับชำระ</span>
                          </button>
                        )}
                        <button
                          onClick={() => handlePrint(inv)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs flex items-center gap-1"
                          title="พิมพ์ใบแจ้งหนี้ / ใบเสร็จรับเงิน"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>พิมพ์</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTABLE RECEIPT / TAX INVOICE TEMPLATE (Shown in @media print or preview) */}
      {selectedInvoice && (
        <div className="hidden print:block bg-white p-8 max-w-4xl mx-auto text-black">
          <PrintHeader
            title="ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ (Receipt / Tax Invoice)"
            documentNo={selectedInvoice.invoiceNumber}
            dateStr={new Date(selectedInvoice.issuedAt).toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />

          <div className="grid grid-cols-2 gap-4 my-4 p-4 border border-slate-300 rounded text-xs">
            <div>
              <p className="font-bold text-slate-800">ข้อมูลลูกค้าผู้รับบริการ:</p>
              <p className="text-sm font-semibold">{selectedInvoice.customerName}</p>
              <p className="text-slate-600">เบอร์โทรศัพท์: {selectedInvoice.customerPhone}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">ข้อมูลการซ่อม / ใบสั่งงาน:</p>
              <p className="font-mono">{selectedInvoice.roNumber || selectedInvoice.saleNumber || '-'}</p>
              <p className="text-slate-600">สถานะ: {selectedInvoice.status}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs my-4 border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-2 w-12 text-center">ลำดับ</th>
                <th className="p-2">รายการอะไหล่และค่าบริการ</th>
                <th className="p-2 text-center w-16">จำนวน</th>
                <th className="p-2 text-right w-24">ราคา/หน่วย</th>
                <th className="p-2 text-right w-28">จำนวนเงิน (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {selectedInvoice.lines.map((l, idx) => (
                <tr key={l.id}>
                  <td className="p-2 text-center">{idx + 1}</td>
                  <td className="p-2 font-medium">{l.description}</td>
                  <td className="p-2 text-center">{l.qty}</td>
                  <td className="p-2 text-right font-mono">{l.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right font-mono font-bold">{l.lineTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end my-4">
            <div className="w-72 space-y-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">ยอดรวมค่าบริการและอะไหล่ (Subtotal):</span>
                <span className="font-mono">฿{selectedInvoice.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                <span className="font-mono">฿{selectedInvoice.vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              {selectedInvoice.insuranceCovered > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200 text-blue-700">
                  <span>หักยอดประกันภัยคุ้มครอง:</span>
                  <span className="font-mono">-฿{selectedInvoice.insuranceCovered.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-t-2 border-slate-800 font-bold text-sm">
                <span>ยอดสุทธิที่ต้องชำระ (Total Due):</span>
                <span className="font-mono">฿{selectedInvoice.customerDue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <PrintSignatures
            signers={[
              { label: 'พนักงานผู้รับเงิน / แคชเชียร์', name: '...................................................' },
              { label: 'ลูกค้าผู้รับมอบรถและบริการ', name: '...................................................' },
              { label: 'ผู้จัดการศูนย์บริการ (อนุมัติส่งมอบ)', name: '...................................................' },
            ]}
          />
        </div>
      )}

      {/* Payment Checkout Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          title={`รับชำระเงินใบแจ้งหนี้: ${selectedInvoice.invoiceNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">ลูกค้า:</span>
                <span className="font-bold text-slate-800">{selectedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ยอดที่ต้องชำระสุทธิ:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  ฿{selectedInvoice.customerDue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ประเภทผู้ชำระ (Payer Type)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayerType('CUSTOMER')}
                  className={`py-2 rounded-xl font-bold border text-xs ${
                    payerType === 'CUSTOMER' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  ลูกค้าชำระเงิน (Customer)
                </button>
                <button
                  type="button"
                  onClick={() => setPayerType('INSURER')}
                  className={`py-2 rounded-xl font-bold border text-xs ${
                    payerType === 'INSURER' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  บริษัทประกันภัย (Insurer)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">วิธีการชำระเงิน (Payment Method)</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium"
              >
                <option value="TRANSFER">โอนเงินผ่านธนาคาร (Bank Transfer / PromptPay QR)</option>
                <option value="CASH">เงินสด (Cash)</option>
                <option value="CREDIT_CARD">บัตรเครดิต / เดบิต (Credit Card)</option>
                <option value="INSURANCE_DIRECT">วางบิลประกันภัย (Insurance Direct Claim)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">จำนวนเงินที่รับชำระ (฿)</label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
              />
            </div>

            {selectedInvoice && (isInvoicePaid(selectedInvoice) || isInvoiceCancelled(selectedInvoice)) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>ใบแจ้งหนี้นี้ชำระครบแล้วหรืออยู่ในสถานะ {selectedInvoice.status} — ไม่สามารถรับชำระเงินได้</span>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={!selectedInvoice || isInvoicePaid(selectedInvoice) || isInvoiceCancelled(selectedInvoice)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยืนยันการรับเงินและปิดงานซ่อม
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
