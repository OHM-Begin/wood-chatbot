require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const express = require('express');
const { exec } = require('child_process');
const { GoogleGenAI } = require('@google/genai');

// 1. Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2. Express Web Server for QR Code Display
const app = express();
let currentQRDataUrl = null;
let isReady = false;

app.get('/', (req, res) => {
    if (isReady) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>WhatsApp Bot Ready</title></head>
            <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#f0fdf4;">
                <h1 style="color:#16a34a;font-size:32px;">✅ บอท WhatsApp ระบบจัดการไม้ (Packing List & ตัดไม้) พร้อมทำงานแล้ว!</h1>
                <p style="font-size:18px;color:#374151;">คุณสามารถเริ่มค้นหา บันทึกรับเข้า ตัดไม้ออก และคุยกับ Gemini AI ผ่านแชทได้ทันทีครับ</p>
            </body>
            </html>
        `);
    }
    
    if (!currentQRDataUrl) {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>Loading QR Code</title></head>
            <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#f9fafb;">
                <h2>⏳ กำลังสร้าง QR Code...</h2>
            </body>
            </html>
        `);
    }

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta http-equiv="refresh" content="12">
            <title>สแกน QR Code - WhatsApp Wood Bot</title>
            <style>
                body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; font-family: sans-serif; }
                .card { background: white; padding: 35px 45px; border-radius: 20px; box-shadow: 0 15px 35px rgba(0,0,0,0.08); text-align: center; max-width: 480px; }
                img { width: 320px; height: 320px; border: 3px solid #22c55e; border-radius: 14px; padding: 10px; background: white; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>📱 สแกนเชื่อมต่อ WhatsApp</h1>
                <p>เปิดแอป WhatsApp ➔ Linked Devices ➔ Link a Device แล้วสแกน</p>
                <img src="${currentQRDataUrl}" alt="WhatsApp QR Code" />
            </div>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 QR Web Server พร้อมที่ Port: ${PORT}`);
});

// 3. WhatsApp Client Setup
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'clean-pallet-bot'
    }),
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-notifications'
        ]
    }
});

let browserOpened = false;

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ กำลังโหลดข้อมูล WhatsApp: ${percent}% - ${message}`);
});

client.on('authenticated', () => {
    console.log('🔑 ยืนยันตัวตนสำเร็จ (Authenticated)!');
});

client.on('auth_failure', (msg) => {
    console.error('❌ ยืนยันตัวตนไม่สำเร็จ:', msg);
});

client.on('qr', async (qr) => {
    console.log('📱 สร้าง QR Code ใหม่...');
    try {
        currentQRDataUrl = await QRCode.toDataURL(qr, { width: 450, margin: 2 });
        if (!browserOpened && process.platform === 'win32') {
            browserOpened = true;
            exec(`start http://localhost:${PORT}`);
        }
    } catch (err) {
        console.error('Error generating QR code:', err);
    }
});

client.on('ready', () => {
    isReady = true;
    console.log('✅ บอท WhatsApp (ระบบตรวจรับไม้ & เบิกตัดไม้ + Gemini AI) พร้อมทำงานแล้ว!');
});

// 4. Helper: Call Google Apps Script safely
async function callGAS(payload) {
    try {
        const webAppUrl = process.env.WEB_APP_URL;
        if (!webAppUrl) throw new Error('ไม่พบ WEB_APP_URL ใน .env');

        console.log(`📤 ส่งคำสั่งไปที่ GAS:`, JSON.stringify(payload));
        const resp = await fetch(webAppUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
            redirect: 'follow'
        });
        
        const text = await resp.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            console.error('⚠️ ผลลัพธ์จาก GAS ไม่ใช่ JSON:', text.slice(0, 150));
            return { status: 'error', message: 'โปรด Deploy Version ใหม่ใน Google Apps Script' };
        }
        
        console.log(`📥 ผลลัพธ์จาก GAS:`, json);
        return json;
    } catch (err) {
        console.error('❌ Error calling GAS:', err.message);
        return { status: 'error', message: err.message };
    }
}

// 5. Bot Outgoing Messages Registry (Prevent Infinite Loops 100%)
const botOutgoingMessageTexts = new Set();
const processedMsgIds = new Set();

