import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// เก็บ client ที่เชื่อมต่อ SSE (map userId กับ response object)
let clients = {};

// Middleware (โค้ดที่ทำงานก่อน request handler)
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// สร้างไฟล์ users.json ถ้ายังไม่มี
const usersFilePath = path.join(__dirname, 'users.json');
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify({ users: [] }));
}

// สร้างไฟล์ messages.json ถ้ายังไม่มี
const messagesFilePath = path.join(__dirname, 'messages.json');
if (!fs.existsSync(messagesFilePath)) {
  fs.writeFileSync(messagesFilePath, JSON.stringify({ messages: [] }));
}

// สร้าง hash ที่ปลอดภัยสำหรับรหัสผ่าน
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// สร้าง UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Endpoint สำหรับสมัครสมาชิก
app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'ต้องระบุชื่อผู้ใช้และรหัสผ่าน' }); // Translated
  }
  
  // อ่านข้อมูลผู้ใช้ปัจจุบัน
  const usersData = JSON.parse(fs.readFileSync(usersFilePath));
  
  // ตรวจสอบว่าชื่อผู้ใช้นี้มีอยู่แล้วหรือไม่
  if (usersData.users.some(user => user.username === username)) {
    return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' }); // Translated
  }
  
  // สร้างผู้ใช้ใหม่พร้อม ID
  const userId = generateUUID();
  const newUser = {
    id: userId,
    username,
    password: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  
  // เพิ่มผู้ใช้ลงในฐานข้อมูล
  usersData.users.push(newUser);
  fs.writeFileSync(usersFilePath, JSON.stringify(usersData, null, 2));
  
  // คืนค่าความสำเร็จโดยไม่มีรหัสผ่าน
  const { password: _, ...userWithoutPassword } = newUser;
  res.status(201).json({ success: true, user: userWithoutPassword });
});

// Endpoint สำหรับล็อกอิน
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'ต้องระบุชื่อผู้ใช้และรหัสผ่าน' }); // Translated (Same as signup)
  }
  
  // อ่านข้อมูลผู้ใช้ปัจจุบัน
  const usersData = JSON.parse(fs.readFileSync(usersFilePath));
  
  // ค้นหาผู้ใช้
  const user = usersData.users.find(user => 
    user.username === username && 
    user.password === hashPassword(password)
  );
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }); // Translated
  }
  
  // คืนค่าความสำเร็จโดยไม่มีรหัสผ่าน
  const { password: _, ...userWithoutPassword } = user;
  res.json({ success: true, user: userWithoutPassword });
});

// ส่งข้อความไปยัง webhook และเก็บใน messages.json
app.post('/api/send-message', async (req, res) => {
  const { userId, message, sessionId } = req.body; // เพิ่ม sessionId

  if (!userId || !message || !sessionId) { // เพิ่มการตรวจสอบ sessionId
    return res.status(400).json({ success: false, message: 'ต้องระบุ ID ผู้ใช้, ข้อความ, และ ID เซสชัน' }); // อัปเดตข้อความ
  }
  
  // อ่านข้อมูลผู้ใช้ปัจจุบันเพื่อยืนยัน userId
  const usersData = JSON.parse(fs.readFileSync(usersFilePath));
  const user = usersData.users.find(user => user.id === userId);
  
  if (!user) {
    return res.status(401).json({ success: false, message: 'ID ผู้ใช้ไม่ถูกต้อง' }); // Translated
  }
  
  // กำหนด webhook URL
  const WEBHOOK_URL = "https://n8n.boombignose.site/webhook-test/9dc18c2f-a750-4781-acb6-8406a488be02";
  
  // เก็บข้อความไว้ในเครื่องก่อน
  const messagesData = JSON.parse(fs.readFileSync(messagesFilePath));
  const newMessage = {
    id: generateUUID(),
    userId,
    sessionId, // เพิ่ม sessionId
    username: user.username,
    message,
    timestamp: new Date().toISOString(),
    status: 'pending', // สถานะเป็น pending จนกว่าจะได้ response จาก webhook
    response: null
  };

  messagesData.messages.push(newMessage);
  fs.writeFileSync(messagesFilePath, JSON.stringify(messagesData, null, 2));
  
  // ตอบกลับทันทีว่าได้รับข้อความแล้ว
  res.json({ 
    success: true, 
    message: newMessage,
    status: 'processing',
    messageId: newMessage.id // ยังคงส่ง messageId กลับไปให้ client
  });

  // ส่งไปยัง webhook (ไม่ต้องรอที่นี่แล้ว)
  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      username: user.username,
      userId: user.id,
      sessionId: sessionId, // ส่ง sessionId
      messageId: newMessage.id,
      // เพิ่ม response webhook URL เพื่อให้ n8n เรียกกลับ
      responseUrl: `https://workshop101.boombignose.site/api/webhook-response` 
    })
  }).catch(error => {
    // ล็อก error หากการส่งไปยัง webhook ล้มเหลวในตอนแรก
    console.error('Error sending initial request to webhook:', error);
    // ตัวเลือก: อัปเดตสถานะข้อความเป็น error ที่นี่ถ้าต้องการ
    const updatedMessagesData = JSON.parse(fs.readFileSync(messagesFilePath));
    const messageIndex = updatedMessagesData.messages.findIndex(msg => msg.id === newMessage.id);
    if (messageIndex !== -1) {
      updatedMessagesData.messages[messageIndex].status = 'error';
      updatedMessagesData.messages[messageIndex].error = 'Failed to send to webhook: ' + error.message;
      fs.writeFileSync(messagesFilePath, JSON.stringify(updatedMessagesData, null, 2));
    }
  });
});

