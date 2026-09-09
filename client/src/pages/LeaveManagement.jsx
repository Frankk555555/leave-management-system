import React, { useState, useEffect } from "react";
import Loading from "../components/common/Loading";
import { useToast } from "../components/common/Toast";
import { previewLeavePDF } from "../utils/generateLeavePDF";
import { getLeaveTypeName, getLeaveTypeCode } from "../utils/leaveTypeUtils";
import config from "../config";
import api, { leaveRequestsAPI } from "../services/api";
import {
  FaCheck,
  FaClock,
  FaUser,
  FaCalendarAlt,
  FaFileAlt,
  FaSearch,
  FaFilter,
  FaTimes,
  FaEye,
  FaSpinner,
} from "react-icons/fa";
import SEO, { SEOConfig } from "../components/common/SEO";
import useCollectionQuery from "../hooks/useCollectionQuery";
import "./LeaveManagement.css";

const API_URL = config.API_URL;

const LeaveManagement = () => {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const {
    items: filteredRequests,
    stats,
    search: searchTerm,
    setSearch: setSearchTerm,
    filters,
    setFilter,
  } = useCollectionQuery(requests, {
    searchFields: [
      (r) => `${r.user?.firstName || ""} ${r.user?.lastName || ""}`,
      "user.employeeId",
      "user.department.name",
    ],
    initialFilters: { status: "approved" },
    statsConfig: {
      pending: (r) => r.status === "approved",
      confirmed: (r) => r.status === "confirmed",
    },
  });

  const filter = filters.status || "all";

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await leaveRequestsAPI.getAll();
      setRequests(response.data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClick = (request) => {
    setSelectedRequest(request);
    setConfirmNote("");
    setShowModal(true);
  };

  const handleConfirm = async () => {
    if (!selectedRequest) return;

    try {
      setConfirmingId(selectedRequest.id);
      const response = await api.put(`/leave-requests/${selectedRequest.id}/confirm`, { note: confirmNote });
      
      if (response.status !== 200 && response.status !== 201) {
        throw new Error("ไม่สามารถยืนยันการลาได้");
      }

      toast.success("ยืนยันการลงข้อมูลเรียบร้อยแล้ว");
      setShowModal(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setConfirmingId(null);
    }
  };

  const handlePreview = async (request) => {
    try {
      setPreviewingId(request.id);
      // คำนวณสถิติการลาก่อนหน้าของ user คนนี้ (confirmed leaves only)
      const userConfirmedRequests = requests.filter(
        (r) =>
          r.status === "confirmed" &&
          r.id !== request.id &&
          r.userId === request.userId,
      );

      const leaveStats = {
        sick: { used: 0 },
        personal: { used: 0 },
        vacation: { used: 0 },
        maternity: { used: 0 },
        paternity: { used: 0 },
        childcare: { used: 0 },
        ordination: { used: 0 },
        military: { used: 0 },
      };

      // รวมจำนวนวันลาที่ผ่านมา
      userConfirmedRequests.forEach((r) => {
        const code = getLeaveTypeCode(r.leaveType);
        if (leaveStats[code]) {
          leaveStats[code].used += parseFloat(r.totalDays) || 0;
        }
      });

      // Prepare leave data
      const leaveData = {
        ...request,
        leaveType: getLeaveTypeCode(request.leaveType),
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: request.totalDays,
        reason: request.reason || "",
        contactAddress: request.contactAddress || "",
        contactPhone: request.contactPhone || "",
        leaveStats: leaveStats,
        createdAt: request.createdAt,
      };

      // Prepare user data
      const userData = {
        title: request.user?.title || "",
        firstName: request.user?.firstName || "",
        lastName: request.user?.lastName || "",
        position: request.user?.position || "",
        department: request.user?.department || "",
        unit: request.user?.unit || "",
        affiliation: request.user?.affiliation || "",
        phone: request.user?.phone || "",
        documentNumber: request.user?.documentNumber || "",
        signatureImage: request.user?.signatureImage || "",
      };

      await previewLeavePDF(leaveData, userData);
    } catch (error) {
      console.error("Preview error:", error);
      toast.error("ไม่สามารถสร้างตัวอย่างใบลาได้");
    } finally {
      setPreviewingId(null);
    }
  };

  // getLeaveTypeName imported from utils/leaveTypeUtils

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return <span className="status-badge pending">รอหัวหน้างาน</span>;
      case "pending_dean":
        return <span className="status-badge pending-dean">รอคณบดี/ผอ.สำนัก</span>;
      case "pending_vp":
        return <span className="status-badge pending-vp">รอรองอธิการบดี</span>;
      case "approved":
        return <span className="status-badge approved">รอลงข้อมูล</span>;
      case "confirmed":
        return <span className="status-badge confirmed">ลงข้อมูลแล้ว</span>;
      case "rejected":
        return <span className="status-badge rejected">ไม่อนุมัติ</span>;
      case "cancelled":
        return <span className="status-badge cancelled">ยกเลิก</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.leaveManagement} />
        <Loading size="fullpage" text="กำลังโหลดข้อมูล..." />
      </>
    );
  }

  return (
    <>
      <SEO {...SEOConfig.leaveManagement} />
      <div className="leave-management-page">
        <div className="page-header">
          <div>
            <h1>จัดการใบลา</h1>
            <p>ตรวจสอบและยืนยันการลงข้อมูลในระบบมหาวิทยาลัย</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card pending">
            <div className="stat-icon">
              <FaClock />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.pending}</span>
              <span className="stat-label">รอดำเนินการ</span>
            </div>
          </div>
          <div className="stat-card confirmed">
            <div className="stat-icon">
              <FaCheck />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.confirmed}</span>
              <span className="stat-label">ลงข้อมูลแล้ว</span>
            </div>
          </div>
          <div className="stat-card total">
            <div className="stat-icon">
              <FaFileAlt />
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.total}</span>
              <span className="stat-label">ใบลาทั้งหมด</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-container">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-buttons">
            <button
              className={`filter-btn ${filter === "approved" ? "active" : ""}`}
              onClick={() => setFilter("status", "approved")}
            >
              <FaClock /> รอลงข้อมูล ({stats.pending})
            </button>
            <button
              className={`filter-btn ${filter === "confirmed" ? "active" : ""}`}
              onClick={() => setFilter("status", "confirmed")}
            >
              <FaCheck /> ลงข้อมูลแล้ว ({stats.confirmed})
            </button>
            <button
              className={`filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("status", "all")}
            >
              <FaFilter /> ทั้งหมด ({stats.total})
            </button>
          </div>
        </div>

        {/* Request List */}
        {filteredRequests.length === 0 ? (
          <div className="empty-state">
            <FaFileAlt className="empty-icon" />
            <h3>ไม่พบข้อมูล</h3>
            <p>ไม่มีใบลาที่ตรงกับเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="requests-table-container">
            <table className="requests-table">
              <thead>
                <tr>
                  <th>ผู้ลา</th>
                  <th>ประเภท</th>
                  <th>วันที่ลา</th>
                  <th>จำนวน</th>
                  <th>สถานะ</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div className="user-cell">
                        <FaUser className="user-icon" />
                        <div>
                          <div className="user-name">
                            {request.user?.firstName} {request.user?.lastName}
                          </div>
                          <div className="user-dept">
                            {request.user?.department?.name || "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{getLeaveTypeName(request.leaveType)}</td>
                    <td>
                      <div className="date-cell">
                        <FaCalendarAlt className="date-icon" />
                        {formatDate(request.startDate)} -{" "}
                        {formatDate(request.endDate)}
                      </div>
                    </td>
                    <td className="days-cell">{request.totalDays} วัน</td>
                    <td>{getStatusBadge(request.status)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className={`preview-btn ${previewingId === request.id ? "loading" : ""}`}
                          onClick={() => handlePreview(request)}
                          disabled={previewingId === request.id}
                          title="ดูตัวอย่างใบลา"
                          aria-label="ดูตัวอย่างใบลา"
                        >
                          {previewingId === request.id ? (
                            <FaSpinner className="btn-spinner" />
                          ) : (
                            <FaEye className="preview-icon" />
                          )}
                        </button>
                        {request.status === "approved" ? (
                          <button
                            className="confirm-btn"
                            onClick={() => handleConfirmClick(request)}
                            disabled={confirmingId === request.id}
                          >
                            <FaCheck />
                            {confirmingId === request.id
                              ? "กำลังยืนยัน..."
                              : "ยืนยัน"}
                          </button>
                        ) : (
                          <span className="confirmed-text">
                            {request.status === "confirmed"
                              ? "✓ ดำเนินการแล้ว"
                              : request.status === "rejected"
                                ? "✗ ปฏิเสธแล้ว"
                                : request.status === "pending_dean"
                                  ? "รอคณบดี/ผอ."
                                  : request.status === "pending_vp"
                                    ? "รอรองอธิการบดี"
                                    : "รอหัวหน้างาน"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards Layout */}
            <div className="requests-cards-mobile">
              {filteredRequests.map((request) => (
                <div className="request-card-mobile" key={request.id}>
                  <div className="card-header">
                    <div className="user-info">
                      <div className="user-avatar">
                        <FaUser className="user-icon" />
                      </div>
                      <div>
                        <div className="user-name">
                          {request.user?.firstName} {request.user?.lastName}
                        </div>
                        <div className="user-dept">
                          {request.user?.department?.name || "-"}
                        </div>
                      </div>
                    </div>
                    <div className="status-badge-container">
                      {getStatusBadge(request.status)}
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="info-row">
                      <span className="info-label">ประเภท:</span>
                      <span className="info-value leave-type">
                        {getLeaveTypeName(request.leaveType)}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">วันที่ลา:</span>
                      <span className="info-value leave-dates">
                        <FaCalendarAlt className="date-icon" />{" "}
                        {formatDate(request.startDate)} -{" "}
                        {formatDate(request.endDate)}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">จำนวน:</span>
                      <span className="info-value leave-days">
                        {request.totalDays} วัน
                      </span>
                    </div>
                  </div>

                  <div className="card-footer">
                    <button
                      className={`preview-btn-mobile ${previewingId === request.id ? "loading" : ""}`}
                      onClick={() => handlePreview(request)}
                      disabled={previewingId === request.id}
                      title="ดูตัวอย่างใบลา"
                      aria-label="ดูตัวอย่างใบลา"
                    >
                      {previewingId === request.id ? (
                        <>
                          <FaSpinner className="btn-spinner" /> กำลังเปิด...
                        </>
                      ) : (
                        <>
                          <FaEye className="preview-icon" /> ดูตัวอย่าง
                        </>
                      )}
                    </button>
                    {request.status === "approved" ? (
                      <button
                        className="confirm-btn-mobile"
                        onClick={() => handleConfirmClick(request)}
                        disabled={confirmingId === request.id}
                      >
                        <FaCheck />
                        {confirmingId === request.id ? "กำลังยืนยัน..." : "ยืนยัน"}
                      </button>
                    ) : (
                      <span className="confirmed-text-mobile">
                        {request.status === "confirmed"
                          ? "✓ ดำเนินการแล้ว"
                          : request.status === "rejected"
                            ? "✗ ปฏิเสธแล้ว"
                            : request.status === "pending_dean"
                              ? "รอคณบดี/ผอ."
                              : request.status === "pending_vp"
                                ? "รอรองอธิการบดี"
                                : "รอหัวหน้างาน"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Confirm Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                <FaTimes />
              </button>
              <h2>ยืนยันการลงข้อมูล</h2>
              {selectedRequest && (
                <div className="modal-info">
                  <p>
                    <strong>ผู้ลา:</strong> {selectedRequest.user?.firstName}{" "}
                    {selectedRequest.user?.lastName}
                  </p>
                  <p>
                    <strong>ประเภท:</strong>{" "}
                    {getLeaveTypeName(selectedRequest.leaveType)}
                  </p>
                  <p>
                    <strong>วันที่:</strong>{" "}
                    {formatDate(selectedRequest.startDate)} -{" "}
                    {formatDate(selectedRequest.endDate)} (
                    {selectedRequest.totalDays} วัน)
                  </p>
                </div>
              )}
              <div className="form-group">
                <label>หมายเหตุ (ไม่บังคับ)</label>
                <textarea
                  value={confirmNote}
                  onChange={(e) => setConfirmNote(e.target.value)}
                  placeholder="ระบุหมายเหตุเพิ่มเติม..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn-confirm"
                  onClick={handleConfirm}
                  disabled={confirmingId}
                >
                  <FaCheck /> ยืนยันการลงข้อมูล
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LeaveManagement;
