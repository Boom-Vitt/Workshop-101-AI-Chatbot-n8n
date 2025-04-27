// การจัดการสถานะผู้ใช้
let currentUser = null;
let currentSessionId = null; // เพิ่มสำหรับจัดการเซสชัน
let sseSource = null; // เพิ่มสำหรับเชื่อมต่อ SSE

// === URL ของ Webhook ===
const WEBHOOK_URL = "https://n8n.boombignose.site/webhook-test/9dc18c2f-a750-4781-acb6-8406a488be02";

// DOM Elements (อ้างอิงถึงส่วนต่างๆ ในหน้าเว็บ)
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const actionBtns = document.querySelectorAll('.action-btn');
const headerGreeting = document.getElementById('header-greeting');
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginSection = document.getElementById('login-section');
const signupSection = document.getElementById('signup-section');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutBtn = document.getElementById('logout-btn');
const newChatBtn = document.getElementById('new-chat-btn'); // ปุ่มแชทใหม่
const sessionList = document.getElementById('session-list'); // รายการเซสชัน
const chatWrapper = document.getElementById('chat-wrapper'); // กรอบหุ้มแชท
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');

// ข้อความตัวอย่างสำหรับปุ่ม Action
const actionPrompts = [
  "ช่วยเขียนบทความสั้นเกี่ยวกับ AI",
  "สอนฉันเรื่องฟิสิกส์เบื้องต้น",
  "ช่วยเขียนโค้ด JavaScript ตัวอย่าง",
  "แนะนำวิธีดูแลสุขภาพจิต",
  "ขอคำแนะนำอะไรก็ได้"
];

// สร้าง UUID (เวอร์ชันง่ายสำหรับฝั่ง client)
function generateClientUUID() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

// ตรวจสอบว่าผู้ใช้ล็อกอินอยู่แล้วหรือไม่ (จาก localStorage)
function checkAuth() {
  const savedUser = localStorage.getItem('user');
  const savedSessionId = localStorage.getItem('sessionId'); // โหลด sessionId
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      // ใช้เซสชันที่บันทึกไว้ หรือสร้างใหม่หากไม่มี
      currentSessionId = savedSessionId || generateClientUUID(); 
      localStorage.setItem('sessionId', currentSessionId); // บันทึกหากสร้างใหม่
      showChat();
    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการแปลงข้อมูลผู้ใช้หรือเซสชัน:', err);
      logout();
    }
  }
}

// แสดงฟอร์มยืนยันตัวตน
function showAuth() {
  authContainer.style.display = 'block';
  chatWrapper.style.display = 'none'; // ซ่อนกรอบแชททั้งหมด
  logoutBtn.style.display = 'none';
  newChatBtn.style.display = 'none'; // ซ่อนปุ่มแชทใหม่
  toggleSidebarBtn.style.display = 'none'; // ซ่อนปุ่มสลับแถบด้านข้าง
  headerGreeting.textContent = 'BOOM BIG NOSE'; // รีเซ็ตเป็นชื่อหลัก
}

// แสดงหน้าจอแชท (รวมถึงแถบด้านข้าง)
function showChat() {
  authContainer.style.display = 'none';
  chatWrapper.style.display = 'flex';
  logoutBtn.style.display = 'block';
  newChatBtn.style.display = 'block';
  toggleSidebarBtn.style.display = 'block'; // ทำให้ปุ่มสลับมองเห็น
  newChatBtn.textContent = 'แชทใหม่';
  headerGreeting.textContent = `สวัสดี, ${currentUser.username}`;

  // ตรวจสอบว่า sessionId มีอยู่จริง ถ้าไม่มีให้สร้างใหม่
  if (!currentSessionId) {
    currentSessionId = generateClientUUID();
    localStorage.setItem('sessionId', currentSessionId);
  }

  // รีเซ็ตสถานะแถบด้านข้างตาม CSS เริ่มต้น (ตรวจสอบว่ายุบอยู่หรือไม่)
  if (window.getComputedStyle(sidebar).getPropertyValue('width') === '0px') {
      sidebar.classList.add('collapsed'); // ทำให้ class ตรงกับสถานะ
      toggleSidebarBtn.innerText = '⏩'; // ตั้งไอคอนสำหรับสถานะยุบ
  } else {
      sidebar.classList.remove('collapsed');
      toggleSidebarBtn.innerText = '⏪'; // ตั้งไอคอนสำหรับสถานะขยาย
  }

  // โหลดประวัติแชทของผู้ใช้สำหรับเซสชันปัจจุบัน
  loadChatHistory();
  loadSessionList();
  connectSSE();
}

