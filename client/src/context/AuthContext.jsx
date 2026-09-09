import React from "react";
import { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";
import Loading from "../components/common/Loading";
import queryClient from "../config/queryClient";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      // Auth failed or cookie expired/missing
      localStorage.removeItem("token"); // Cleanup legacy tokens
      setUser(null);
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const userData = response.data;
    if (userData.token) {
      localStorage.setItem("token", userData.token);
    }
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error("Logout API failed:", err);
    }
    localStorage.removeItem("token");
    queryClient.clear();
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  };

  const refreshUser = async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data);
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isHead: user?.role === "head",
    isDean: user?.role === "dean",
    isVP: user?.role === "vp",
    isSupervisor:
      user?.role === "head" ||
      user?.role === "dean" ||
      user?.role === "vp" ||
      user?.role === "admin",
  };

  if (loading) {
    return <Loading size="fullpage" text="กำลังโหลด..." />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
