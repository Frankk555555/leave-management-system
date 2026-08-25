import React, { useState } from "react";
import { useMyLeaveRequests, useCancelLeaveRequest } from "../hooks/queries/useLeaveRequests";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/common/Toast";
import Loading from "../components/common/Loading";
import generateLeavePDF, { previewLeavePDF } from "../utils/generateLeavePDF";
import { getLeaveTypeName, getLeaveTypeIcon, getLeaveTypeCode } from "../utils/leaveTypeUtils";
import config from "../config";
import SEO, { SEOConfig } from "../components/common/SEO";
import "./LeaveHistory.css";

// React Icons
import {
  FaFileAlt,
  FaPaperclip,
  FaFilePdf,
  FaEye,
  FaTimesCircle,
  FaSpinner,
  FaTimes,
  FaCheckCircle,
} from "react-icons/fa";

const LeaveHistory = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: requests = [], isLoading: loading } = useMyLeaveRequests();
  const cancelMutation = useCancelLeaveRequest();
  const [downloadingId, setDownloadingId] = useState(null);
  const [cancelModal, setCancelModal] = useState({ isOpen: false, request: null, reason: "" });

  // ดาวน์โหลดใบลา PDF
  const handleDownloadPDF = async (request) => {
    setDownloadingId(request.id || request._id);
    try {
      // คำนวณสถิติการลาก่อนหน้า (confirmed leaves only)
    const confirmedRequests = requests.filter(
      (r) => r.status === "confirmed" && r.id !== request.id,
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
    confirmedRequests.forEach((r) => {
      const code = getLeaveTypeCode(r.leaveType);
      if (leaveStats[code]) {
        leaveStats[code].used += parseFloat(r.totalDays) || 0;
      }
    });

    const leaveData = {
      leaveType: getLeaveTypeCode(request.leaveType),
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      totalDays: request.totalDays,
      contactAddress: request.contactAddress || "",
      contactPhone: request.contactPhone || "",
      leaveStats: leaveStats,
      createdAt: request.createdAt,
    };
    await generateLeavePDF(leaveData, user);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  // ดูตัวอย่างใบลา PDF (เปิดแท็บใหม่)
  const handlePreviewPDF = async (request) => {
    setDownloadingId(`preview_${request.id || request._id}`);
    try {
      const confirmedRequests = requests.filter(
      (r) => r.status === "confirmed" && r.id !== request.id,
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

    confirmedRequests.forEach((r) => {
      const code = getLeaveTypeCode(r.leaveType);
      if (leaveStats[code]) {
        leaveStats[code].used += parseFloat(r.totalDays) || 0;
      }
    });

    const leaveData = {
      leaveType: getLeaveTypeCode(request.leaveType),
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      totalDays: request.totalDays,
      contactAddress: request.contactAddress || "",
      contactPhone: request.contactPhone || "",
      leaveStats: leaveStats,
      createdAt: request.createdAt,
    };
    await previewLeavePDF(leaveData, user);
    } catch (error) {
      console.error("Error previewing PDF:", error);
      toast.error("เกิดข้อผิดพลาดในการเปิดดู PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancelClick = (request) => {
    setCancelModal({ isOpen: true, request, reason: "" });
  };

  const submitCancel = async () => {
    const { request, reason } = cancelModal;
    if (!request) return;

    try {
      await cancelMutation.mutateAsync({ id: request.id || request._id, reason });
      toast.success("ยกเลิกใบลาเรียบร้อยแล้ว");
      
      // Trigger notification refresh
      window.dispatchEvent(new Event("refreshNotifications"));
      setCancelModal({ isOpen: false, request: null, reason: "" });
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการยกเลิก");
    }
  };

  // เปิดไฟล์แนบในหน้าต่างใหม่
  const handlePreview = (fileUrl) => {
    if (!fileUrl) return;

    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      window.open(fileUrl, "_blank");
      return;
    }

    // กรณีเก่า: path ในเครื่อง ให้ต่อด้วย Server URL
    let normalizedPath = fileUrl.replace(/\\/g, "/");
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = "/" + normalizedPath;
    }
    window.open(`${config.API_URL}${normalizedPath}`, "_blank");
  };


  // getLeaveTypeName, getLeaveTypeIcon imported from utils/leaveTypeUtils

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.leaveHistory} />
        <Loading size="fullpage" text="กำลังโหลด..." />
      </>
    );
  }

  return (
    <>
      <SEO {...SEOConfig.leaveHistory} />
      <div className="leave-history-page">
        <div className="page-header">
          <div>
            <h1>ประวัติการลา</h1>
            <p>รายการบันทึกการลาทั้งหมดของคุณ</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📭</span>
            <h3>ไม่มีข้อมูลการลา</h3>
            <p>ยังไม่มีบันทึกการลา</p>
          </div>
        ) : (
          <div className="history-grid">
            {requests.map((request) => (
              <div key={request.id || request._id} className="history-card">
                <div className="card-header">
                  <div className="leave-type-info">
                    <span className="type-icon">
                      {getLeaveTypeIcon(request.leaveType)}
                    </span>
                    <span className="type-name">
                      {getLeaveTypeName(request.leaveType)}
                    </span>
                  </div>
                  <div className="header-badges">
                    <div className="days-badge">{request.totalDays} วัน</div>
                    <span className={`status-badge ${request.status}`}>
                      {request.status === "pending"
                        ? "รออนุมัติ"
                        : request.status === "approved"
                          ? "รอลงข้อมูล"
                          : request.status === "confirmed"
                            ? "✓ ลงข้อมูลแล้ว"
                            : request.status === "rejected"
                              ? "ไม่อนุมัติ"
                              : request.status === "cancelled"
                                ? "ยกเลิก"
                                : request.status}
                    </span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="date-range-display">
                    <div className="date-item">
                      <span className="date-label">เริ่มต้น</span>
                      <span className="date-value">
                        {formatDate(request.startDate)}
                      </span>
                    </div>
                    <div className="date-arrow">→</div>
                    <div className="date-item">
                      <span className="date-label">สิ้นสุด</span>
                      <span className="date-value">
                        {formatDate(request.endDate)}
                        {(request.timeSlot === "morning" ||
                          request.timeSlot === "afternoon") && (
                          <span className="time-slot-badge">
                            ({request.timeSlot === "morning" ? "เช้า" : "บ่าย"})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="reason-section">
                    <span className="reason-label">เหตุผล:</span>
                    <p className="reason-text">{request.reason}</p>
                  </div>

                  {request.attachments && request.attachments.length > 0 && (
                    <div className="attachments-section">
                      <span className="attachments-label">
                        <FaPaperclip /> ไฟล์แนบ ({request.attachments.length})
                      </span>
                      <div className="attachments-list">
                        {request.attachments.map((file, idx) => {
                          // Handle both Sequelize object and Mongoose string formats
                          const filePath =
                            typeof file === "string" ? file : file.filePath;
                          const fileName =
                            typeof file === "string"
                              ? file.split("/").pop()
                              : file.fileName ||
                                filePath?.split("/").pop() ||
                                "ไฟล์แนบ";

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handlePreview(filePath)}
                              className="attachment-link"
                            >
                              <FaFileAlt /> {fileName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <div className="footer-row">
                    <span className="created-date">
                      ยื่นเมื่อ {formatDate(request.createdAt)}
                    </span>
                    <div className="footer-buttons">
                      {request.status !== "cancelled" && (
                        <button
                          className="cancel-btn-leave"
                          onClick={() => handleCancelClick(request)}
                          title="ยกเลิกใบลา"
                        >
                          <FaTimesCircle /> ยกเลิก
                        </button>
                      )}
                      <button
                        className="preview-btn-form"
                        onClick={() => handlePreviewPDF(request)}
                        title="ดูใบลา"
                        disabled={downloadingId === `preview_${request.id || request._id}`}
                      >
                        {downloadingId === `preview_${request.id || request._id}` ? (
                          <><FaSpinner className="spin" /> กำลังโหลด...</>
                        ) : (
                          <><FaEye /> ดูใบลา</>
                        )}
                      </button>
                      <button
                        className="pdf-btn-leave"
                        onClick={() => handleDownloadPDF(request)}
                        title="ดาวน์โหลดใบลา PDF"
                        disabled={downloadingId === (request.id || request._id)}
                      >
                        {downloadingId === (request.id || request._id) ? (
                          <><FaSpinner className="spin" /> กำลังโหลด...</>
                        ) : (
                          <><FaFilePdf /> ดาวน์โหลด</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      {cancelModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>ยกเลิกใบลา</h3>
            <p>คุณต้องการยกเลิกใบลาใช่หรือไม่?</p>
            <textarea
              placeholder="ระบุเหตุผลในการยกเลิก (เว้นว่างได้)"
              value={cancelModal.reason}
              onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
            />
            <div className="modal-actions">
              <button
                className="modal-btn cancel"
                onClick={() => setCancelModal({ isOpen: false, request: null, reason: "" })}
                disabled={cancelMutation.isLoading}
              >
                <FaTimes /> ปิด
              </button>
              <button
                className="modal-btn confirm"
                onClick={submitCancel}
                disabled={cancelMutation.isLoading}
              >
                {cancelMutation.isLoading ? (
                  "กำลังดำเนินการ..."
                ) : (
                  <>
                    <FaCheckCircle /> ยืนยันการยกเลิก
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LeaveHistory;
