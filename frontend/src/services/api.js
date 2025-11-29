import axios from 'axios';

const api = axios.create({
    // ถ้ามีค่าใน Env (บน Vercel) ให้ใช้ค่านั้น ถ้าไม่มี (ในเครื่องเรา) ให้ใช้ localhost
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Interceptor เพื่อแนบ Token ไปกับทุก Request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;