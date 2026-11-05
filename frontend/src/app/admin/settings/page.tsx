'use client';

import React, { useEffect, useState } from 'react';
import {
  apiGetBays,
  apiUpdateBay,
  apiGetUsers,
  apiCreateUser,
  apiDeactivateUser,
} from '@/lib/api';
import { RepairBay, User, UserRole } from '@/lib/types';
import {
  Settings,
  Wrench,
  Users,
  Sliders,
  Plus,
  Shield,
  CheckCircle2,
  AlertTriangle,
  UserX,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'BAYS' | 'USERS' | 'POLICY'>('BAYS');
  const [bays, setBays] = useState<RepairBay[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // User modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    role: 'MECHANIC' as UserRole,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [bList, uList] = await Promise.all([apiGetBays(), apiGetUsers()]);
      setBays(bList);
      setUsers(uList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleBayActive = async (bay: RepairBay) => {
    try {
      await apiUpdateBay(bay.id, { isActive: !bay.isActive });
      setMsg(`ปรับปรุงสถานะช่องซ่อม ${bay.bayNumber} สำเร็จ`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiCreateUser(newUser);
      setMsg(`สร้างบัญชีผู้ใช้งาน @${newUser.username} (${newUser.role}) สำเร็จ`);
      setUserModalOpen(false);
      setNewUser({ username: '', fullName: '', role: 'MECHANIC' });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeactivate = async (u: User) => {
    if (!confirm(`ยืนยันการระงับการใช้งานบัญชี @${u.username}? (การระงับจะไม่ลบประวัติงานและบัญชีในอดีต)`))
      return;
    try {
      await apiDeactivateUser(u.id);
      setMsg(`ระงับการใช้งานบัญชี @${u.username} เรียบร้อยแล้ว (Soft Deactivated)`);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-rose-600 uppercase tracking-wider">
            <Settings className="w-4 h-4" /> แผนกบริหาร • Use Case A1 / S1
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            ตั้งค่าระบบและจัดการข้อมูลหลัก (System Settings & Master Data)
          </h1>
          <p className="text-xs text-slate-500">
            จัดการช่องบริการซ่อม (Repair Bays), สิทธิ์ผู้ใช้งาน (RBAC), และกฎเกณฑ์ระบบจัดคิว
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('BAYS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'BAYS'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ช่องบริการ (Bays)
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'USERS'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ผู้ใช้งาน (Staff & Roles)
          </button>
          <button
            onClick={() => setActiveTab('POLICY')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'POLICY'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            นโยบายระบบ (Policies)
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

      {/* Tab 1: Bays */}
      {activeTab === 'BAYS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">รายชื่อช่องบริการซ่อม (Repair Bays Configuration)</h2>
            <span className="text-xs text-slate-400 font-mono">{bays.length} ช่องบริการ</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">รหัสช่องซ่อม</th>
                  <th className="py-3 px-4">ชื่อช่องบริการ</th>
                  <th className="py-3 px-4">ประเภทงานบริการ</th>
                  <th className="py-3 px-4 text-center">สถานะการใช้งาน</th>
                  <th className="py-3 px-4 text-center">รถในช่อง</th>
                  <th className="py-3 px-4 text-center">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bays.map((bay) => (
                  <tr key={bay.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{bay.bayNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{bay.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{bay.bayType}</td>
                    <td className="py-3.5 px-4 text-center">
                      {bay.isActive ? (
                        <Badge variant="success">เปิดใช้งาน (Active)</Badge>
                      ) : (
                        <Badge variant="neutral">ปิดปรับปรุง (Inactive)</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {bay.isOccupied ? (
                        <Badge variant="danger">มีรถซ่อมอยู่</Badge>
                      ) : (
                        <Badge variant="info">ว่าง</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleBayActive(bay)}
                        className={`px-3 py-1 rounded-lg font-bold text-xs ${
                          bay.isActive
                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {bay.isActive ? 'ปิดการใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === 'USERS' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                รายชื่อบุคลากรและสิทธิ์การใช้งาน (Staff Accounts & RBAC)
              </h2>
              <p className="text-xs text-slate-400">
                การระงับการใช้งานจะไม่ลบประวัติงานในอดีต (Soft Deactivate Enforced)
              </p>
            </div>
            <button
              onClick={() => setUserModalOpen(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มผู้ใช้งานใหม่</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">ชื่อผู้ใช้ (Username)</th>
                  <th className="py-3 px-4">ชื่อ-นามสกุล / ตำแหน่ง</th>
                  <th className="py-3 px-4">บทบาท (RBAC Role)</th>
                  <th className="py-3 px-4 text-center">สถานะบัญชี</th>
                  <th className="py-3 px-4 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">@{u.username}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{u.fullName}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-bold">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.isActive ? (
                        <Badge variant="success">ปกติ (Active)</Badge>
                      ) : (
                        <Badge variant="danger">ระงับการใช้งาน</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.isActive && u.username !== 'admin' && (
                        <button
                          onClick={() => handleDeactivate(u)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-xs flex items-center gap-1 mx-auto"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>ระงับการใช้งาน</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: System Policies */}
      {activeTab === 'POLICY' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="font-bold text-slate-900 text-sm pb-3 border-b border-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-rose-600" />
            <span>นโยบายและอัลกอริทึมของระบบ (System Configuration & Policies)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">เกณฑ์การจัดคิวและ Aging Algorithm</h3>
              <p className="text-slate-600">
                ระบบใช้ลำดับความสำคัญ Priority First ร่วมกับเกณฑ์ Anti-Starvation Rule:
              </p>
              <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                <p>• คิวด่วนพิเศษ (PRIORITY): ได้รับลำดับ Tier 0 ทันที</p>
                <p>• คิวปกติ (NORMAL): รอคอยเกิน 120 นาที เลื่อนขึ้นเป็น Tier 0</p>
                <p>• Concurrency Control: SKIP LOCKED ป้องกันแย่งคิว</p>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">การเงินและภาษี (Financial Rules)</h3>
              <p className="text-slate-600">
                กฎเกณฑ์การออกใบกำกับภาษีและใบเสร็จรับเงินแบบ Immutable:
              </p>
              <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 space-y-1">
                <p>• อัตราภาษีมูลค่าเพิ่ม: 7.00% (VAT 7%)</p>
                <p>• การคิดราคาอะไหล่: Net Issued Parts (หักชิ้นส่วนคืน)</p>
                <p>• การแก้ไขใบเสร็จ: Void & Re-issue เท่านั้น (ห้ามแก้ในที่เดิม)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Create Modal */}
      <Modal
        isOpen={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title="เพิ่มบัญชีผู้ใช้งานใหม่ (Create Staff User)"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ใช้งาน (Username)</label>
            <input
              type="text"
              required
              placeholder="เช่น mechanic3"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล และตำแหน่ง</label>
            <input
              type="text"
              required
              placeholder="เช่น ชูเกียรติ ช่างไฟฟ้าและเครื่องเสียง"
              value={newUser.fullName}
              onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">บทบาทหน้าที่ (RBAC Role)</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
            >
              <option value="FRONT_DESK">FRONT_DESK (พนักงานต้อนรับ/แคชเชียร์)</option>
              <option value="MECHANIC">MECHANIC (ช่างเทคนิค/ตรวจเช็ค)</option>
              <option value="WAREHOUSE">WAREHOUSE (เจ้าหน้าที่คลังอะไหล่)</option>
              <option value="SALES">SALES (พนักงานขายหน้าร้าน)</option>
              <option value="MANAGER">MANAGER (ผู้จัดการศูนย์บริการ)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20"
            >
              บันทึกสร้างบัญชี
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
