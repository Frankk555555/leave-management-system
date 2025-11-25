// backend/src/utils/telegramNotifyHelper.js
import axios from 'axios';
import dotenv from 'dotenv';
import FormData from 'form-data'; // (ต้อง install เพิ่ม)
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * ส่งแจ้งเตือน Telegram (รองรับไฟล์แนบ)
 * @param {string} message - ข้อความ (HTML format)
 * @param {string|null} filePath - (Optional) ที่อยู่ไฟล์บนเครื่อง เช่น 'uploads/file.jpg'
 */
export const sendTelegramNotify = async (message, filePath = null) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn("Telegram Config missing in .env");
        return;
    }

    try {
        // กรณีที่ 1: มีไฟล์แนบ -> ส่งรูปหรือเอกสารพร้อม Caption
        if (filePath && fs.existsSync(filePath)) {
            const form = new FormData();
            form.append('chat_id', chatId);
            form.append('caption', message); // ข้อความจะไปอยู่ใน caption แทน
            form.append('parse_mode', 'HTML');

            const ext = path.extname(filePath).toLowerCase();
            const fileStream = fs.createReadStream(filePath);

            let endpoint = 'sendDocument'; // ค่า Default เป็นส่งไฟล์
            
            // ถ้าเป็นรูปภาพ ให้ใช้ sendPhoto
            if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                endpoint = 'sendPhoto';
                form.append('photo', fileStream);
            } else {
                // ถ้าเป็น PDF หรืออื่นๆ ใช้ sendDocument
                form.append('document', fileStream);
            }

            // ส่ง Request แบบ Multipart
            await axios.post(`https://api.telegram.org/bot${token}/${endpoint}`, form, {
                headers: form.getHeaders()
            });

        } else {
            // กรณีที่ 2: ไม่มีไฟล์ -> ส่งข้อความปกติ
            await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
        }

        console.log('Telegram Notification sent (with file check)');

    } catch (error) {
        console.error('Failed to send Telegram Notify:', error.response?.data || error.message);
    }
};