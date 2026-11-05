import React from 'react';
import { Wrench } from 'lucide-react';

interface PrintHeaderProps {
  title: string;
  subtitle?: string;
  documentNo?: string;
  dateStr?: string;
}

export function PrintHeader({ title, subtitle, documentNo, dateStr }: PrintHeaderProps) {
  const today = dateStr || new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="border-b-2 border-slate-800 pb-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xl print:border print:border-black">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              ศูนย์บริการและอู่ซ่อมรถมาตรฐาน AUTO GARAGE OS
            </h1>
            <p className="text-xs text-slate-600">
              เลขประจำตัวผู้เสียภาษี 0-1055-67890-12-3 | โทร: 02-987-6543 | สำนักงานใหญ่: 50 ถ.งามวงศ์วาน แขวงลาดยาว เขตจตุจักร กทม. 10900
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-bold text-slate-800 print:border-black">
            เอกสารทางการ (Official)
          </span>
          {documentNo && <p className="text-xs font-mono font-bold text-slate-700 mt-1">เลขที่: {documentNo}</p>}
          <p className="text-xs text-slate-500 mt-0.5">วันที่: {today}</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-baseline">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="text-right text-xs text-slate-400 print:text-slate-600">
          Car Repair Queue & Management System v2.0
        </div>
      </div>
    </div>
  );
}

export function PrintSignatures({
  signers = [
    { label: 'ผู้จัดทำเอกสาร / เจ้าหน้าที่', name: '...................................................' },
    { label: 'ผู้ตรวจสอบ / หัวหน้างาน', name: '...................................................' },
    { label: 'ผู้จัดการศูนย์บริการ (อนุมัติ)', name: '...................................................' },
  ],
}: {
  signers?: { label: string; name: string }[];
}) {
  return (
    <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs text-slate-700 print:visible">
      {signers.map((s, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <div className="h-10"></div>
          <p className="font-mono text-slate-400 text-xs mb-1">({s.name})</p>
          <p className="font-semibold text-slate-800">{s.label}</p>
          <p className="text-[10px] text-slate-400 mt-1">วันที่ ..... / ..... / .........</p>
        </div>
      ))}
    </div>
  );
}