// ลอจิกการสลับแถบด้านข้าง
toggleSidebarBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  if (sidebar.classList.contains('collapsed')) {
    toggleSidebarBtn.innerText = '⏩';
  } else {
    toggleSidebarBtn.innerText = '⏪';
  }
});

// สร้างการเชื่อมต่อ SSE
function connectSSE() {
  if (sseSource) {
    sseSource.close(); // ปิดการเชื่อมต่อเดิมถ้ามี
  }
  if (!currentUser) return; // ไม่ต้องเชื่อมต่อถ้ายังไม่ได้ล็อกอิน

  console.log(`Connecting to SSE for user ${currentUser.id}...`);
  sseSource = new EventSource(`/api/updates/${currentUser.id}`);

  sseSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('ได้รับข้อความ SSE:', data);
      handleSSEMessage(data);
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการแปลงข้อความ SSE:', error);
    }
  };

  sseSource.onerror = (error) => {
    console.error('เกิดข้อผิดพลาดในการเชื่อมต่อ SSE:', error);
    // อาจจะเพิ่มลอจิกเชื่อมต่อใหม่ที่นี่
    sseSource.close(); // ปิดเมื่อเกิดข้อผิดพลาดไปก่อน
    // อาจจะลองเชื่อมต่อใหม่หลังจากดีเลย์
    // setTimeout(connectSSE, 5000); 
  };
}

// จัดการข้อความ SSE ที่เข้ามา
function handleSSEMessage(data) {
  if (data.type === 'messageUpdate' && data.payload) {
    const updatedMessage = data.payload;

    // ตรวจสอบว่าการอัปเดตเป็นของเซสชันปัจจุบัน
    if (updatedMessage.sessionId !== currentSessionId) {
        console.log(`ไม่สนใจการอัปเดต SSE สำหรับเซสชันอื่น: ${updatedMessage.sessionId}`);
        return;
    }

    // ค้นหา placeholder ของข้อความที่กำลังโหลดโดยใช้ data attribute
    const loadingMsgElement = document.querySelector(`.message.loading[data-message-id="${updatedMessage.id}"]`);

    if (loadingMsgElement) {
      const bubble = loadingMsgElement.querySelector('.bubble');
      if (bubble) {
        if (updatedMessage.status === 'completed') {
          // ตรวจสอบ reply อย่างละเอียดขึ้น
          if (updatedMessage.response && typeof updatedMessage.response.reply === 'string' && updatedMessage.response.reply.trim() !== '') {
            bubble.textContent = updatedMessage.response.reply;
          } else {
            // ข้อความสำรองหาก reply หายไปหรือว่างเปล่า
            bubble.textContent = "❗️ ไม่พบข้อความตอบกลับที่ถูกต้องจากบอท"; // ข้อความสำรองที่อัปเดตแล้ว
          }
          loadingMsgElement.classList.remove('loading'); // ลบคลาส loading เมื่อเสร็จสิ้น
        } else if (updatedMessage.status === 'error') {
          bubble.textContent = `เกิดข้อผิดพลาด: ${updatedMessage.error || 'ไม่ทราบสาเหตุ'}`;
          loadingMsgElement.classList.add('error');
          loadingMsgElement.classList.remove('loading'); // ลบคลาส loading เมื่อเกิดข้อผิดพลาด
        } else {
          // อัปเดตสถานะสำหรับสถานะกลางถ้าต้องการ (ตัวเลือก)
          // bubble.textContent = `สถานะ: ${updatedMessage.status}`; 
        }
      }
      // เก็บ data-message-id ไว้เผื่ออ้างอิงในอนาคต, แค่ลบสถานะ loading ออก
      // loadingMsgElement.removeAttribute('data-message-id'); // ไม่จำเป็นแล้ว? เก็บไว้เพื่อความสอดคล้อง
    } else {
      // หากไม่พบ element ข้อความ loading (เช่น รีโหลดหน้า), อาจจะแค่เพิ่มเข้าไป?
      console.warn(`ไม่พบ element ข้อความ loading สำหรับการอัปเดต: ${updatedMessage.id}`);
      if ((updatedMessage.status === 'completed' || updatedMessage.status === 'error') && !document.querySelector(`[data-message-id="${updatedMessage.id}"]`)) {
        appendMessage('bot', updatedMessage.response?.reply || `ข้อผิดพลาด: ${updatedMessage.error}`, updatedMessage.id);
      }
    }
  } else if (data.type === 'connected') {
      console.log('เซิร์ฟเวอร์ยืนยันการเชื่อมต่อ SSE แล้ว');
  }
}


