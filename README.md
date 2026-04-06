# SWI Foods — QA Receiving API
**Form FM-QA-31 | Reference SD-QA-08**  
Cloudflare Worker + D1 Database (ไม่ต้อง npm install)

---

## วิธี Deploy (3 ขั้นตอน)

### 1. ติดตั้ง Wrangler
```bash
npm install
```

### 2. Login Cloudflare
```bash
npx wrangler login
```

### 3. Deploy Worker
```bash
npx wrangler deploy
```

ได้ URL:
```
https://qa-receiving-api.<subdomain>.workers.dev
```

---

## ตั้งค่า HTML App

เปิด `QA_Receiving_App.html` และ `QA_Receiving_Mobile.html`  
ค้นหา `const API_BASE = '';` แล้วเปลี่ยนเป็น:

```javascript
const API_BASE = 'https://qa-receiving-api.<subdomain>.workers.dev';
```

---

## API Endpoints

| Method | Path | คำอธิบาย |
|--------|------|-----------|
| GET | `/api/health` | ตรวจสอบ status |
| POST | `/api/receiving` | บันทึกการรับใหม่ |
| GET | `/api/receiving` | ดึงรายการทั้งหมด |
| GET | `/api/receiving/:docNo` | ดึงรายการเดียว |
| POST | `/api/nc` | บันทึก NC |
| GET | `/api/nc` | ดึง NC ทั้งหมด |
| PATCH | `/api/nc/:id` | ปิด NC |
| GET | `/api/stats` | สถิติ Dashboard |
| GET | `/api/export` | Export JSON → Excel |

---

## Query Parameters

```
GET /api/receiving?from=2026-04-01&to=2026-04-30
GET /api/receiving?supplier=SP0004
GET /api/export?from=2026-04-01
GET /api/nc?status=Open
```

---

## D1 Database: qa-factory-db
| Table | เนื้อหา |
|-------|---------|
| `receiving_header` | ข้อมูลหัวเอกสาร + ลายเซ็น |
| `receiving_detail` | รายการวัตถุดิบ + รูปถ่าย |
| `nc_log` | รายการ Non-Conformance |
| `signatures` | ลายเซ็น Base64 |
