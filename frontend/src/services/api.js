import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api', // URL ของ Backend
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