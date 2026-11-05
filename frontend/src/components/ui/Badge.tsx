import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'neutral';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-300/30',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 ring-1 ring-amber-300/30',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-300/30',
    info: 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-300/30',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 ring-1 ring-purple-300/30',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 ring-1 ring-slate-300/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'QUEUED':
      return <Badge variant="warning">รอเรียกคิว (QUEUED)</Badge>;
    case 'IN_DIAGNOSIS':
      return <Badge variant="info">กำลังตรวจเช็ค (IN_DIAGNOSIS)</Badge>;
    case 'AWAITING_APPROVAL':
      return <Badge variant="purple">รออนุมัติราคา (AWAITING_APPROVAL)</Badge>;
    case 'ON_HOLD':
      return <Badge variant="warning">พักงานรออะไหล่ (ON_HOLD)</Badge>;
    case 'IN_REPAIR':
      return <Badge variant="info">กำลังดำเนินการซ่อม (IN_REPAIR)</Badge>;
    case 'QC':
      return <Badge variant="purple">ตรวจเช็คคุณภาพ QC (QC)</Badge>;
    case 'AWAITING_PAYMENT':
      return <Badge variant="warning">รอชำระเงิน (AWAITING_PAYMENT)</Badge>;
    case 'COMPLETED':
      return <Badge variant="success">ซ่อมเสร็จสิ้น (COMPLETED)</Badge>;
    case 'CANCELLED':
      return <Badge variant="danger">ยกเลิก (CANCELLED)</Badge>;
    case 'PRIORITY':
      return <Badge variant="danger">ด่วนพิเศษ (PRIORITY)</Badge>;
    case 'NORMAL':
      return <Badge variant="neutral">คิวปกติ (NORMAL)</Badge>;
    case 'ISSUED':
      return <Badge variant="info">ออกใบเสร็จแล้ว (ISSUED)</Badge>;
    case 'ORDERED':
      return <Badge variant="warning">สั่งซื้อแล้ว (ORDERED)</Badge>;
    case 'RECEIVED':
      return <Badge variant="success">รับของเข้าสต็อกแล้ว (RECEIVED)</Badge>;
    case 'LOW_STOCK':
      return <Badge variant="warning">สต็อกต่ำกว่าเกณฑ์ (LOW STOCK)</Badge>;
    case 'OUT_OF_STOCK':
      return <Badge variant="danger">สินค้าหมด (OUT OF STOCK)</Badge>;
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}
