# ระบบจัดการคิวและออเดอร์อู่ซ่อมรถ (Car Repair Queue & Order Management System)

ระบบสารสนเทศสำหรับการบริหารจัดการคิวและงานซ่อมรถยนต์ อะไหล่ และการเงิน สำหรับอู่ซ่อมรถยนต์ พัฒนาตรงตามแบบสถาปัตยกรรมระบบในไฟล์ `Car_Repair_Parts_Management_System_Revised-v2 (5).drawio` ครบถ้วน 18 ตาราง และตอบสนองเกณฑ์การให้คะแนนวิชา System Analysis (SA) ตาม `รายละเอียดของคะแนนโครงงาน.xlsx` และ `detailWithExel.txt`

---

## 🛠️ สถาปัตยกรรมของระบบ (System Architecture)

- **Backend**: **Java 21 LTS + Spring Boot 3.4**
  - **Database Connectivity**: **Pure Direct JDBC (`NamedParameterJdbcTemplate`) 100%** ไม่ใช้ ORM/JPA (Hibernate) ตรงตามข้อกำหนดของอาจารย์
  - **Relational Database Engine**: **H2 Database (MySQL Compatibility Mode)** แบบ Persistent File Storage (`./data/garagedb`)
  - **Interactive Database Console**: มี H2 Web Console ที่ `http://localhost:8080/h2-console` สามารถเปิดแสดงการ Query ข้อมูลจริงจากตารางให้นิสิตและอาจารย์ดูได้ทันที
  - **Data Invariants & Concurrency**: บังคับใช้ Foreign Keys, Generated Columns (`uk_ro_single_active_bay` ป้องกันการจองช่องซ่อมซ้ำ), Row-locking และ Stock Movement Ledger
- **Frontend**: **Next.js 14+ (App Router) + TypeScript + Tailwind CSS**
  - มีหน้าจอครบทั้ง **15 หน้าจอหลัก (รวม 18 Routes)** ตาม UI Site Map ครอบคลุม 5 แผนกงาน (Front Desk, Mechanic, Warehouse, Sales Counter, Admin)
  - มี **Quick-Login Role Switcher** สลับบทบาทผู้ใช้ได้ใน 1 คลิก สำหรับการสาธิตอย่างรวดเร็ว
  - **2 รายงานเชิงปฏิบัติการ**: มีหน้าตาการจัดพิมพ์ทางการ (`@media print` พร้อมหัวกระดาษและช่องลงนาม 3 ตำแหน่ง) และส่งออกไฟล์ CSV (UTF-8 BOM สำหรับเปิดบน Excel ได้อย่างถูกต้อง)
- **Automated Verification**:
  - JUnit 5 Integration Tests: **97 การทดสอบ ผ่าน 100% (0 failures, 0 errors)**
  - Opaque-Box E2E Tests: **117 การทดสอบ 24 Suites ผ่าน 100%**

---

## 🚀 วิธีการรันระบบ (Quick Start)

### วิธีที่ 1: คลิกเดียวเปิดทั้งระบบ (แนะนำสำหรับการนำเสนอ)
ดับเบิลคลิกไฟล์:
```
start_system.bat
```
*(หรือเปิด PowerShell แล้วรัน `.\start_system.ps1`)*

สคริปต์จะ:
1. เปิดหน้าต่างรัน Spring Boot Backend ที่พอร์ต `8080` (ใช้เวลา ~2-3 วินาที)
2. เปิดหน้าต่างรัน Next.js Frontend ที่พอร์ต `3000`
3. เปิดเว็บเบราว์เซอร์ไปที่ `http://localhost:3000` ให้โดยอัตโนมัติ

### วิธีที่ 2: รันแยกทีละส่วน (Manual Command)

#### 1. รัน Backend:
```bash
cd backend
java -jar target/backend-1.0.0-SNAPSHOT.jar
# หรือ
mvn spring-boot:run
```
- API Endpoint: `http://localhost:8080/api`
- H2 Database Console: `http://localhost:8080/h2-console`
  - **JDBC URL**: `jdbc:h2:file:./data/garagedb`
  - **Username**: `sa`
  - **Password**: *(เว้นว่างไว้)*

#### 2. รัน Frontend:
```bash
cd frontend
npm run dev
```
- Web Application: `http://localhost:3000`

### การปิดระบบ:
ดับเบิลคลิกไฟล์:
```
stop_system.bat
```

---

## 👥 บัญชีผู้ใช้สำหรับสาธิต (Demo Accounts)

รหัสผ่านของทุกบัญชีคือ: `password123`  
*(ในหน้าจอ Login สามารถคลิกปุ่ม Quick Role Switcher เพื่อสลับบทบาทได้ทันทีโดยไม่ต้องพิมพ์)*