// Helper: Send reply safely to WhatsApp
async function sendReply(msg, replyText) {
    try {
        // Record reply text to prevent the bot from reprocessing its own reply
        botOutgoingMessageTexts.add(replyText.trim());
        if (botOutgoingMessageTexts.size > 200) {
            const firstKey = botOutgoingMessageTexts.values().next().value;
            botOutgoingMessageTexts.delete(firstKey);
        }

        const targetChatId = (msg.fromMe && msg.to) ? msg.to : msg.from;
        const sent = await client.sendMessage(targetChatId, replyText);
        if (sent && sent.id) {
            const sentId = sent.id._serialized || sent.id.id;
            if (sentId) processedMsgIds.add(sentId);
        }
    } catch (err) {
        console.error('Error sending reply:', err.message);
        try {
            const sent = await msg.reply(replyText);
            if (sent && sent.id) {
                const sentId = sent.id._serialized || sent.id.id;
                if (sentId) processedMsgIds.add(sentId);
            }
        } catch (e2) {
            console.error('Fallback reply failed:', e2.message);
        }
    }
}

// 6. Cache for Status Data to save GAS calls
let statusCache = null;
let lastCacheTime = 0;

async function getCachedStatus() {
    const now = Date.now();
    if (statusCache && (now - lastCacheTime < 2000)) {
        return statusCache;
    }
    const gasStatus = await callGAS({ action: 'get_all_status' });
    if (gasStatus && gasStatus.status === 'success') {
        statusCache = gasStatus;
        lastCacheTime = now;
    }
    return gasStatus;
}

// 7. Gemini AI Question Answerer with multi-model fallback & rate-limit handling
async function askGemini(userQuestion) {
    try {
        const gasStatus = await getCachedStatus();
        const rows = gasStatus.rows || [];
        const activeContainer = gasStatus.activeContainer || 'BEAU 5231653/ID48136AA';
        const activePl = gasStatus.activePl || 'PL- 25/ASN/TM/VII/26';

        // Pre-calculate exact statistical totals from rows
        let totalExpected = 0;
        let totalReceived = 0;
        let totalCut = 0;
        let pendingRows = [];
        let completedRows = [];

        rows.forEach(r => {
            const exp = Number(r.expQty) || 0;
            const rec = Number(r.recQty) || 0;
            const cut = Number(r.cutQty) || 0;
            totalExpected += exp;
            totalReceived += rec;
            totalCut += cut;
            if (exp > rec) {
                pendingRows.push(r);
            } else {
                completedRows.push(r);
            }
        });

        const totalPendingBalance = Math.max(0, totalExpected - totalReceived);
        const availableStockInWarehouse = Math.max(0, totalReceived - totalCut);

        const summaryInfo = {
            activeContainer: activeContainer,
            activePl: activePl,
            officialTotals: {
                totalExpectedPCS: totalExpected,
                totalReceivedPCS: totalReceived,
                totalPendingBalancePCS: totalPendingBalance,
                totalCutPCS: totalCut,
                availableStockInWarehousePCS: availableStockInWarehouse,
                pendingItemsCount: pendingRows.length,
                completedItemsCount: completedRows.length
            },
            inventoryData: rows.map(r => ({
                pl: r.plNo,
                container: r.container,
                item: r.item,
                bdl: r.bdl,
                dim: r.dim,
                expQty: r.expQty,
                recQty: r.recQty,
                balQty: r.balQty,
                cutQty: r.cutQty,
                availStock: r.availStock,
                status: r.status
            }))
        };

        const systemPrompt = `คุณคือผู้ช่วย AI อัจฉริยะประจำระบบคลังไม้และการตรวจรับไม้ (Wood Inventory & Cutting Assistant)
หน้าที่ของคุณคือตอบคำถามของผู้ใช้งานเกี่ยวกับสถานะไม้ในตู้คอนเทนเนอร์ (Packing List) และยอดการตัดไม้ในคลัง

📊 ข้อมูลสรุปตัวเลขทางการแบบ Real-time ของตู้ ${activeContainer} (${activePl}):
• ยอดทั้งหมดตาม Packing List: ${totalExpected.toLocaleString()} PCS
• ยอดรับเข้าคลังแล้วรวม: ${totalReceived.toLocaleString()} PCS
• ยอดค้างรับรวม (คงเหลือที่ต้องเข้าตู้): ${totalPendingBalance.toLocaleString()} PCS
• ยอดตัดไม้ออกไปใช้งานแล้ว: ${totalCut.toLocaleString()} PCS
• ยอดไม้คงเหลือพร้อมใช้ในคลังจริง: ${availableStockInWarehouse.toLocaleString()} PCS
• จำนวนรายการที่รับครบแล้ว: ${completedRows.length} รายการ
• จำนวนรายการที่ยังค้างรับ: ${pendingRows.length} รายการ

กฎการตอบคำถาม:
1. ตอบเป็นภาษาไทยอย่างสุภาพ กระชับ ชัดเจน และตรงประเด็น
2. หากผู้ใช้ถามยอดรวม เช่น "ค้างรับกี่ชิ้น", "เหลือกี่ชิ้น", "รับแล้วเท่าไหร่" ให้ใช้ตัวเลขทางการด้านบนเสมอ (ยอดค้างรับรวม = ${totalPendingBalance.toLocaleString()} PCS) ห้ามบวกเลขเองใหม่
3. จัดรูปแบบข้อความด้วย Markdown ของ WhatsApp เช่น ใช้ *ตัวหนา*, อิโมจิ 🪵, 📦, 📊, ✂️, ✅, ⏳
4. หากผู้ใช้ถามเจาะจงเฉพาะ Part หรือ เฉพาะมัด ให้ดูจากรายการด้านล่าง`;

        // Try models with fallback: gemini-2.5-flash -> gemini-2.0-flash
        const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
        let lastError = null;

        for (const modelName of modelsToTry) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: [
                        { role: 'user', parts: [{ text: `${systemPrompt}\n\nข้อมูลสต็อก:\n${JSON.stringify(summaryInfo)}\n\nคำถามจากผู้ใช้: "${userQuestion}"` }] }
                    ]
                });
                if (response && response.text) {
                    return response.text.trim();
                }
            } catch (modelErr) {
                lastError = modelErr;
                console.warn(`Model ${modelName} failed, trying fallback:`, modelErr.message);
            }
        }

        console.error('All Gemini models failed:', lastError ? lastError.message : 'Unknown');
        return null;
    } catch (err) {
        console.error('Error in askGemini:', err);
        return null;
    }
}

