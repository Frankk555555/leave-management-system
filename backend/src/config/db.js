import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// --- เพิ่มส่วนนี้เพื่อเช็กค่าที่ Backend อ่านได้ ---
console.log("🔍 Checking DB Config...");
console.log("DB_HOST:", process.env.DB_HOST); // ดูว่า Host ถูกไหม
console.log("DB_PORT:", process.env.DB_PORT); // ดูว่า Port เป็นเลขอะไร (ต้องไม่ใช่ 3306)
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);
// ------------------------------------------

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

// ... (ส่วน Test Connection ด้านล่างเหมือนเดิม)
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully');
        connection.release();
    })
    .catch(error => {
        console.error('❌ Database connection failed:', error.message);
    });

export default pool;