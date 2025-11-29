import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // --- เพิ่มส่วนนี้สำหรับ Aiven/Cloud Database ---
    ssl: {
        rejectUnauthorized: false // อนุญาตให้เชื่อมต่อแบบ SSL (จำเป็นสำหรับ Aiven)
    }
    // ------------------------------------------
});

// Test Connection (เช็กดูว่าต่อติดไหม)
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully');
        connection.release();
    })
    .catch(error => {
        console.error('❌ Database connection failed:', error.message);
    });

export default pool;