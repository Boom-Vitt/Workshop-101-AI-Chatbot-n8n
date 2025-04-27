# BOOM BIG NOSE Chat

แอปพลิเคชันแชทอย่างง่าย พร้อมระบบล็อกอิน/สมัครสมาชิก และการเชื่อมต่อกับ Webhook

---

## สิ่งที่ต้องมี (โปรแกรมพื้นฐานที่ต้องติดตั้งก่อน)

* **Node.js:** โปรแกรมสำหรับรันโค้ด JavaScript ฝั่งเซิร์เวอร์
    * ดาวน์โหลดได้ที่ [https://nodejs.org/](https://nodejs.org/)
    * (แนะนำให้เลือกเวอร์ชัน **LTS** เพราะเหมาะสำหรับผู้ใช้ส่วนใหญ่)

* **npm (Node Package Manager):** โดยปกติตั้งมาพร้อมกับ Node.js แล้ว

* **Terminal หรือ Command Prompt:** สำหรับรันคำสั่ง

---

## การติดตั้ง (Download and Setup)

### 1. ดาวน์โหลดโค้ดด้วยตนเอง (Download ZIP)

เพื่อโปรเจ็คที่ GitHub หากยังไม่มี Git:

1. ไปที่ GitHub repository ของโครงการ (เช่น: `https://github.com/yourusername/your-repo-name`)
2. กด **"Code"** -> **"Download ZIP"**
3. แตกไฟล์ (Extract)

### 2. เข้าไปที่โฟลเดอร์

เปิด Terminal/คอมแมนด์ Prompt แล้ว cd เข้าไปที่โฟลเดอร์ที่แตกไฟล์
```bash
cd path\to\your\project-folder
```

### 3. ติดตั้ง Dependencies

รันคำสั่ง:
```bash
npm install
```

### 4. เริ่มเซิร์เวอร์

```bash
node server.js
```

และเปิด Browser ไปที่
```
http://localhost:3000
```

---

## การตั้งค่า Webhook และ Port เพิ่มเติม

* Webhook URL สามารถได้ที่ `server.js` (ประมาณ~123) และ `script.js` (ประมาณ~7)
* Port เริ่มเริ่ม 3000

---

## การทดสอบ Webhook ด้วย Ngrok

### ติดตั้ง Ngrok

1. ดาวน์โหลด Ngrok: [https://ngrok.com/download](https://ngrok.com/download)
2. (แนะนำ) สมัครสมาชิกและตั้งค่า authtoken:
```bash
ngrok config add-authtoken <YOUR_AUTHTOKEN>
```

### รัน Ngrok

```bash
ngrok http 3000
```

แล้วคัดลอก URL `https://xxxxxxxx.ngrok-free.app`

### เปลี่น URL Webhook

* แทน URL webhook ใน n8n เป็น URL ใหม่ เสียบ path เดิมเสมือน เช่น:

```
https://xxxxxxxx.ngrok-free.app/api/webhook-response
```

**หมายเท่าเล็ก:**

- URL Ngrok จะเปลี่นทุกครั้งรัน Ngrok
- ต้องเริ่ม Ngrok เพื่อทดสอบ Webhook

---

## การอนุญาตใช้งาน (License)

โค้ดนี้เปิดให้ใช้เพื่อการศึกษึการ และทดลองส่วนตัว หากต้องการนำไปใช้เป็นเหตุประโยชน์ กรุณาติดต่อติดต่อที่: [vittawat.soo@gmail.com](mailto:vittawat.soo@gmail.com)

