'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiCheckIn } from '@/lib/api';
import { ClipboardList, Car, User, AlertCircle, CheckCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export default function CheckInPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    licensePlate: '',
    brand: 'Toyota',
    model: 'Corolla Altis',
    mileage: 65000,
    symptoms: '',
    queueClass: 'NORMAL' as 'NORMAL' | 'PRIORITY',
    priorityReason: '',
    isInsured: false,
    insurerName: 'วิริยะประกันภัย',
    insuranceClaimNo: '',
  });

  const [loading, setLoading] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.queueClass === 'PRIORITY' && !formData.priorityReason.trim()) {
      setError('กรุณาระบุเหตุผลความจำเป็นสำหรับคิวด่วนพิเศษ (Priority Reason)');
      return;
    }

    setLoading(true);
    try {
      const res = await apiCheckIn({
        customerName: formData.customerName,
        phone: formData.phone,
        licensePlate: formData.licensePlate,
        brand: formData.brand,
        model: formData.model,
        mileage: Number(formData.mileage) || 0,
        symptoms: formData.symptoms,
        queueClass: formData.queueClass,
        priorityReason: formData.priorityReason,
        insurerName: formData.isInsured ? formData.insurerName : undefined,
        insuranceClaimNo: formData.isInsured ? formData.insuranceClaimNo : undefined,
      });
      setCreatedOrder(res);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
            <ClipboardList className="w-4 h-4" /> แผนกต้อนรับ • Use Case R1
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ลงทะเบียนรับรถและเปิดคิวบริการ (Customer & Vehicle Check-In)
          </h1>
          <p className="text-xs text-slate-500">
            บันทึกข้อมูลลูกค้า ข้อมูลรถยนต์ อาการเสียเบื้องต้น และออกบัตรคิวซ่อม
          </p>
        </div>
      </div>

      {createdOrder ? (
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 shadow-sm text-center max-w-xl mx-auto space-y-5 animate-in fade-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">ลงทะเบียนและเปิดคิวสำเร็จ!</h2>
            <p className="text-xs text-slate-500 mt-1">
              ระบบได้บันทึกข้อมูลรถเข้าสู่แถวคอยและสร้างใบสั่งซ่อมเรียบร้อยแล้ว
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 text-left space-y-2 text-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">หมายเลขคิว (Ticket No.):</span>
              <span className="font-mono font-black text-blue-600 text-lg">
                {createdOrder.ticketNumber}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">เลขที่ใบสั่งซ่อม (RO No.):</span>
              <span className="font-mono font-bold text-slate-800">{createdOrder.roNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ประเภทคิว:</span>
              <Badge variant={createdOrder.queueClass === 'PRIORITY' ? 'danger' : 'neutral'}>
                {createdOrder.queueClass === 'PRIORITY' ? 'ด่วนพิเศษ (PRIORITY)' : 'คิวปกติ (NORMAL)'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ทะเบียนรถ:</span>
              <span className="font-bold text-slate-800">{createdOrder.licensePlate}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">ชื่อลูกค้า:</span>
              <span className="font-medium text-slate-800">{createdOrder.customerName}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => {
                setCreatedOrder(null);
                setFormData({
                  customerName: '',
                  phone: '',
                  licensePlate: '',
                  brand: 'Toyota',
                  model: 'Corolla Altis',
                  mileage: 65000,
                  symptoms: '',
                  queueClass: 'NORMAL',
                  priorityReason: '',
                  isInsured: false,
                  insurerName: 'วิริยะประกันภัย',
                  insuranceClaimNo: '',
                });
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 text-xs"
            >
              รับรถคันต่อไป
            </button>
            <button
              onClick={() => router.push('/front-desk/queue')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <span>ไปที่กระดานคิว</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Customer Information Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
                <User className="w-4 h-4 text-blue-600" />
                <span>1. ข้อมูลเจ้าของรถ / ผู้ติดต่อ (Customer Information)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อ-นามสกุลลูกค้า <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น คุณกมล สุขสมบูรณ์"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เบอร์โทรศัพท์ติดต่อ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="เช่น 089-123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Information Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
                <Car className="w-4 h-4 text-blue-600" />
                <span>2. ข้อมูลยานพาหนะและอาการชำรุด (Vehicle & Symptoms)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เลขทะเบียนรถ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น 1กข-8888 กทม."
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ยี่ห้อ (Brand)</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Toyota">Toyota (โตโยต้า)</option>
                    <option value="Honda">Honda (ฮอนด้า)</option>
                    <option value="Mazda">Mazda (มาสด้า)</option>
                    <option value="Isuzu">Isuzu (อีซูซุ)</option>
                    <option value="Nissan">Nissan (นิสสัน)</option>
                    <option value="Ford">Ford (ฟอร์ด)</option>
                    <option value="MG">MG (เอ็มจี)</option>
                    <option value="BYD">BYD (บีวายดี)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รุ่นรถยนต์ (Model)</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น Corolla Altis 1.8G"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">เลขไมล์ปัจจุบัน (กิโลเมตร)</label>
                <input
                  type="number"
                  value={formData.mileage}
                  onChange={(e) => setFormData({ ...formData, mileage: Number(e.target.value) })}
                  className="w-full sm:w-1/3 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  อาการชำรุดเบื้องต้น / งานบริการที่ต้องการ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="เช่น สตาร์ทติดยากช่วงเช้า เบรกมีเสียงดังจี๊ดๆ แอร์ไม่เย็นเวลารถติด..."
                  value={formData.symptoms}
                  onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Column 3: Priority & Insurance Config */}
          <div className="space-y-6">
            {/* Priority Queue Class Selection */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-blue-600" />
                <span>3. ระดับความเร่งด่วนของคิว</span>
              </div>

              <div className="space-y-2">
                <label
                  onClick={() => setFormData({ ...formData, queueClass: 'NORMAL' })}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.queueClass === 'NORMAL'
                      ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="queueClass"
                    checked={formData.queueClass === 'NORMAL'}
                    onChange={() => setFormData({ ...formData, queueClass: 'NORMAL' })}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">คิวปกติ (NORMAL)</span>
                    <span className="text-[11px] text-slate-500 block">
                      จัดคิวตามลำดับก่อน-หลัง (FIFO) มีระบบกันคิวตกหล่น 120 นาที
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setFormData({ ...formData, queueClass: 'PRIORITY' })}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.queueClass === 'PRIORITY'
                      ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="queueClass"
                    checked={formData.queueClass === 'PRIORITY'}
                    onChange={() => setFormData({ ...formData, queueClass: 'PRIORITY' })}
                    className="mt-0.5 text-rose-600"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-700 block">ด่วนพิเศษ (PRIORITY)</span>
                    <span className="text-[11px] text-slate-500 block">
                      รถฉุกเฉิน, ไฟเครื่องโชว์, หรือกรณีเคลมด่วน (เรียกคิวก่อน)
                    </span>
                  </div>
                </label>
              </div>

              {formData.queueClass === 'PRIORITY' && (
                <div className="pt-2 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-700 mb-1">
                    เหตุผลความจำเป็นเร่งด่วน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น รถจอดเสียกลางทาง / ผู้ป่วยฉุกเฉิน"
                    value={formData.priorityReason}
                    onChange={(e) => setFormData({ ...formData, priorityReason: e.target.value })}
                    className="w-full px-3.5 py-2 bg-rose-50/30 border border-rose-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-rose-500 text-rose-900"
                  />
                </div>
              )}
            </div>

            {/* Insurance Claim Checkbox */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-800 font-bold text-sm">4. งานเคลมประกันภัย</span>
                <input
                  type="checkbox"
                  checked={formData.isInsured}
                  onChange={(e) => setFormData({ ...formData, isInsured: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>

              {formData.isInsured && (
                <div className="space-y-3 pt-1 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">บริษัทประกันภัย</label>
                    <input
                      type="text"
                      value={formData.insurerName}
                      onChange={(e) => setFormData({ ...formData, insurerName: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">เลขที่ใบเคลม (Claim No.)</label>
                    <input
                      type="text"
                      placeholder="CLM-2026-XXXX"
                      value={formData.insuranceClaimNo}
                      onChange={(e) => setFormData({ ...formData, insuranceClaimNo: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-amber-600">
                    * ต้องตรวจสอบเอกสารและอนุมัติใบเคลมก่อนจึงจะสามารถเริ่มงานซ่อมได้ (Insurance Gatekeeper)
                  </p>
                </div>
              )}
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span>กำลังเปิดคิวบริการ...</span>
              ) : (
                <>
                  <ClipboardList className="w-5 h-5" />
                  <span>บันทึกรับรถและเปิดคิวบริการ (Check-in)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
