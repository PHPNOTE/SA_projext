/**
 * Realistic seed data and test fixtures across all 18 relational tables.
 * Used for both live integration test payloads and in-memory contract state initialization.
 */

export const INITIAL_USERS = [
  { id: 1, username: 'admin', passwordHash: 'bcrypt_hash_admin', displayName: 'สมชาย ผู้จัดการ', role: 'MANAGER', isActive: true },
  { id: 2, username: 'frontdesk', passwordHash: 'bcrypt_hash_fd', displayName: 'สมหญิง ต้อนรับ', role: 'FRONT_DESK', isActive: true },
  { id: 3, username: 'somchai', passwordHash: 'bcrypt_hash_mech1', displayName: 'สมชัย ช่างทอง', role: 'MECHANIC', isActive: true },
  { id: 4, username: 'prasert', passwordHash: 'bcrypt_hash_mech2', displayName: 'ประเสริฐ ยอดช่าง', role: 'MECHANIC', isActive: true },
  { id: 5, username: 'wichai', passwordHash: 'bcrypt_hash_wh', displayName: 'วิชัย คลังอะไหล่', role: 'WAREHOUSE', isActive: true },
  { id: 6, username: 'somsri', passwordHash: 'bcrypt_hash_sales', displayName: 'สมศรี ขายหน้าร้าน', role: 'SALES', isActive: true }
];

export const INITIAL_BAYS = [
  { id: 1, name: 'Bay 1 (Fast Service)', isActive: true },
  { id: 2, name: 'Bay 2 (Heavy Repair)', isActive: true },
  { id: 3, name: 'Bay 3 (Engine & Transmission)', isActive: true },
  { id: 4, name: 'Bay 4 (Brake & Suspension)', isActive: true }
];

export const INITIAL_PARTS = [
  { id: 1, sku: 'OIL-5W30-4L', name: 'น้ำมันเครื่องสังเคราะห์แท้ 5W-30 (4L)', sellPrice: 850.00, onHand: 20, reserved: 0, reorderLevel: 5, isActive: true },
  { id: 2, sku: 'FLT-OIL-TY01', name: 'ไส้กรองน้ำมันเครื่อง Toyota/Honda', sellPrice: 220.00, onHand: 15, reserved: 0, reorderLevel: 4, isActive: true },
  { id: 3, sku: 'BRK-PAD-FR01', name: 'ผ้าเบรกหน้า Ceramic Premium', sellPrice: 1450.00, onHand: 8, reserved: 0, reorderLevel: 2, isActive: true },
  { id: 4, sku: 'SPK-PLG-IR01', name: 'หัวเทียน Iridium Power (ชุด 4 หัว)', sellPrice: 980.00, onHand: 6, reserved: 0, reorderLevel: 2, isActive: true },
  { id: 5, sku: 'CLN-RAD-4L', name: 'น้ำยาหล่อเย็นหม้อน้ำ Super Coolant 4L', sellPrice: 420.00, onHand: 12, reserved: 0, reorderLevel: 3, isActive: true },
  { id: 6, sku: 'BLT-TMG-TOY', name: 'สายพานไทม์มิ่งแท้ Hilux Revo', sellPrice: 1850.00, onHand: 4, reserved: 0, reorderLevel: 2, isActive: true },
  { id: 7, sku: 'ALT-12V-REVO', name: 'ไดชาร์จ Alternator 12V 100A', sellPrice: 4500.00, onHand: 0, reserved: 0, reorderLevel: 1, isActive: true }, // Out of stock on purpose
  { id: 8, sku: 'FLT-AIR-TY01', name: 'ไส้กรองอากาศ Toyota Fortuner/Revo', sellPrice: 380.00, onHand: 10, reserved: 0, reorderLevel: 3, isActive: true }
];

export const INITIAL_CUSTOMERS = [
  { id: 1, name: 'คุณสมเกียรติ พงษ์ไพศาล', phone: '0812345678', note: 'ลูกค้าประจำ VIP' },
  { id: 2, name: 'คุณอนันต์ ชัยเจริญ', phone: '0898765432', note: 'รถบริษัท เคลมประกันวิริยะ' },
  { id: 3, name: 'คุณกัญญา วงศ์สวัสดิ์', phone: '0865554321', note: 'นัดเช็คระยะ 50,000 กม.' },
  { id: 4, name: 'คุณณรงค์ ยิ่งยง', phone: '0823334444', note: 'รถกระบะขนส่ง' },
  { id: 5, name: 'คุณศิริพร บุญมี', phone: '0841112222', note: 'ลูกค้า Walk-in ซื้ออะไหล่' }
];

export const INITIAL_VEHICLES = [
  { id: 1, customerId: 1, plate: '1กข-1234 กทม', make: 'Toyota', model: 'Hilux Revo 2.8', year: 2021 },
  { id: 2, customerId: 2, plate: '2ขค-5678 กทม', make: 'Honda', model: 'Civic FE 1.5 Turbo', year: 2022 },
  { id: 3, customerId: 3, plate: '3งจ-9012 นนทบุรี', make: 'Isuzu', model: 'D-Max 1.9 BluePower', year: 2020 },
  { id: 4, customerId: 4, plate: '4ฉช-3456 ชลบุรี', make: 'Mazda', model: 'Mazda 3 SkyActiv', year: 2019 }
];

let counter = 1000;
export function uniqueId(prefix = 'T') {
  return `${prefix}-${Date.now()}-${++counter}`;
}

export function sampleCheckinPayload(overrides = {}) {
  const base = {
    customerName: `ลูกค้าทดสอบ ${uniqueId('C')}`,
    customerPhone: '0891234567',
    customerNote: 'ทดสอบระบบ',
    licensePlate: `${Math.floor(1 + Math.random() * 9)}กข-${Math.floor(1000 + Math.random() * 8999)} กทม`,
    make: 'Toyota',
    model: 'Yaris Cross',
    year: 2023,
    complaint: 'ตรวจเช็คระยะ เบรกมีเสียงดัง',
    queueClass: 'NORMAL',
    priorityReason: null,
    insurerName: null,
    claimNo: null,
    insuranceDocsReceived: false,
    insuranceCoveredAmount: 0.00
  };
  return { ...base, ...overrides };
}