// ออกจากระบบผู้ใช้
function logout() {
  if (sseSource) {
    sseSource.close(); // ปิดการเชื่อมต่อ SSE เมื่อออกจากระบบ
    sseSource = null;
  }
  currentUser = null;
  currentSessionId = null; // ล้าง session ID
  localStorage.removeItem('user');
  localStorage.removeItem('sessionId'); // ลบ session ID ออกจาก storage
  chatMessages.innerHTML = '';
  sessionList.innerHTML = ''; // ล้างรายการเซสชันเมื่อออกจากระบบ
  
  // รีเซ็ตข้อความ header
  headerGreeting.textContent = 'BOOM BIG NOSE'; 
  // Tagline เป็นข้อความคงที่ใน HTML, ควรจะกลับมาแสดงถูกต้องเมื่อแสดงหน้า auth

  showAuth();
}

// โหลดประวัติแชทของผู้ใช้สำหรับเซสชันปัจจุบัน
async function loadChatHistory() {
  if (!currentUser || !currentSessionId) return; // ต้องมี user และ session
  
  chatMessages.innerHTML = ''; // ล้างข้อความที่มีอยู่ก่อน
  
  try {
    // ดึงข้อความสำหรับ user และ session ที่ระบุ
    const response = await fetch(`/api/messages/${currentUser.id}?sessionId=${currentSessionId}`); 
    const data = await response.json();
    
    if (data.success && data.messages && data.messages.length > 0) {
      // ข้อความถูกเรียงตาม timestamp บนเซิร์ฟเวอร์อยู่แล้วโดยลำดับการ push
      chatMessages.innerHTML = '';
      
      data.messages.forEach(msg => {
        appendMessage('user', msg.message);
        if (msg.response && msg.response.reply) {
          appendMessage('bot', msg.response.reply);
        }
      });
      
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (err) {
    console.error('ไม่สามารถโหลดประวัติแชทได้:', err);
  }
  // ไฮไลท์เซสชันที่ใช้งานอยู่ในแถบด้านข้างหลังโหลด
  highlightActiveSession(); 
}

// โหลดรายการเซสชันสำหรับแถบด้านข้าง
async function loadSessionList() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/sessions/${currentUser.id}`);
        const data = await response.json();

        if (data.success && data.sessions) {
            displaySessions(data.sessions);
        } else {
            console.error('ไม่สามารถโหลดเซสชันได้:', data.message);
            sessionList.innerHTML = '<li>ไม่สามารถโหลดประวัติแชทได้</li>';
        }
    } catch (err) {
        console.error('เกิดข้อผิดพลาดในการดึงเซสชัน:', err);
        sessionList.innerHTML = '<li>เกิดข้อผิดพลาดในการโหลด</li>';
    }
}

// แสดงเซสชันในแถบด้านข้าง
function displaySessions(sessions) {
    sessionList.innerHTML = ''; // ล้างรายการปัจจุบัน
    if (sessions.length === 0) {
        sessionList.innerHTML = '<li>ยังไม่มีแชท</li>'; // ข้อความหากไม่มีเซสชัน
        return;
    }

    sessions.forEach(session => {
        const li = document.createElement('li');
        li.dataset.sessionId = session.sessionId;
        
        // ใช้ข้อความแรกในการแสดงผล
        li.textContent = session.firstMessage; 
        li.title = session.firstMessage; // แสดงข้อความแรกเต็มๆ เมื่อ hover (ตัวเลือก)
        
        if (session.sessionId === currentSessionId) {
            li.classList.add('active'); // ทำเครื่องหมายเซสชันปัจจุบัน
        }

        li.addEventListener('click', () => {
            switchSession(session.sessionId);
        });
        sessionList.appendChild(li);
    });
    highlightActiveSession(); // ทำให้ไฮไลท์ถูกต้องเสมอ
}

// สลับไปยังเซสชันแชทอื่น
function switchSession(sessionId) {
    if (sessionId === currentSessionId) return; // ไม่ต้องทำอะไรถ้าคลิกเซสชันที่ใช้งานอยู่

    console.log(`กำลังสลับไปยังเซสชัน: ${sessionId}`);
    currentSessionId = sessionId;
    localStorage.setItem('sessionId', currentSessionId); // บันทึกเซสชันที่เพิ่งใช้งาน
    loadChatHistory(); // โหลดประวัติสำหรับเซสชันที่เลือก
    // ไม่จำเป็นต้องเรียก loadSessionList ที่นี่ แค่ไฮไลท์พอ
    highlightActiveSession(); 
}

// ไฮไลท์เซสชันที่ใช้งานอยู่ในรายการ
function highlightActiveSession() {
    const items = sessionList.querySelectorAll('li');
    items.forEach(item => {
        if (item.dataset.sessionId === currentSessionId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// สลับระหว่างฟอร์ม login และ signup
showSignupLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginSection.style.display = 'none';
  signupSection.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  signupSection.style.display = 'none';
  loginSection.style.display = 'block';
});

// จัดการการ submit ฟอร์ม login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  // ล้างข้อความ error ที่มีอยู่
  const existingError = loginForm.querySelector('.error-message');
  if (existingError) existingError.remove();
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
      loginForm.reset();
      // ตรวจสอบว่ามี session ID อยู่เมื่อ login
      currentSessionId = localStorage.getItem('sessionId') || generateClientUUID();
      localStorage.setItem('sessionId', currentSessionId);
      showChat();
    } else {
      // แสดงข้อความ error
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = data.message || 'เข้าสู่ระบบไม่สำเร็จ'; // Translated
      loginForm.prepend(errorMsg);
    }
  } catch (err) {
    console.error('Login error:', err);
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองอีกครั้ง'; // Translated
    loginForm.prepend(errorMsg);
  }
});

// จัดการการ submit ฟอร์ม signup
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-confirm').value;
  
  // ล้างข้อความ error ที่มีอยู่
  const existingError = signupForm.querySelector('.error-message');
  if (existingError) existingError.remove();
  
    // ตรวจสอบว่ารหัสผ่านตรงกันหรือไม่
    if (password !== confirmPassword) {
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = 'รหัสผ่านไม่ตรงกัน'; // Translated
      signupForm.prepend(errorMsg);
      return;
  }
  
  try {
    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // แสดงข้อความ success และสลับไปหน้า login
      const successMsg = document.createElement('div');
      successMsg.className = 'success-message';
      successMsg.textContent = 'สร้างบัญชีสำเร็จ! กรุณาเข้าสู่ระบบ'; // Translated
      loginForm.prepend(successMsg);
      
      signupForm.reset();
      signupSection.style.display = 'none';
      loginSection.style.display = 'block';
    } else {
      // แสดงข้อความ error
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = data.message || 'สมัครสมาชิกไม่สำเร็จ'; // Translated
      signupForm.prepend(errorMsg);
    }
  } catch (err) {
    console.error('Signup error:', err);
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองอีกครั้ง'; // Translated
    signupForm.prepend(errorMsg);
  }
});

// จัดการการคลิกปุ่ม logout
logoutBtn.addEventListener('click', logout);

// จัดการการคลิกปุ่ม New Chat
newChatBtn.addEventListener('click', () => {
  currentSessionId = generateClientUUID(); // สร้าง session ID ใหม่
  localStorage.setItem('sessionId', currentSessionId); // บันทึก session ID ใหม่
  chatMessages.innerHTML = ''; // ล้างการแสดงผลแชท
  appendMessage('system', 'เริ่มแชทใหม่แล้ว'); // ตัวเลือก: แจ้งว่าเริ่มแชทใหม่
  loadSessionList(); // รีเฟรชรายการเซสชันเพื่อรวม/ไฮไลท์อันใหม่
  chatInput.focus();
});

// ใส่ prompt จากปุ่ม action
actionBtns.forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    chatInput.value = actionPrompts[idx];
    chatInput.focus();
  });
});

// จัดการการ submit ฟอร์มแชท
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!currentUser) {
    showAuth();
    return;
  }
  
  const text = chatInput.value.trim();
  if (!text) return;
  
  appendMessage('user', text);
  chatInput.value = '';
  chatInput.disabled = true;

  // แสดง animation กำลังโหลด
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'message bot loading'; // เพิ่มคลาส loading
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = 'กำลังตอบ... <span class="loading-dots"><span></span><span></span><span></span></span>';
  loadingDiv.appendChild(bubble);
  chatMessages.appendChild(loadingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  try {
    // อัปเดตสถานะครั้งแรก
    updateLoadingMessage('กำลังส่งข้อความ...');
    
    // ส่งข้อความ Response จะมี messageId จริง
    const initialResponse = await sendMessageToWebhook(text); 
    
    // เชื่อม messageId จริงกับ element loading
    if (initialResponse.messageId && loadingDiv) {
        loadingDiv.dataset.messageId = initialResponse.messageId; // ใช้ data attribute
    }
    
    // ให้ข้อความ loading แสดงค้างไว้ 
    // handleSSEMessage จะหามันเจอโดยใช้ dataset.messageId
    updateLoadingMessage('กำลังรอการตอบกลับ...'); // อัปเดตข้อความ loading

  } catch (err) {
    // จัดการ error ระหว่างการส่ง *ครั้งแรก*
    console.error('Error sending message:', err);
    
    // อัปเดตข้อความ loading ให้แสดง error
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingMsg) {
        const bubble = loadingMsg.querySelector('.bubble');
        if (bubble) {
            bubble.textContent = "เกิดข้อผิดพลาดในการส่ง: " + err.message;
        }
        loadingMsg.id = ''; // ลบ ID เพื่อไม่ให้ SSE อัปเดตภายหลัง
        loadingMsg.classList.add('error'); // ตัวเลือก: เพิ่มสไตล์ error
    } else {
        // หาก loading หายไปอย่างใด, เพิ่ม error เป็นข้อความใหม่
        appendMessage('bot', "เกิดข้อผิดพลาดในการส่ง: " + err.message);
    }
  } finally {
    chatInput.disabled = false;
    chatInput.focus();
  }
});

// อัปเดตข้อความ loading
function updateLoadingMessage(text) {
  const loadingMsg = document.getElementById('loading-msg');
  if (loadingMsg) {
    const bubble = loadingMsg.querySelector('.bubble');
    if (bubble) {
      bubble.innerHTML = text + ' <span class="loading-dots"><span></span><span></span><span></span></span>';
    }
  }
}

// ส่งข้อความไปยัง webhook (ไม่ต้องรอ response สุดท้ายที่นี่แล้ว)
async function sendMessageToWebhook(message) {
  const res = await fetch('/api/send-message', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      userId: currentUser.id,
      message,
      sessionId: currentSessionId // Send current session ID
    })
  });
  
  if (!res.ok) throw new Error("เกิดข้อผิดพลาด: " + res.status);
  // เซิร์ฟเวอร์ตอบกลับทันทีพร้อม messageId, status 'processing'
  const data = await res.json(); 
  
  // คืนค่าข้อมูลเริ่มต้น (มี messageId) หรือโยน error ถ้าจำเป็น
  return data; 
}

// ลบฟังก์ชัน pollMessageStatus ออกเพราะแทนที่ด้วย SSE แล้ว


// เพิ่มข้อความลงในแชท
function appendMessage(sender, text, messageId = null) { // เพิ่ม messageId ที่เป็นตัวเลือก
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`; 
  if (messageId) {
      msgDiv.dataset.messageId = messageId; // เพิ่ม data attribute เพื่ออาจจะหาเจอภายหลัง
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  // ข้อความธรรมดาก่อน, อาจจะปรับปรุงภายหลัง (เช่น markdown)
  bubble.textContent = text; 
  msgDiv.appendChild(bubble);
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Animation จุด loading (CSS)
const style = document.createElement('style');
style.innerHTML = `
.loading-dots {
  display: inline-block;
  width: 32px;
  text-align: left;
  margin-left: 6px;
}
.loading-dots span {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 1px;
  background: #bdbdbd;
  border-radius: 50%;
  animation: loadingBounce 1.2s infinite both;
}
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes loadingBounce {
  0%, 80%, 100% { transform: scale(1);}
  40% { transform: scale(1.5);}
}
`;
document.head.appendChild(style);

// ตรวจสอบการยืนยันตัวตนเมื่อโหลดหน้า
checkAuth();
