import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "./NotificationBell";
import "./Sidebar.css";

// React Icons
import {
  FaChartBar,
  FaEdit,
  FaClipboardList,
  FaClipboardCheck,
  FaCalendarAlt,
  FaUsers,
  FaCog,
  FaFileAlt,
  FaUsersCog,
  FaCalendarCheck,
  FaSignOutAlt,
  FaBookOpen,
  FaUser,
  FaChevronDown,
  FaTimes,
} from "react-icons/fa";

const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, isAdmin, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    if (onClose) onClose();
  };

  const toggleAdminDropdown = (e) => {
    e.preventDefault();
    setAdminDropdownOpen(!adminDropdownOpen);
  };

  return (
    <>
      {/* Overlay for mobile view when sidebar is open */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Sidebar Header / Brand */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img
              src="/bru-logo-color.png"
              alt="BRU Logo"
              className="sidebar-logo"
            />
            <div className="brand-text">
              <h2>ระบบบริหารการลา</h2>
              <span>BRU Leave System Management</span>
            </div>
          </div>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
            <FaTimes />
          </button>
        </div>

        {/* Sidebar Navigation Menu */}
        <nav className="sidebar-menu">
          {isAdmin ? (
            /* ========================================================
               ADMIN NAVIGATION MENU
               1. หน้าหลัก
               2. อนุมัติการลา
               3. จัดการใบลา
               4. ปฏิทินการลา
               5. ดาวน์โหลดแบบฟอร์ม
               6. ระเบียบการลา
               + จัดการระบบ (Dropdown)
               ======================================================== */
            <>
              {/* 1. หน้าหลัก */}
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaChartBar className="sidebar-icon" /> <span>หน้าหลัก</span>
              </NavLink>

              {/* 2. อนุมัติการลา */}
              <NavLink
                to="/approvals"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaClipboardCheck className="sidebar-icon" /> <span>อนุมัติการลา</span>
              </NavLink>

              {/* 3. จัดการใบลา */}
              <NavLink
                to="/admin/leaves"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaClipboardList className="sidebar-icon" /> <span>จัดการใบลา</span>
              </NavLink>

              {/* 4. ปฏิทินการลา */}
              <NavLink
                to="/calendar"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaCalendarAlt className="sidebar-icon" /> <span>ปฏิทินการลา</span>
              </NavLink>

              {/* 5. ดาวน์โหลดแบบฟอร์ม */}
              <NavLink
                to="/forms"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaFileAlt className="sidebar-icon" /> <span>ดาวน์โหลดแบบฟอร์ม</span>
              </NavLink>

              {/* 6. ระเบียบการลา */}
              <NavLink
                to="/regulations"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaBookOpen className="sidebar-icon" /> <span>ระเบียบการลา</span>
              </NavLink>

              {/* จัดการระบบ (Admin Accordion Dropdown) */}
              <div className={`sidebar-dropdown ${adminDropdownOpen ? "open" : ""}`}>
                <button
                  className="sidebar-link dropdown-toggle-btn"
                  onClick={toggleAdminDropdown}
                >
                  <div className="dropdown-title-group">
                    <FaCog className="sidebar-icon" /> <span>จัดการระบบ</span>
                  </div>
                  <FaChevronDown className="arrow-icon" />
                </button>
                
                <div className="sidebar-dropdown-menu">
                  <NavLink
                    to="/reports"
                    className={({ isActive }) =>
                      isActive ? "sidebar-sub-link active" : "sidebar-sub-link"
                    }
                    onClick={onClose}
                  >
                    <FaChartBar className="sidebar-icon" /> <span>รายงานการลา</span>
                  </NavLink>
                  <NavLink
                    to="/users"
                    className={({ isActive }) =>
                      isActive ? "sidebar-sub-link active" : "sidebar-sub-link"
                    }
                    onClick={onClose}
                  >
                    <FaUsersCog className="sidebar-icon" /> <span>จัดการบุคลากร</span>
                  </NavLink>
                  <NavLink
                    to="/leave-types"
                    className={({ isActive }) =>
                      isActive ? "sidebar-sub-link active" : "sidebar-sub-link"
                    }
                    onClick={onClose}
                  >
                    <FaFileAlt className="sidebar-icon" /> <span>ประเภทการลา</span>
                  </NavLink>
                  <NavLink
                    to="/holidays"
                    className={({ isActive }) =>
                      isActive ? "sidebar-sub-link active" : "sidebar-sub-link"
                    }
                    onClick={onClose}
                  >
                    <FaCalendarCheck className="sidebar-icon" /> <span>จัดการวันหยุด</span>
                  </NavLink>
                </div>
              </div>
            </>
          ) : (
            /* ========================================================
               USER / HEAD NAVIGATION MENU
               ======================================================== */
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaChartBar className="sidebar-icon" /> <span>หน้าหลัก</span>
              </NavLink>

              <NavLink
                to="/leave-request"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaEdit className="sidebar-icon" /> <span>ยื่นลา</span>
              </NavLink>

              <NavLink
                to="/leave-history"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaClipboardList className="sidebar-icon" /> <span>ประวัติการลา</span>
              </NavLink>

              <NavLink
                to="/calendar"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaCalendarAlt className="sidebar-icon" /> <span>ปฏิทินการลา</span>
              </NavLink>

              <NavLink
                to="/team-calendar"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaUsers className="sidebar-icon" /> <span>วันลาทีม</span>
              </NavLink>

              <NavLink
                to="/forms"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaFileAlt className="sidebar-icon" /> <span>ดาวน์โหลดแบบฟอร์ม</span>
              </NavLink>

              {isSupervisor && (
                <NavLink
                  to="/approvals"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                  onClick={onClose}
                >
                  <FaClipboardCheck className="sidebar-icon" /> <span>อนุมัติการลา</span>
                </NavLink>
              )}

              <NavLink
                to="/regulations"
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                onClick={onClose}
              >
                <FaBookOpen className="sidebar-icon" /> <span>ระเบียบการลา</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user-row">
            <NavLink to="/profile" className="sidebar-profile-link" onClick={onClose}>
              <div className="user-avatar">
                <FaUser />
              </div>
              <div className="user-metadata">
                <span className="user-display-name">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="user-display-role">
                  {user?.role === "admin"
                    ? "ผู้ดูแลระบบ"
                    : user?.role === "supervisor" || user?.role === "head"
                      ? "หัวหน้างาน"
                      : "บุคลากร"}
                </span>
              </div>
            </NavLink>
            <div className="sidebar-bell-wrapper">
              <NotificationBell />
            </div>
          </div>

          <button onClick={handleLogout} className="sidebar-logout-btn">
            <FaSignOutAlt className="sidebar-logout-icon" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
