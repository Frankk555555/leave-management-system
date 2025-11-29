import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadUserFromToken = () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedUser = jwtDecode(token);
                // (ในระบบจริง ควร /api/auth/me เพื่อดึงข้อมูล user ที่อัปเดต)
                // แต่เพื่อความง่าย เราจะใช้ข้อมูลจาก token ที่ได้ตอน login
                const storedUser = JSON.parse(localStorage.getItem('user'));
                
                if (storedUser) {
                    setUser(storedUser);
                } else {
                    // Fallback ถ้าไม่มี user ใน localStorage
                    setUser({ role: decodedUser.role, id: decodedUser.id });
                }
            } catch (e) {
                console.error("Invalid token");
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        loadUserFromToken();
    }, []);

    const login = async (username, password) => {
        try {
            const { data } = await api.post('/auth/login', { username, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user)); // เก็บ object user
            setUser(data.user);
        } catch (error) {
            console.error("Login failed:", error.response?.data?.message);
            throw error; // ส่ง error ต่อให้ component ที่เรียก
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);