// Endpoint สำหรับ n8n เพื่อส่ง response กลับมา
app.post('/api/webhook-response', (req, res) => {
  const { messageId, response, error } = req.body;

  if (!messageId) {
    console.error('Webhook response missing messageId');
    return res.status(400).json({ success: false, message: 'Missing messageId' });
  }

  try {
    const messagesData = JSON.parse(fs.readFileSync(messagesFilePath));
    const messageIndex = messagesData.messages.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1) {
      console.error(`Webhook response for unknown messageId: ${messageId}`);
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // อัปเดตสถานะข้อความและ response/error
    if (error) {
      messagesData.messages[messageIndex].status = 'error';
      messagesData.messages[messageIndex].error = error;
      console.log(`Received error for message ${messageId}:`, error);
    } else {
      messagesData.messages[messageIndex].status = 'completed';
      messagesData.messages[messageIndex].response = response;
      console.log(`Received response for message ${messageId}`);
    }
    
    fs.writeFileSync(messagesFilePath, JSON.stringify(messagesData, null, 2));
    
    // ตอบกลับ n8n
    res.json({ success: true, message: 'Response received' });

  } catch (err) {
    console.error('Error processing webhook response:', err);
    // ตรวจสอบว่า response ถูกส่งไปแล้วหรือยัง แม้ว่า SSE จะล้มเหลวภายหลัง
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Internal server error processing response' });
    }
  }
  // ส่งอัปเดตผ่าน SSE (ย้ายออกมานอก try/catch หลัก) ---
  try {
    const messagesData = JSON.parse(fs.readFileSync(messagesFilePath));
    const updatedMessage = messagesData.messages.find(msg => msg.id === messageId);
    // --- BEGIN ADDED DEBUG --- 
    console.log(`[SSE Debug] กำลังประมวลผล webhook response สำหรับ messageId: ${messageId}, userId: ${updatedMessage?.userId}`);
    console.log(`[SSE Debug] client ที่เชื่อมต่ออยู่ปัจจุบัน: ${JSON.stringify(Object.keys(clients))}`);
    // --- END ADDED DEBUG --- 
    if (updatedMessage && clients[updatedMessage.userId]) {
      sendSSEUpdate(updatedMessage.userId, { type: 'messageUpdate', payload: updatedMessage });
      console.log(`ส่งอัปเดต SSE สำหรับ message ${messageId} ไปยัง user ${updatedMessage.userId}`);
    } else if (updatedMessage) {
        console.log(`User ${updatedMessage.userId} ไม่ได้เชื่อมต่อผ่าน SSE สำหรับ message ${messageId}`); // เก็บ log เดิมไว้
    }
  } catch (readErr) {
      console.error('เกิดข้อผิดพลาดในการอ่านไฟล์ messages หลัง webhook response:', readErr);
  }
  // --- สิ้นสุดการอัปเดต SSE ---
});