// 8. Main Message Processing Function
async function processMessage(msg) {
    if (!msg || !msg.body) return;
    
    const msgId = msg.id ? (msg.id._serialized || msg.id.id) : null;
    if (msgId && processedMsgIds.has(msgId)) return;
    if (msgId) {
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 300) {
            const firstKey = processedMsgIds.values().next().value;
            processedMsgIds.delete(firstKey);
        }
    }

    const rawText = msg.body.trim();
    const cleanText = rawText.toLowerCase();

    // 🛑 CRITICAL LOOP PREVENTION: Ignore any message sent by the bot itself!
    if (botOutgoingMessageTexts.has(rawText) ||
        rawText.startsWith('ขออภัย') ||
        rawText.startsWith('✅ *บันทึกรับเข้าสำเร็จ!*') || 
        rawText.startsWith('✂️ *บันทึกตัดไม้ออกสำเร็จ!*') ||
        rawText.startsWith('📊 *สรุปสถานะ') || 
        rawText.startsWith('🔍 *ข้อมูลไม้:') ||
        rawText.startsWith('🔍 *ผลการค้นหา:') ||
        rawText.startsWith('⏳ *รายการไม้ที่ยังรอรับ') ||
        rawText.startsWith('🪵 *ระบบจัดการไม้') ||
        rawText.startsWith('🎉 *ยินดีด้วยครับ') ||
        rawText.startsWith('⚠️')) {
        return;
    }

    console.log(`📩 ได้รับข้อความจากผู้ใช้: "${rawText}" (from: ${msg.from}, fromMe: ${msg.fromMe})`);

    // ====================================================
    // 1. เมนูคำสั่ง & การทักทาย (Menu / Greetings / Welcome)
    // ====================================================
    const menuKeywords = ['!เมนู', '!help', '!menu', 'เมนู', 'help', 'menu', 'คำสั่ง', 'วิธีใช้', '?', 'สวัสดี', 'สวัสดีครับ', 'สวัสดีค่ะ', 'หวัดดี', 'hi', 'hello', 'start', 'เริ่ม'];
    if (menuKeywords.includes(cleanText)) {
        const helpText = `🪵 *ระบบจัดการคลังไม้ (Wood Inventory & Cutting)*\n` +
                         `━━━━━━━━━━━━━━━━━━━\n` +
                         `👉 *พิมพ์ตัวเลข หรือ แตะคำสั่งเพื่อใช้งานได้ทันที:*\n\n` +
                         `*[ 1 ]* 📊 *ดูสรุปยอดตู้ปัจจุบัน* ➔ พิมพ์ \`1\` หรือ \`สรุป\`\n` +
                         `*[ 2 ]* ⏳ *ดูรายการมัดที่ยังไม่ครบ* ➔ พิมพ์ \`2\` หรือ \`ค้างรับ\`\n` +
                         `*[ 3 ]* 🔍 *เช็คข้อมูลมัดไม้* ➔ พิมพ์ \`มัด [เลข]\` เช่น \`มัด 8\`\n` +
                         `*[ 4 ]* 📥 *บันทึกรับไม้เข้า* ➔ พิมพ์ \`มัด [เลข] [ยอด]\` เช่น \`มัด 24 1592\`\n` +
                         `*[ 5 ]* ✂️ *บันทึกตัดไม้ออก* ➔ พิมพ์ \`[เลข IV] ตัด [Part/มัด] [ยอด]\`\n` +
                         `      • ตัดตาม Part (FIFO): \`PL25 ตัด 8156585 750\`\n` +
                         `      • ตัดตามมัด: \`PL25 มัด 8 ตัด 750\`\n` +
                         `      • ตัดหมดมัด: \`PL25 ตัดหมด 8\`\n` +
                         `*[ 6 ]* 🧠 *คุยถามสต็อกภาษาคน* ➔ เช่น \`Iv pl25 ยอดค้างรับ ทั้งหมด กี่ชิ้น\`\n` +
                         `━━━━━━━━━━━━━━━━━━━\n` +
                         `💡 *ลองพิมพ์ "1" หรือพิมพ์ "มัด 8" ได้เลยครับ*`;
        return sendReply(msg, helpText);
    }

    // ====================================================
    // ทางลัดตัวเลข: [1] สรุปตู้, [2] ค้างรับ
    // ====================================================
    if (rawText === '1') {
        cleanText = 'สรุป';
    } else if (rawText === '2') {
        cleanText = 'ค้างรับ';
    }

    // ====================================================
    // 2. สรุปภาพรวมตู้ & คำถามยอดค้างรับภาษาคน
    // รูปแบบ: "1", "สรุป", "สถานะ", "Iv PL25 ยังค้างรับกี่ชิ้น", "ค้างรับกี่ชิ้น", "เหลือกี่ชิ้น", "เหลือเท่าไหร่"
    // ====================================================
    const isSummaryIntent = cleanText === '1' || 
                            ['!สรุป', '!status', '!summary', 'สรุป', 'status', 'summary', 'รายงาน'].includes(cleanText) ||
                            (cleanText.includes('ค้างรับ') && (cleanText.includes('กี่') || cleanText.includes('เท่าไหร่') || cleanText.includes('ยอด') || cleanText.includes('รวม'))) ||
                            (cleanText.includes('เหลือ') && cleanText.includes('ชิ้น')) ||
                            (cleanText.includes('เหลือ') && cleanText.includes('เท่าไหร่'));

    if (isSummaryIntent) {
        const res = await callGAS({ action: 'summary' });
        if (res && res.status === 'success' && res.totalExpected !== undefined) {
            const exp = Number(res.totalExpected) || 0;
            const rec = Number(res.totalReceived) || 0;
            const bal = Number(res.totalBalance) || 0;
            const cut = Number(res.totalCut) || 0;
            const avail = Number(res.availableStock) || 0;
            const pct = res.percent || '0';
            const comp = res.completedCount || 0;
            const pend = res.pendingCount || 0;
            const ctn = res.container || 'BEAU 5231653';
            const pl = res.plNo || 'PL-25';

            const summaryText = `📊 *สรุปสถานะตู้: ${ctn} (${pl})*\n` +
                                `━━━━━━━━━━━━━━━━━━━\n` +
                                `⏳ *ยอดค้างรับคงเหลือในตู้:* *${bal.toLocaleString()} PCS*\n` +
                                `📥 *รับเข้าคลังแล้ว:* ${rec.toLocaleString()} / ${exp.toLocaleString()} PCS (${pct}%)\n` +
                                `🪵 *ไม้คงเหลือพร้อมใช้ในคลัง:* *${avail.toLocaleString()} PCS*\n` +
                                `✂️ *ตัดไม้ออกไปแล้ว:* ${cut.toLocaleString()} PCS\n` +
                                `───────────────────\n` +
                                `✅ *รับครบแล้ว:* ${comp} รายการ | ⏳ *ยังรอรับ:* ${pend} รายการ\n` +
                                `━━━━━━━━━━━━━━━━━━━`;
            return sendReply(msg, summaryText);
        } else {
            return sendReply(msg, `❌ ไม่สามารถดึงข้อมูลสรุปได้: ${res.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`);
        }
    }

    // ====================================================
    // 3. รายการที่ยังค้างรับ (Pending Items List & "เหลือ Part อะไรบ้าง")
    // รูปแบบ: "2", "ค้างรับ", "ยังไม่ครบ", "รอรับ", "เหลือ Part อะไรบ้าง", "มี Part อะไรบ้าง"
    // ====================================================
    const isPendingIntent = cleanText === '2' ||
                            ['ค้างรับ', 'ยังไม่ครบ', 'รอรับ', 'pending', '!pending', 'เช็คค้าง'].includes(cleanText) ||
                            (cleanText.includes('part') && (cleanText.includes('เหลือ') || cleanText.includes('ค้าง') || cleanText.includes('อะไร')));

    if (isPendingIntent) {
        const res = await callGAS({ action: 'pending_list' });
        if (res && res.status === 'success') {
            const items = res.items || [];
            if (items.length === 0) {
                return sendReply(msg, `🎉 *ยินดีด้วยครับ! ตู้ ${res.container} รับไม้ครบถ้วน 100% แล้วทุกรายการ*`);
            }

            let pendingReply = `⏳ *รายการไม้ที่ยังรอรับเข้าตู้: ${res.container} (${items.length} รายการ)*\n` +
                               `━━━━━━━━━━━━━━━━━━━\n`;
            
            items.slice(0, 15).forEach(it => {
                pendingReply += `• *Part ${it.item}* (มัด ${it.bdl}): ขาดอีก *${Number(it.balQty).toLocaleString()}* PCS [ขนาด: ${it.dim}]\n`;
            });

            if (items.length > 15) {
                pendingReply += `*(และอีก ${items.length - 15} รายการ... พิมพ์ "มัด [เลข]" เพื่อดูเฉพาะมัดได้ครับ)*\n`;
            }
            pendingReply += `━━━━━━━━━━━━━━━━━━━\n` +
                            `💡 *พิมพ์ "1" เพื่อดูยอดรวมทั้งหมด*`;
            return sendReply(msg, pendingReply);
        }
    }

    // ====================================================
    // 4. คำสั่งตัดไม้ออก (Wood Cutting: ตัดตามมัด / ตัดตาม Part FIFO / ตัดหมดมัด)
    // ====================================================
    let cutTargetQuery = null;
    let cutInvoice = null;
    let cutQty = 0;
    let cutAll = false;
    let cutNote = 'เบิกตัดไม้';

    // ดึงชื่อโปรไฟล์และเบอร์โทรของผู้ส่งอัตโนมัติ
    let senderName = 'ผู้ใช้';
    try {
        const contact = await msg.getContact();
        senderName = contact.pushname || contact.name || (msg.author ? msg.author.split('@')[0] : (msg.from ? msg.from.split('@')[0] : 'ผู้ใช้'));
    } catch (err) {
        senderName = msg.from ? msg.from.split('@')[0] : 'ผู้ใช้';
    }

    // 4.1 กรณี "ตัดหมด 14", "ตัดมัด 14 หมด", "เบิกมัด 14 ทั้งหมด"
    let cutAllMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s*)?(?:ตัด|เบิก)(?:หมด|ทั้งหมด|\s+หมด|\s+ทั้งหมด)?(?:\s*มัด|\s*bdl)?\s*(\d+)(?:\s+(?:หมด|ทั้งหมด))?(?:\s+(.+))?$/i);
    if (cutAllMatch && (rawText.includes('หมด') || rawText.includes('ทั้งหมด'))) {
        cutInvoice = cutAllMatch[1] ? cutAllMatch[1].trim() : null;
        cutTargetQuery = `มัด ${cutAllMatch[2].trim()}`;
        cutAll = true;
        cutNote = cutAllMatch[3] ? `${senderName} (${cutAllMatch[3].trim()})` : `เบิกตัดหมดมัด โดย ${senderName}`;
    }

    // 4.2 กรณีตัดตาม Part No. (FIFO เช่น "PL25 ตัด 8156521 1000" หรือ "8156521 ตัด 1000")
    if (!cutTargetQuery) {
        let cutPartMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s*)?(?:ตัด\s+)?([0-9]{6,8})[\s,:]+(?:ตัด[\s,:]+)?([0-9]+)(?:\s+(.+))?$/i);
        if (cutPartMatch) {
            cutInvoice = cutPartMatch[1] ? cutPartMatch[1].trim() : null;
            cutTargetQuery = cutPartMatch[2].trim();
            cutQty = parseInt(cutPartMatch[3], 10);
            cutNote = cutPartMatch[4] ? `${senderName} (${cutPartMatch[4].trim()})` : `เบิกตัดตาม Part โดย ${senderName}`;
        }
    }

    // 4.3 กรณีตัดตามมัดปกติ (เช่น "PL25 มัด 14 ตัด 320", "PL25 ตัด 14 320", "มัด 14 ตัด 320", "ตัด 14 320")
    if (!cutTargetQuery) {
        let cutMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s*)?(?:มัด|bdl)?\s*(\d+)[\s,:]+ตัด[\s,:]+(\d+)(?:\s+(.+))?$/i);
        if (cutMatch) {
            cutInvoice = cutMatch[1] ? cutMatch[1].trim() : null;
            cutTargetQuery = `มัด ${cutMatch[2].trim()}`;
            cutQty = parseInt(cutMatch[3], 10);
            cutNote = cutMatch[4] ? `${senderName} (${cutMatch[4].trim()})` : `เบิกตัดโดย ${senderName}`;
        } else {
            let cutShortMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s+)?ตัด(?:\s*มัด)?\s*(\d+)[\s,:]+(\d+)(?:\s+(.+))?$/i);
            if (cutShortMatch) {
                cutInvoice = cutShortMatch[1] ? cutShortMatch[1].trim() : null;
                cutTargetQuery = `มัด ${cutShortMatch[2].trim()}`;
                cutQty = parseInt(cutShortMatch[3], 10);
                cutNote = cutShortMatch[3] ? `${senderName} (${cutShortMatch[3].trim()})` : `เบิกตัดโดย ${senderName}`;
            }
        }
    }

    if (cutTargetQuery && (cutQty > 0 || cutAll)) {
        statusCache = null; // Clear cache on change
        const res = await callGAS({
            action: 'cut',
            query: cutTargetQuery,
            quantity: cutQty,
            cutAll: cutAll,
            invoice: cutInvoice,
            note: cutNote
        });

        if (res && res.status === 'success') {
            let replyText = '';
            if (res.isFifo && res.deductions && res.deductions.length > 1) {
                replyText = `✂️ *บันทึกตัดไม้สำเร็จ (ระบบตัดแบบ FIFO ไล่มัดแรก)*\n` +
                            `━━━━━━━━━━━━━━━━━━━\n` +
                            `🏷️ *Part Number:* ${res.item}\n` +
                            `🪵 *ขนาด:* ${res.dim}\n` +
                            `🔻 *ยอดตัดรวมรอบนี้:* -${Number(res.totalCutQty).toLocaleString()} PCS\n` +
                            `───────────────────\n` +
                            `📋 *รายละเอียดการตัดแยกมัด:*\n`;
                res.deductions.forEach(d => {
                    replyText += `• *มัด ${d.bdl}:* ตัดออก ${Number(d.cutQty).toLocaleString()} PCS (คงเหลือมัดนี้ ${Number(d.newAvail).toLocaleString()} PCS)\n`;
                });
                replyText += `───────────────────\n` +
                             `🪵 *ยอดคงเหลือ Part นี้ในคลังทั้งหมด:* *${Number(res.totalPartRemaining).toLocaleString()} PCS*\n` +
                             `👤 *หมายเหตุ:* ${res.note || '-'}\n` +
                             `━━━━━━━━━━━━━━━━━━━`;
            } else {
                replyText = `✂️ *บันทึกตัดไม้ออกสำเร็จ!*\n` +
                            `━━━━━━━━━━━━━━━━━━━\n` +
                            `🏷️ *Part:* ${res.item} (มัดที่: ${res.bdl})\n` +
                            `🪵 *ขนาด:* ${res.dim}\n` +
                            `📋 *Invoice:* ${res.plNo}\n` +
                            `🔻 *ตัดออกรอบนี้:* -${Number(res.cutQty || res.totalCutQty).toLocaleString()} PCS\n` +
                            `🪵 *คงเหลือพร้อมใช้ในคลัง:* *${Number(res.availStock).toLocaleString()} PCS*\n` +
                            `👤 *หมายเหตุ:* ${res.note || '-'}\n` +
                            `━━━━━━━━━━━━━━━━━━━`;
            }
            return sendReply(msg, replyText);
        } else {
            return sendReply(msg, res.message || '❌ ไม่สามารถตัดไม้ได้ โปรดตรวจสอบยอดสต็อก');
        }
    }

    // ====================================================
    // 5. คำสั่งบันทึกตรวจรับไม้เข้า (Receive Fast Path)
    // รูปแบบ: "PL28 มัด 12 1266", "PL25 มัด 12 200", "มัด 12 1266", "PL28 12 1266", "12 1266"
    // ====================================================
    let receiveInvoice = null;
    let targetQuery = null;
    let targetQty = 0;

    // 5.1 กรณี "PL25 มัด31 664" หรือ "PL25มัด 26 528" หรือ "มัด 12 1266"
    let receiveMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s*)?(?:มัด|bdl)\s*([0-9]+)[\s,:=]+([0-9]+)$/i);
    if (receiveMatch) {
        receiveInvoice = receiveMatch[1] ? receiveMatch[1].trim() : null;
        targetQuery = `มัด ${receiveMatch[2].trim()}`;
        targetQty = parseInt(receiveMatch[3], 10);
    } else {
        // 5.2 กรณี "8156565 1592" หรือ "PL28 8156565 1592"
        let receivePartMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s*)?([0-9]{6,8})[\s,:=]+([0-9]+)$/i);
        if (receivePartMatch) {
            receiveInvoice = receivePartMatch[1] ? receivePartMatch[1].trim() : null;
            targetQuery = receivePartMatch[2].trim();
            targetQty = parseInt(receivePartMatch[3], 10);
        } else {
            // 5.3 กรณี "PL28 12 1266" หรือ "12 1266" (เลขมัด 1-2 หลัก ตามด้วยยอด)
            let receiveShortMatch = rawText.match(/^(?:([a-zA-Z0-9_\-\/]+)\s*)?([0-9]{1,2})[\s,:=]+([0-9]{2,6})$/i);
            if (receiveShortMatch) {
                receiveInvoice = receiveShortMatch[1] ? receiveShortMatch[1].trim() : null;
                targetQuery = `มัด ${receiveShortMatch[2].trim()}`;
                targetQty = parseInt(receiveShortMatch[3], 10);
            }
        }
    }

    if (targetQuery && targetQty > 0) {
        statusCache = null; // Clear cache on change
        const res = await callGAS({ action: 'receive', query: targetQuery, quantity: targetQty, invoice: receiveInvoice });
        if (res && res.status === 'success' && res.item) {
            const item = res.item || '-';
            const bdl = res.bdl || '-';
            const dim = res.dim || '-';
            const added = Number(res.addedQty) || 0;
            const totalRec = Number(res.totalRecQty) || 0;
            const exp = Number(res.expQty) || 0;
            const bal = Number(res.balQty) || 0;
            const status = res.statusText || 'สำเร็จ';
            const plNo = res.plNo || (receiveInvoice ? receiveInvoice.toUpperCase() : 'ตู้ปัจจุบัน');

            const replyText = `✅ *บันทึกรับเข้าสำเร็จ!*\n` +
                              `━━━━━━━━━━━━━━━━━━━\n` +
                              `🏷️ *Part No.:* ${item} (มัดที่: ${bdl})\n` +
                              `🪵 *ขนาด:* ${dim}\n` +
                              `📋 *Invoice:* ${plNo}\n` +
                              `📥 *รับรอบนี้:* +${added.toLocaleString()} PCS\n` +
                              `📊 *รวมรับแล้ว:* ${totalRec.toLocaleString()} / ${exp.toLocaleString()} PCS\n` +
                              `⏳ *คงเหลือในตู้:* ${bal.toLocaleString()} PCS\n` +
                              `🎯 *สถานะ:* ${status}\n` +
                              `━━━━━━━━━━━━━━━━━━━`;
            return sendReply(msg, replyText);
        } else {
            return sendReply(msg, `❌ ${res.message || 'ไม่พบรายการที่ค้นหา'}`);
        }
    }

    // ====================================================
    // 6. คำสั่งค้นหาข้อมูลมัด/Part (Search Fast Path)
    // รูปแบบ: "มัด 24", "มัด24", "8156643", "24"
    // ====================================================
    const isSingleSearch = rawText.match(/^(?:มัด|bdl)\s*([0-9]+)$/i) || rawText.match(/^[0-9]{6,8}$/) || (rawText.match(/^[0-9]{1,2}$/) && parseInt(rawText, 10) <= 50);
    if (isSingleSearch) {
        const res = await callGAS({ action: 'search', query: rawText });
        if (res && res.status === 'success' && res.results && res.results.length > 0) {
            let searchReply = `🔍 *ข้อมูลไม้: "${rawText}"*\n` +
                              `━━━━━━━━━━━━━━━━━━━\n`;
            
            res.results.forEach((r) => {
                const exp = Number(r.expQty) || 0;
                const rec = Number(r.recQty) || 0;
                const bal = Number(r.balQty) || 0;
                const cut = Number(r.cutQty) || 0;
                const avail = Number(r.availStock) || 0;

                searchReply += `📦 *Part:* ${r.item} (มัดที่ ${r.bdl})\n` +
                               `🪵 *ขนาด:* ${r.dim}\n` +
                               `🎯 *ตามตู้:* ${exp.toLocaleString()} PCS | *รับแล้ว:* ${rec.toLocaleString()} PCS\n` +
                               `⏳ *คงเหลือในตู้ (รอรับ):* ${bal.toLocaleString()} PCS [${r.status || 'รอรับ'}]\n` +
                               `🪵 *พร้อมใช้ในคลัง:* *${avail.toLocaleString()} PCS* (ตัดแล้ว ${cut.toLocaleString()} PCS)\n` +
                               `───────────────────\n` +
                               `👉 *แตะเพื่อรับเต็มมัด:* \`มัด ${r.bdl} ${bal > 0 ? bal : exp}\`\n` +
                               `👉 *แตะเพื่อตัดไม้:* \`PL25 มัด ${r.bdl} ตัด ${avail > 0 ? avail : 100}\`\n` +
                               `───────────────────\n`;
            });

            return sendReply(msg, searchReply);
        } else {
            return sendReply(msg, `❌ ไม่พบข้อมูลสำหรับ "${rawText}" ในระบบครับ`);
        }
    }

    // ====================================================
    // 7. คำถามภาษาพูดธรรมชาติ / วิเคราะห์เชิงลึก (Gemini AI Brain)
    // เช่น: "IV นี้ เหลือ Part อะไรบ้าง และอย่างละกี่ชิ้น", "มัด 1 ถึง 5 มีมัดไหนยังไม่ได้รับบ้าง"
    // ====================================================
    if (rawText.length >= 3) {
        console.log(`🧠 ส่งให้ Gemini AI วิเคราะห์: "${rawText}"`);
        const geminiReply = await askGemini(rawText);
        if (geminiReply) {
            return sendReply(msg, geminiReply);
        } else {
            return sendReply(msg, `ขออภัยครับ ระบบ AI กำลังพักชั่วคราว (Rate limit) โปรดพิมพ์คำสั่งลัด เช่น "สรุป" หรือ "ค้างรับ" ได้ครับ`);
        }
    }
}

// Listen to message_create to catch user messages in all contexts
client.on('message_create', processMessage);

client.initialize();