| บทบาท (Role) | Username | เมนูและหน้าที่รับผิดชอบ |
|---|---|---|
| **Front Desk** (พนักงานต้อนรับ) | `frontdesk` | รับรถ/เปิดคิว [R1], เรียกคิว [R2], ติดตามสถานะงานซ่อม [R3-R4], ปิดงานและออกใบแจ้งหนี้/ใบเสร็จ [R6] |
| **Mechanic** (ช่างซ่อม/หัวหน้าช่าง) | `mechanic1` | บันทึกผลการตรวจเช็ค [R2], จองช่องซ่อม [R4], เบิกอะไหล่ [W2], บันทึกผล QC และปล่อยช่องซ่อม [R5] |
| **Warehouse** (เจ้าหน้าที่คลังอะไหล่) | `warehouse1` | แคตตาล็อกอะไหล่ [W1], อนุมัติจ่าย/รับคืนอะไหล่ [W2/W3], สั่งซื้อ PO [W4/W5], ตรวจนับสต็อก [W6], ดูสมุดบัญชีสต็อก [W7] |
| **Sales Counter** (เจ้าหน้าที่ขายหน้าร้าน) | `sales1` | ขายอะไหล่หน้าร้าน [S1], บันทึกบิลขายเงินสด/โอนเงิน [S2] |
| **Manager / Admin** (ผู้ดูแลระบบ) | `admin` | แดชบอร์ดผู้บริหาร (KPIs & Revenue), ตั้งค่าระบบและจัดการผู้ใช้ [A1/A2] |

---

## 📊 รายงานในระบบ (Operational & Executive Reports)

1. **รายงานสรุปการดำเนินงานซ่อมและรายรับ (Repair Operations & Financial Settlement Report)**:
   - URL: `http://localhost:3000/reports/repairs`
   - กรองตามช่วงวันที่, ช่างผู้รับผิดชอบ, สถานะงาน
   - แสดงตัวเลขสรุป: จำนวนงานทั้งหมด, รายรับค่าแรง, รายรับค่าอะไหล่, ยอดรวมทั้งสิ้น
   - ตารางแจกแจงรายละเอียด 10 คอลัมน์
   - ปุ่ม **Print Official Report** (แสดงหัวจดหมายทางการ เลขประจำตัวผู้เสียภาษี และช่องลงนาม 3 ตำแหน่ง)
   - ปุ่ม **Export CSV** (รองรับภาษาไทยใน Microsoft Excel)
2. **รายงานการเคลื่อนไหวสต็อกอะไหล่และการแจ้งเตือน (Inventory Movement & Reorder Alert Report)**:
   - URL: `http://localhost:3000/reports/inventory`
   - แสดงมูลค่าคลังสินค้าคงเหลือรวม, รายการที่ต้องสั่งซื้อด่วน (Low Stock Alert), รายการอะไหล่ที่หมด
   - แสดงอันดับอะไหล่ที่มีการเบิกใช้สูงสุด (Top Consumed Parts)
   - ตาราง 11 คอลัมน์ แสดงยอด On-Hand, Reserved, Available, Reorder Point, ต้นทุน และคำนวณจำนวนที่ควรสั่งซื้อเพิ่มอัตโนมัติ

---

## 🗄️ โครงสร้างฐานข้อมูล 18 ตาราง (18 Relational Tables)

ระบบออกแบบตามโมเดล Peter Chen ER Model ในไดอะแกรมอย่างเคร่งครัด:
1. `customer`: ข้อมูลลูกค้า
2. `vehicle`: ข้อมูลรถยนต์ (FK: `customer_id`)
3. `user_account`: บัญชีผู้ใช้งานระบบและบทบาท
4. `repair_bay`: ข้อมูลช่องซ่อมรถยนต์ในศูนย์บริการ
5. `queue_ticket`: บัตรคิวการเข้ารับบริการ
6. `repair_order`: ใบสั่งซ่อมหลัก
7. `inspection_item`: รายการตรวจเช็คสภาพรถยนต์
8. `estimate`: ใบประเมินราคาค่าซ่อมและอะไหล่
9. `estimate_item`: รายการค่าแรงและอะไหล่ในใบประเมินราคา
10. `part`: ข้อมูลอะไหล่และยอดคงคลัง
11. `part_request`: รายการขอเบิกอะไหล่
12. `stock_movement`: สมุดบัญชีการเคลื่อนไหวสต็อก (Ledger)
13. `purchase_order`: ใบสั่งซื้ออะไหล่เข้าคลัง
14. `po_line`: รายการอะไหล่ในใบสั่งซื้อ
15. `invoice`: ใบแจ้งหนี้และใบเสร็จรับเงิน
16. `sale_order`: ใบสั่งขายอะไหล่หน้าร้าน
17. `sale_order_item`: รายการอะไหล่ขายหน้าร้าน
18. `status_log`: บันทึกประวัติการเปลี่ยนสถานะของเอกสารทั้งหมด