// Endpoint SSE สำหรับอัปเดตเรียลไทม์
app.get('/api/updates/:userId', (req, res) => {
  const { userId } = req.params;

  // ตั้งค่า headers สำหรับ SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // Flush headers เพื่อสร้างการเชื่อมต่อ

  // เก็บ object response ของ client
  clients[userId] = res;
  // --- BEGIN ADDED DEBUG --- 
  console.log(`[SSE Connect] User ${userId} เชื่อมต่อแล้ว client ปัจจุบัน: ${JSON.stringify(Object.keys(clients))}`);
  // --- END ADDED DEBUG ---

  // ส่งข้อความยืนยัน
  sendSSEUpdate(userId, { type: 'connected', payload: { message: 'สร้างการเชื่อมต่อ SSE สำเร็จ' } });

  // จัดการเมื่อ client ตัดการเชื่อมต่อ
  req.on('close', () => {
    delete clients[userId];
    // --- BEGIN ADDED DEBUG --- 
    console.log(`[SSE Disconnect] User ${userId} ตัดการเชื่อมต่อ client ปัจจุบัน: ${JSON.stringify(Object.keys(clients))}`);
    // --- END ADDED DEBUG ---
    res.end();
  });

  // ทำให้การเชื่อมต่อเปิดอยู่โดยส่ง comment เป็นระยะ (ตัวเลือก)
  const keepAliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 20000); // ส่ง comment ทุก 20 วินาที

  req.on('close', () => {
    clearInterval(keepAliveInterval);
  });
});

// ฟังก์ชันช่วยส่งอัปเดต SSE
function sendSSEUpdate(userId, data) {
  const client = clients[userId];
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}


// ดึงประวัติข้อความของผู้ใช้สำหรับเซสชันที่ระบุ
app.get('/api/messages/:userId', (req, res) => {
  const { userId } = req.params;
  const { sessionId } = req.query; // ดึง sessionId จาก query parameters

  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'ต้องระบุ Session ID' });
  }

  // อ่านข้อความ
  const messagesData = JSON.parse(fs.readFileSync(messagesFilePath));

  // กรองข้อความตาม userId และ sessionId
  const userSessionMessages = messagesData.messages.filter(msg => 
    msg.userId === userId && msg.sessionId === sessionId
  );

  res.json({ success: true, messages: userSessionMessages });
});

// ดึง session ID ที่ไม่ซ้ำกันสำหรับผู้ใช้ พร้อมข้อความแรก
app.get('/api/sessions/:userId', (req, res) => {
  const { userId } = req.params;

  try {
    const messagesData = JSON.parse(fs.readFileSync(messagesFilePath));
    const userMessages = messagesData.messages.filter(msg => msg.userId === userId && msg.sessionId);

    // จัดกลุ่มข้อความตาม sessionId
    const sessionsMap = userMessages.reduce((map, msg) => {
      if (!map[msg.sessionId]) {
        map[msg.sessionId] = { 
          sessionId: msg.sessionId,
          messages: [] 
        };
      }
      map[msg.sessionId].messages.push(msg);
      return map;
    }, {});

    // ค้นหาข้อความแรกและ timestamp สุดท้ายสำหรับแต่ละเซสชัน
    const sessions = Object.values(sessionsMap).map(session => {
      // เรียงข้อความภายในเซสชันตาม timestamp (เก่าสุดก่อน)
      session.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const firstMessage = session.messages[0]?.message || 'No message'; // ดึงข้อความของข้อความแรก
      const lastTimestamp = session.messages[session.messages.length - 1].timestamp; // Timestamp ของข้อความสุดท้าย
      return {
        sessionId: session.sessionId,
        firstMessage: firstMessage,
        lastTimestamp: lastTimestamp
      };
    });

    // เรียงเซสชันตาม timestamp ของข้อความสุดท้าย (ล่าสุดก่อน)
    sessions.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp)); 

    res.json({ success: true, sessions: sessions });

  } catch (err) {
    console.error(`เกิดข้อผิดพลาดในการดึงเซสชันสำหรับ user ${userId}:`, err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงเซสชัน' });
  }
});


// เริ่มเซิร์ฟเวอร์
app.listen(PORT, '0.0.0.0', () => {
  console.log(`เซิร์ฟเวอร์กำลังทำงานบนพอร์ต ${PORT}`); // แปล console log แล้ว
});
