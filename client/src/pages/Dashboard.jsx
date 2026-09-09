import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMyLeaveRequests } from "../hooks/queries/useLeaveRequests";
import SEO, { SEOConfig } from "../components/common/SEO";
import Loading from "../components/common/Loading";
import { getLeaveTypeName, getLeaveTypeIcon } from "../utils/leaveTypeUtils";
import "./Dashboard.css";
import React from "react";

// React Icons
import {
  FaChartBar,
  FaBullseye,
  FaHospital,
  FaClipboardList,
  FaUmbrellaBeach,
  FaHandPaper,
} from "react-icons/fa";

const LEAVE_COLORS = {
  sick: { color: "#059669", bg: "rgba(5, 150, 105, 0.1)" },
  personal: { color: "#6366f1", bg: "rgba(99, 102, 241, 0.1)" },
  vacation: { color: "#d97706", bg: "rgba(217, 119, 6, 0.1)" },
  maternity: { color: "#ec4899", bg: "rgba(236, 72, 153, 0.1)" },
  paternity: { color: "#0891b2", bg: "rgba(8, 145, 178, 0.1)" },
  childcare: { color: "#14b8a6", bg: "rgba(20, 184, 166, 0.1)" },
  ordination: { color: "#ea580c", bg: "rgba(234, 88, 12, 0.1)" },
  military: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
};

const DEFAULT_LEAVE_COLOR = { color: "#4a5568", bg: "rgba(74, 85, 104, 0.1)" };

const Dashboard = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // React Query Hook
  const { data: requests = [], isLoading: loading } = useMyLeaveRequests();

  const totalRequests = requests.length;
  const recentRequests = requests.slice(0, 5);

  // Refresh user data (leave balances) on mount
  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcut: Press 'N' to navigate to new leave request form
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        navigate("/leave-request");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.dashboard} />
        <Loading size="fullpage" />
      </>
    );
  }

  const getRemainingBalance = (code) => {
    if (!user?.leaveBalances || !Array.isArray(user.leaveBalances)) return 0;
    const balance = user.leaveBalances.find(b => b.leaveType?.code === code);
    if (!balance) return 0;
    return parseFloat(balance.totalDays || 0) + parseFloat(balance.carriedOverDays || 0) - parseFloat(balance.usedDays || 0);
  };

  return (
    <>
      <SEO {...SEOConfig.dashboard} />
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="header-info">
            <h1>
              สวัสดี, คุณ {user?.firstName} {user?.lastName}{" "}
              <FaHandPaper className="waving-hand" />
            </h1>
            <p>ยินดีต้อนรับเข้าสู่ระบบบริหารการลามหาวิทยาลัยราชภัฏบุรีรัมย์</p>
          </div>
          {user?.role !== "admin" && (
            <Link to="/leave-request" className="add-btn">
              ยื่นใบลาใหม่
            </Link>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{
                background: "rgba(102, 126, 234, 0.1)",
                color: "#667eea",
              }}
            >
              <FaChartBar />
            </div>
            <div className="stat-info">
              <h3>{totalRequests}</h3>
              <p>บันทึกการลาทั้งหมด</p>
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-icon"
              style={{
                background: "rgba(5, 150, 105, 0.1)",
                color: "#059669",
              }}
            >
              <FaHospital />
            </div>
            <div className="stat-info">
              <h3>{getRemainingBalance("sick")}</h3>
              <p>วันลาป่วยคงเหลือ</p>
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-icon"
              style={{
                background: "rgba(99, 102, 241, 0.1)",
                color: "#6366f1",
              }}
            >
              <FaClipboardList />
            </div>
            <div className="stat-info">
              <h3>{getRemainingBalance("personal")}</h3>
              <p>วันลากิจคงเหลือ</p>
            </div>
          </div>

          <div className="stat-card">
            <div
              className="stat-icon"
              style={{
                background: "rgba(245, 158, 11, 0.1)",
                color: "#d97706",
              }}
            >
              <FaUmbrellaBeach />
            </div>
            <div className="stat-info">
              <h3>{getRemainingBalance("vacation")}</h3>
              <p>วันลาพักผ่อนคงเหลือ</p>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div className="leave-balance-card">
            <h2>
              <FaBullseye style={{ marginRight: "0.5rem" }} /> ยอดวันลาคงเหลือ
            </h2>
            <div className="balance-grid">
              {user?.leaveBalances && Array.isArray(user.leaveBalances) && user.leaveBalances.length > 0 ? (
                user.leaveBalances.map((balance) => {
                  const code = balance.leaveType?.code;
                  const name = getLeaveTypeName(balance.leaveType);
                  const total = parseFloat(balance.totalDays || 0) + parseFloat(balance.carriedOverDays || 0);
                  const remaining = total - parseFloat(balance.usedDays || 0);
                  const percent = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
                  const { color, bg } = LEAVE_COLORS[code] || DEFAULT_LEAVE_COLOR;

                  return (
                    <div key={balance.id || balance._id || code} className="balance-item">
                      <div className="balance-icon" style={{ background: bg, color: color }}>
                        {getLeaveTypeIcon(balance.leaveType)}
                      </div>
                      <div className="balance-info">
                        <h4>{name}</h4>
                      </div>
                      <div className="balance-days">
                        <span className={`balance-number ${remaining <= 0 ? "exhausted" : ""}`}>
                          {remaining}
                        </span>{" "}
                        วัน
                      </div>
                      <div className="balance-bar">
                        <div
                          className="balance-progress"
                          style={{
                            width: `${percent}%`,
                            background: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="no-data">ไม่พบข้อมูลยอดวันลา</p>
              )}
            </div>
          </div>

          <div className="recent-requests-card">
            <h2>
              <FaClipboardList style={{ marginRight: "0.5rem" }} /> บันทึกล่าสุด
            </h2>
            {recentRequests.length === 0 ? (
              <p className="no-data">ยังไม่มีบันทึกการลา</p>
            ) : (
              <div className="requests-list">
                {recentRequests.map((request) => (
                  <Link
                    key={request.id || request._id}
                    to="/leave-history"
                    className="request-item"
                  >
                    <div className="request-type">
                      {getLeaveTypeIcon(request.leaveType)}
                    </div>
                    <div className="request-info">
                      <h4>{getLeaveTypeName(request.leaveType)}</h4>
                      <p>
                        {formatDate(request.startDate)} -{" "}
                        {formatDate(request.endDate)}
                      </p>
                    </div>
                    <span className={`status-badge ${request.status || "pending"}`}>
                      {request.status === "pending"
                        ? "รอหัวหน้างาน"
                        : request.status === "pending_dean"
                          ? "รอคณบดี/ผอ.สำนัก"
                          : request.status === "pending_vp"
                            ? "รอรองอธิการบดี"
                            : request.status === "approved"
                              ? "รอลงข้อมูล"
                              : request.status === "confirmed"
                                ? "ลงข้อมูลแล้ว"
                                : request.status === "rejected"
                                  ? "ไม่อนุมัติ"
                                  : request.status === "cancelled"
                                    ? "ยกเลิก"
                                    : request.status}
                    </span>
                    <div className="request-days">{request.totalDays} วัน</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;

