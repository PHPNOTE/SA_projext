'use client';

import React, { useEffect, useState } from 'react';
import { apiGetParts, apiCompleteCounterSale } from '@/lib/api';
import { Part, Invoice } from '@/lib/types';
import {
  sanitizePersonName,
  sanitizePhone,
  validatePersonName,
  validatePhone,
} from '@/lib/validation';
import {
  ShoppingCart,
  Plus,
  Minus,
  DollarSign,
  Search,
  CheckCircle2,
  Printer,
  AlertCircle,
} from 'lucide-react';
import { PrintHeader, PrintSignatures } from '@/components/ui/PrintHeader';

export default function SalesCounterPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{ part: Part; qty: number }[]>([]);
  const [customerName, setCustomerName] = useState('ลูกค้าทั่วไป (Walk-in)');
  const [customerPhone, setCustomerPhone] = useState('081-000-0000');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    apiGetParts().then(setParts);
  }, []);

  const addToCart = (part: Part) => {
    setErrorMsg(null);
    const available = Math.max(0, part.onHand - part.reserved);
    if (available <= 0) {
      setErrorMsg('ขออภัย สินค้านี้หมดสต็อกชั่วคราว');
      return;
    }

    const existing = cart.find((item) => item.part.id === part.id);
    if (existing) {
      if (existing.qty >= available) {
        setErrorMsg(`สินค้าคงเหลือพร้อมขายมีเพียง ${available} หน่วย`);
        return;
      }
      setCart(cart.map((it) => (it.part.id === part.id ? { ...it, qty: it.qty + 1 } : it)));
    } else {
      setCart([...cart, { part, qty: 1 }]);
    }
  };

  const updateQty = (partId: number, delta: number) => {
    setErrorMsg(null);
    const existing = cart.find((it) => it.part.id === partId);
    if (!existing) return;

    const available = Math.max(0, existing.part.onHand - existing.part.reserved);
    const newQty = existing.qty + delta;

    if (newQty <= 0) {
      setCart(cart.filter((it) => it.part.id !== partId));
    } else if (newQty > available) {
      setErrorMsg(`สินค้าคงเหลือพร้อมขายมีเพียง ${available} หน่วย`);
    } else {
      setCart(cart.map((it) => (it.part.id === partId ? { ...it, qty: newQty } : it)));
    }
  };

  const subtotal = cart.reduce((acc, it) => acc + it.qty * it.part.unitPrice, 0);
  const vatAmount = +(subtotal * 0.07).toFixed(2);
  const grandTotal = +(subtotal + vatAmount).toFixed(2);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setErrorMsg(null);

    const nameErr = validatePersonName(customerName, 'ชื่อลูกค้า');
    if (nameErr) {
      setErrorMsg(nameErr);
      return;
    }

    const phoneErr = validatePhone(customerPhone, {
      allowWalkInDash: true,
      label: 'เบอร์โทรติดต่อ',
    });
    if (phoneErr) {
      setErrorMsg(phoneErr);
      return;
    }

    setLoading(true);
    try {
      const res = await apiCompleteCounterSale(
        customerName.trim(),
        customerPhone.trim() || '-',
        cart.map((it) => ({
          partId: it.part.id,
          qty: it.qty,
          unitPrice: it.part.unitPrice,
        })),
        paymentMethod
      );
      setCompletedInvoice(res.invoice);
      setCart([]);
      apiGetParts().then(setParts);
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการขายหน้าร้าน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider">
            <ShoppingCart className="w-4 h-4" /> แผนกขายหน้าร้าน • Use Case UC09 / UC10 / UC11
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ขายอะไหล่หน้าร้าน (Point of Sale Counter)
          </h1>
          <p className="text-xs text-slate-500">
            ระบบจำหน่ายอะไหล่ด่วนสำหรับลูกค้า Walk-in ตัดสต็อกอัตโนมัติ คำนวณ VAT 7% และออกใบเสร็จรับเงินทันที
          </p>
        </div>
      </div>

      {/* Sale Success Notification */}
      {completedInvoice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 text-sm">การขายเสร็จสมบูรณ์ & ตัดสต็อกเรียบร้อย!</h3>
              <p className="text-xs text-emerald-700">
                เลขที่ใบเสร็จ: <b className="font-mono">{completedInvoice.invoiceNumber}</b> • ยอดชำระ: ฿{completedInvoice.customerDue.toLocaleString()} ({completedInvoice.payments[0]?.method})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบเสร็จรับเงิน</span>
            </button>
            <button
              onClick={() => setCompletedInvoice(null)}
              className="px-4 py-2 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100"
            >
              ทำรายการใหม่
            </button>
          </div>
        </div>
      )}

      {/* POS Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        {/* Left Column: Catalog Picker */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหารหัส SKU, ชื่ออะไหล่, หรือหมวดหมู่..."
                value={search}
                maxLength={80}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:block">
              {parts.length} รายการในคลัง
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {parts
              .filter(
                (p) =>
                  p.partCode.toLowerCase().includes(search.toLowerCase()) ||
                  p.name.toLowerCase().includes(search.toLowerCase()) ||
                  p.category.toLowerCase().includes(search.toLowerCase())
              )
              .map((part) => {
                const available = Math.max(0, part.onHand - part.reserved);

                return (
                  <div
                    key={part.id}
                    onClick={() => addToCart(part)}
                    className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                      available > 0
                        ? 'border-slate-200 hover:border-purple-400'
                        : 'border-slate-100 opacity-60 pointer-events-none'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-xs font-bold text-slate-700">{part.partCode}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            available > 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          พร้อมขาย: {available}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-xs mt-1.5 line-clamp-2">{part.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1">ตำแหน่ง: {part.shelfLocation}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-mono font-black text-purple-700 text-sm">
                        ฿{part.unitPrice.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:underline">
                        <Plus className="w-3.5 h-3.5" /> เพิ่มลงตะกร้า
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Column: Cart & Checkout */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-purple-600" />
                <span>ตะกร้าสินค้า (Sales Cart)</span>
              </h2>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                {cart.length} รายการ
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Customer Inputs */}
            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-0.5">
                  ชื่อลูกค้า <span className="text-slate-400 font-normal">(ห้ามใส่ตัวเลข)</span>
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="เช่น ลูกค้าทั่วไป (Walk-in)"
                  value={customerName}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setCustomerName(sanitizePersonName(e.target.value));
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-0.5">
                  เบอร์โทรติดต่อ <span className="text-slate-400 font-normal">(เฉพาะตัวเลข หรือ - )</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="เช่น 081-234-5678 หรือ -"
                  value={customerPhone}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setCustomerPhone(sanitizePhone(e.target.value));
                  }}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1 text-xs">
              {cart.length === 0 ? (
                <p className="text-center py-8 text-slate-400">ยังไม่มีสินค้าในตะกร้า</p>
              ) : (
                cart.map((it) => (
                  <div key={it.part.id} className="pt-2 flex items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 line-clamp-1">{it.part.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        ฿{it.part.unitPrice.toLocaleString()} x {it.qty}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQty(it.part.id, -1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-mono font-bold">{it.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(it.part.id, 1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="w-16 text-right font-mono font-bold text-slate-900">
                      ฿{(it.qty * it.part.unitPrice).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>ยอดรวมสินค้า (Subtotal):</span>
                <span className="font-mono">฿{subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                <span className="font-mono">฿{vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900 text-sm">
                <span>ยอดสุทธิ (Total Due):</span>
                <span className="font-mono text-purple-700 text-base">฿{grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-1 text-xs">
              <label className="block text-slate-700 font-semibold mb-1">ช่องทางชำระเงิน</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'TRANSFER', label: 'QR PromptPay' },
                  { id: 'CASH', label: 'เงินสด' },
                  { id: 'CREDIT_CARD', label: 'บัตรเครดิต' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-2 rounded-lg font-bold border text-[11px] ${
                      paymentMethod === m.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-40 text-xs"
            >
              {loading ? (
                <span>กำลังทำรายการขาย...</span>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  <span>ชำระเงินและออกใบเสร็จ (Complete Sale)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* PRINTABLE RECEIPT TEMPLATE (Shows on print) */}
      {completedInvoice && (
        <div className="hidden print:block bg-white p-8 max-w-4xl mx-auto text-black">
          <PrintHeader
            title="ใบเสร็จรับเงินการขายอะไหล่หน้าร้าน (Counter Sale Receipt)"
            documentNo={completedInvoice.invoiceNumber}
            dateStr={new Date().toLocaleDateString('th-TH', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />

          <div className="grid grid-cols-2 gap-4 my-4 p-4 border border-slate-300 rounded text-xs">
            <div>
              <p className="font-bold text-slate-800">ลูกค้า:</p>
              <p className="font-semibold">{completedInvoice.customerName}</p>
              <p className="text-slate-600">โทร: {completedInvoice.customerPhone}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800">ประเภทรายการ:</p>
              <p>ขายอะไหล่หน้าร้าน (Counter Walk-in POS)</p>
              <p className="text-slate-600">การชำระ: {completedInvoice.payments[0]?.method}</p>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs my-4 border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-2 w-12 text-center">ลำดับ</th>
                <th className="p-2">รายการอะไหล่</th>
                <th className="p-2 text-center w-16">จำนวน</th>
                <th className="p-2 text-right w-24">ราคา/หน่วย</th>
                <th className="p-2 text-right w-28">รวมเงิน (฿)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {completedInvoice.lines.map((l, idx) => (
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
            <div className="w-72 space-y-1 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>ยอดก่อนภาษี:</span>
                <span className="font-mono">฿{completedInvoice.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                <span className="font-mono">฿{completedInvoice.vatAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t-2 border-slate-800 font-bold text-sm">
                <span>ยอดชำระสุทธิ:</span>
                <span className="font-mono">฿{completedInvoice.customerDue.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <PrintSignatures
            signers={[
              { label: 'พนักงานขายหน้าร้าน', name: '...................................................' },
              { label: 'ลูกค้าผู้ซื้อสินค้า', name: '...................................................' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
