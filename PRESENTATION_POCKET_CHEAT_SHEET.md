# 🚗 Auto Garage OS — 1-Page Presentation Pocket Cheat Sheet
*(เอกสารสรุปย่อ 1 หน้า สำหรับเปิดดูบนมือถือ / แท็บเล็ต ขณะนำเสนอโครงงาน)*

---

## 📌 5 กฎเหล็กของอาจารย์สมโชค (ห้ามพลาดเด็ดขาด!)
1. **หัวแปลง HDMI**: นำของตัวเองมาด้วย *(ยืมอาจารย์หัก 2.5 คะแนน)*
2. **สไลด์นำเสนอ**: ต้องมี **เลขหน้าสไลด์ทุกหน้า** และบันทึกเป็น PDF สำรองไว้
3. **หน้าปกสไลด์ / เล่มรายงาน**: ต้องมี **รูปถ่ายหน้าตรง, รหัสนิสิต, ชื่อทุกคน** *(ขาดหัก 5 คะแนน)*
4. **เปิดกล้อง**: สมาชิกทุกคนต้องเข้าห้องเรียน/เปิดกล้องพร้อมเพรียง *(ไม่เปิดหัก 50%)*
5. **ผัง To-Be Swimlane**: **ห้ามมีช่อง/เลนชื่อ "System"** *(มีหัก 3 คะแนน)*

---

## 🔑 บัญชีล็อกอินสาธิต (Quick Role Switcher)
> เข้าหน้าเว็บ: **`http://localhost:3000/login`** *(ทุกรหัสผ่านคือ `password123` หรือกดปุ่มลัดสลับบทบาทด้านล่างฟอร์ม)*

| บทบาท (Role) | บัญชีผู้ใช้ (Username) | หน้าที่หลักที่ต้องกดสาธิต |
| :--- | :--- | :--- |
| **Front Desk** | `frontdesk` | ลงทะเบียนรับรถ (`/front-desk/check-in`), ดูกระดานคิวสด (`/front-desk/queue`), ออกใบเสร็จ (`/front-desk/billing`) |
| **Mechanic** | `somchai` | ตรวจวินิจฉัย/สร้างใบประเมินราคา Rev 1 (`/mechanic/diagnostics`), ขอเบิกอะไหล่, ตรวจ QC ปลดช่องซ่อม (`/mechanic/bay`) |
| **Warehouse** | `wichai` | อนุมัติเบิกจ่ายอะไหล่ตัดสต็อก (`/warehouse/issuance`), ดูสมุดบัญชีสต็อก (`/warehouse/ledger`) |
| **Sales Counter** | `somsri` | ขายอะไหล่หน้าร้าน POS ตัดสต็อกทันที (`/sales/pos`) |
| **Service Manager** | `admin` | ดูแดชบอร์ดสถิติผู้บริหาร (`/admin/dashboard`), พิมพ์รายงานทางการ (`/reports/repairs`, `/reports/inventory`) |
| **H2 Database Console** | `sa` (รหัสผ่านว่าง) | เข้าดูตารางสดที่ **`http://localhost:8080/h2-console`** (JDBC URL: `jdbc:h2:file:./data/garagedb`) |

---

## 🎬 ลำดับการกด Demo สด 8 ขั้นตอน (เดินเรื่องไหลลื่นใน 5 นาที)
1. **`/login`**: โชว์ระบบสิทธิ์ RBAC 5 แผนก และกด Quick Persona Switcher
2. **`Front Desk` -> `/front-desk/check-in`**: กรอกทะเบียน `1กข-9999` ระบุอาการเสีย กดเปิดคิว ได้บัตรคิว `Q-005`
3. **`Front Desk` -> `/front-desk/queue`**: โชว์กระดานคิวสด FIFO Anti-Starvation กดเรียกคิวเข้าช่องซ่อม `BAY-01`
4. **`Mechanic` -> `/mechanic/diagnostics`**: ช่างตรวจสภาพ ใส่ค่างานซ่อม + อะไหล่ กดส่งใบประเมินราคา Rev 1
5. **`Warehouse` -> `/warehouse/issuance`**: คลังเห็นคำขอเบิก กด "อนุมัติจ่าย" -> ชี้ให้อาจารย์ดูว่าสต็อก On-Hand ลดทันที
6. **`Mechanic` -> `/mechanic/bay`**: ซ่อมเสร็จ กด "ผ่านการตรวจ QC" -> ชี้ให้อาจารย์ดูว่าช่องซ่อม `BAY-01` ถูกปลดว่างทันที
7. **`Front Desk` -> `/front-desk/billing`**: คำนวณส่วนต่างประกันภัย รับเงินสด/โอน ออกใบแจ้งหนี้แบบ Snapshot ปิดงานซ่อมสมบูรณ์
8. **`H2 Console` -> `localhost:8080/h2-console`**: กด Connect โชว์ `SELECT * FROM repair_order;` ยืนยันว่าต่อ Direct JDBC เข้าฐานข้อมูลจริงบน Disk

---

## 🗣️ 4 หมัดฮุกทางเทคนิค (ตอบเมื่ออาจารย์ถามเจาะลึก)
* **ทำไมใช้ Direct JDBC?**: "เพื่อให้ควบคุม SQL Execution Plan และ Transaction ได้โปร่งใส 100% ไร้ Hidden Overhead และรองรับ Append-Only Ledger ได้สมบูรณ์ที่สุด"
* **ป้องกันรถชนช่องซ่อมอย่างไร?**: "ใช้ Generated Column ร่วมกับ Database UNIQUE Constraint `uk_ro_single_active_bay` บล็อกระดับ Storage Engine ถ้าชนกันจะติด HTTP 409 Conflict ทันที"
* **on_hand กับ reserved ต่างกันอย่างไร?**: "Available = on_hand - reserved อะไหล่ที่ถูกจองในงานซ่อมแล้ว พนักงานขายหน้าร้านจะไม่สามารถหยิบไปขายตัดหน้าช่างได้"
* **ทำไม stock_movement ห้ามลบ?**: "เป็น Append-Only Double-Entry Ledger ทุกการเคลื่อนไหวบันทึกเป็นประวัติถาวร (Immutable Log) ตรวจสอบที่มาที่ไปย้อนหลังได้ 100%"

---

## ⚡ คำสั่งฉุกเฉิน
* **เริ่มระบบ**: ดับเบิลคลิก `start_system.bat` (รอ 5 วินาที เบราว์เซอร์จะเปิดให้อัตโนมัติ)
* **ปิดระบบ**: ดับเบิลคลิก `stop_system.bat` (ปิดพอร์ต 8080 และ 3000 คืนแรมทั้งหมด)
