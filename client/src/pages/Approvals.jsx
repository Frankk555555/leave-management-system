import React, { useState } from "react";
import {
  usePendingLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
} from "../hooks/queries/useLeaveRequests";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/common/Toast";
import Loading from "../components/common/Loading";
import { getLeaveTypeName, getLeaveTypeIcon, getLeaveTypeCode } from "../utils/leaveTypeUtils";
import { previewLeavePDF } from "../utils/generateLeavePDF";
import config from "../config";
import SEO, { SEOConfig } from "../components/common/SEO";
import "./Approvals.css";

// React Icons
import {
  FaFileAlt,
  FaCheckCircle,
  FaPaperclip,
  FaTimesCircle,
  FaTimes,
  FaEye,
  FaStamp,
  FaUserCheck,
} from "react-icons/fa";

const Approvals = () => {
  const toast = useToast();
  const { user } = useAuth();
  const { data: requests = [], isLoading: loading } = usePendingLeaveRequests();
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();

  const [processing, setProcessing] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);
  const [imgErrors, setImgErrors] = useState({});
  const [noteModal, setNoteModal] = useState({
    open: false,
    request: null,
    action: null,
  });
  const [note, setNote] = useState("");
  const [vpDecision, setVpDecision] = useState("allow");

  const handleImageError = (id) => {
    setImgErrors((prev) => ({ ...prev, [id]: true }));
  };

  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith("http://") || profileImage.startsWith("https://")) {
      return profileImage;
    }
    let normalizedPath = profileImage.replace(/\\/g, "/");
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = "/" + normalizedPath;
    }
    return `${config.API_URL}${normalizedPath}`;
  };

  const handleAction = (request, action) => {
    setNoteModal({ open: true, request, action });
    if (action === "approve") {
      if (user?.role === "head" || user?.role === "dean") {
        setNote("เห็นควรอนุญาต");
      } else {
        setNote("");
      }
      setVpDecision("allow");
    } else {
      setNote("");
    }
  };

  const confirmAction = async () => {
    const { request, action } = noteModal;
    if (!request) return;
    const reqId = request.id || request._id;

    setProcessing(reqId);
    try {
      if (action === "approve") {
        await approveMutation.mutateAsync({
          id: reqId,
          note,
          comment: note,
          decision: user?.role === "vp" || request.status === "pending_vp" ? vpDecision : undefined,
        });
        toast.success("บันทึกการอนุมัติคำขอลาเรียบร้อยแล้ว");
      } else {
        await rejectMutation.mutateAsync({ id: reqId, reason: note });
        toast.success("ปฏิเสธคำขอลาเรียบร้อยแล้ว");
      }

      // Trigger notification refresh
      window.dispatchEvent(new Event("refreshNotifications"));
    } catch (error) {
      console.error("Error processing request:", error);
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาด");
    } finally {
      setProcessing(null);
      setNoteModal({ open: false, request: null, action: null });
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // เปิดไฟล์แนบในหน้าต่างใหม่
  const handlePreview = (fileUrl) => {
    if (!fileUrl) return;

    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      window.open(fileUrl, "_blank");
      return;
    }

    let normalizedPath = fileUrl.replace(/\\/g, "/");
    if (!normalizedPath.startsWith("/")) {
      normalizedPath = "/" + normalizedPath;
    }
    window.open(`${config.API_URL}${normalizedPath}`, "_blank");
  };

  // ดูตัวอย่างใบลา PDF ก่อนอนุมัติ
  const handlePreviewPDF = async (request) => {
    const reqId = request.id || request._id;
    setPreviewingId(reqId);
    try {
      const userData = {
        firstName: request.user?.firstName || "",
        lastName: request.user?.lastName || "",
        title: request.user?.title || "",
        position: request.user?.position || "",
        department: request.user?.department || "",
        unit: request.user?.unit || "",
        affiliation: request.user?.affiliation || "",
        phone: request.user?.phone || "",
        documentNumber: request.user?.documentNumber || "",
        signatureImage: request.user?.signatureImage || "",
      };

      const leaveData = {
        ...request,
        leaveType: getLeaveTypeCode(request.leaveType),
        startDate: request.startDate,
        endDate: request.endDate,
        totalDays: request.totalDays,
        reason: request.reason || "",
        contactAddress: request.contactAddress || "",
        contactPhone: request.contactPhone || "",
        createdAt: request.createdAt,
        headComment: request.headComment,
        headApprover: request.headApprover,
        headApprovedAt: request.headApprovedAt,
        deanComment: request.deanComment,
        deanApprover: request.deanApprover,
        deanApprovedAt: request.deanApprovedAt,
        vpDecision: request.vpDecision,
        vpComment: request.vpComment,
        vpApprover: request.vpApprover,
        vpApprovedAt: request.vpApprovedAt,
      };

      await previewLeavePDF(leaveData, userData);
    } catch (err) {
      console.error("Preview PDF error:", err);
      toast.error("ไม่สามารถสร้างตัวอย่างใบลา PDF ได้");
    } finally {
      setPreviewingId(null);
    }
  };

  const getStepBadge = (status) => {
    switch (status) {
      case "pending":
        return <span className="approval-step-badge step-pending"><FaStamp /> ขั้นที่ ๑: รอหัวหน้างานพิจารณา</span>;
      case "pending_dean":
        return <span className="approval-step-badge step-pending-dean"><FaStamp /> ขั้นที่ ๒: รอคณบดี/ผอ.สำนักพิจารณา</span>;
      case "pending_vp":
        return <span className="approval-step-badge step-pending-vp"><FaUserCheck /> ขั้นที่ ๓: รอคำสั่งรองอธิการบดีฝ่ายบุคคลฯ</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.approvals} />
        <Loading size="fullpage" text="กำลังโหลด..." />
      </>
    );
  }

  return (
    <>
      <SEO {...SEOConfig.approvals} />
      <div className="approvals-page">
        <div className="page-header">
          <h1>อนุมัติการลา</h1>
          <p>รายการคำขอลาที่รอการพิจารณาตามลำดับชั้น ({requests.length} รายการ)</p>
        </div>

        {requests.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎉</span>
            <h3>ไม่มีคำขอที่รอการอนุมัติ</h3>
            <p>คำขอลาทั้งหมดได้รับการดำเนินการแล้ว</p>
          </div>
        ) : (
          <div className="approvals-grid">
            {requests.map((request) => {
              const reqId = request.id || request._id;
              const profileImageUrl = getProfileImageUrl(request.user?.profileImage);
              const showImage = profileImageUrl && !imgErrors[reqId];

              return (
                <div key={reqId} className="approval-card">
                  <div className="card-header">
                    <div className="employee-info">
                      <div className="avatar">
                        {showImage ? (
                          <img
                            src={profileImageUrl}
                            alt={request.user?.firstName || "Profile"}
                            onError={() => handleImageError(reqId)}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: "50%",
                            }}
                          />
                        ) : (
                          request.user?.firstName?.charAt(0) || "?"
                        )}
                      </div>
                      <div>
                        <h4>
                          {request.user?.firstName || "-"}{" "}
                          {request.user?.lastName || ""}
                        </h4>
                        <p>
                          {request.user?.department?.name || "-"} -{" "}
                          {request.user?.position || "-"}
                        </p>
                        {getStepBadge(request.status)}
                      </div>
                    </div>
                    <div className="leave-type-badge">
                      {getLeaveTypeIcon(request.leaveType)}{" "}
                      {getLeaveTypeName(request.leaveType)}
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
                        </span>
                      </div>
                      <div className="days-count">
                        <span className="days-number">{request.totalDays}</span>
                        <span className="days-label">วัน</span>
                        {(request.timeSlot === "morning" ||
                          request.timeSlot === "afternoon") && (
                          <span className="time-slot-badge">
                            ({request.timeSlot === "morning" ? "เช้า" : "บ่าย"})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="reason-section">
                      <span className="reason-label">เหตุผลการขอลา:</span>
                      <p className="reason-text">{request.reason}</p>
                    </div>

                    {/* แสดงความเห็นของหัวหน้างาน (ถ้ามีบันทึกไว้แล้ว) */}
                    {request.headComment && (
                      <div className="approver-comment-box head-comment-box">
                        <div className="approver-comment-title">
                          <FaStamp /> ๑. ความเห็นหัวหน้างาน
                          {request.headApprover && (
                            <span> ({request.headApprover.title || ""}{request.headApprover.firstName} {request.headApprover.lastName})</span>
                          )}
                        </div>
                        <div className="approver-comment-text">{request.headComment}</div>
                      </div>
                    )}

                    {/* แสดงความเห็นของคณบดี (ถ้ามีบันทึกไว้แล้ว) */}
                    {request.deanComment && (
                      <div className="approver-comment-box dean-comment-box">
                        <div className="approver-comment-title">
                          <FaStamp /> ๒. ความเห็นคณบดี/ผอ.สำนัก
                          {request.deanApprover && (
                            <span> ({request.deanApprover.title || ""}{request.deanApprover.firstName} {request.deanApprover.lastName})</span>
                          )}
                        </div>
                        <div className="approver-comment-text">{request.deanComment}</div>
                      </div>
                    )}

                    {request.attachments && request.attachments.length > 0 && (
                      <div className="attachments-section">
                        <span className="attachments-label">
                          <FaPaperclip /> ไฟล์แนบ ({request.attachments.length})
                        </span>
                        <div className="attachments-list">
                          {request.attachments.map((file, idx) => {
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

                    <button
                      type="button"
                      className="preview-pdf-btn"
                      onClick={() => handlePreviewPDF(request)}
                      disabled={previewingId === reqId}
                    >
                      <FaEye /> {previewingId === reqId ? "กำลังโหลด PDF..." : "ดูตัวอย่างใบลา PDF"}
                    </button>
                  </div>

                  <div className="card-actions">
                    <button
                      className="reject-btn"
                      onClick={() => handleAction(request, "reject")}
                      disabled={processing === reqId}
                    >
                      <FaTimesCircle /> ไม่อนุมัติ
                    </button>
                    <button
                      className="approve-btn"
                      onClick={() => handleAction(request, "approve")}
                      disabled={processing === reqId}
                    >
                      <FaCheckCircle /> อนุมัติ / บันทึกความเห็น
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {noteModal.open && noteModal.request && (
          <div
            className="modal-overlay"
            onClick={() =>
              setNoteModal({ open: false, request: null, action: null })
            }
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>
                {noteModal.action === "approve"
                  ? user?.role === "vp" || noteModal.request.status === "pending_vp"
                    ? "⚖️ คำสั่งรองอธิการบดีฝ่ายบริหารงานบุคคลฯ"
                    : user?.role === "dean" || noteModal.request.status === "pending_dean"
                    ? "🏛️ ความเห็นของคณบดี/ผอ.สำนัก/ผอ.สถาบัน"
                    : "📋 ความเห็นของหัวหน้างาน / หัวหน้าสาขาวิชา"
                  : "❌ ยืนยันการไม่อนุมัติคำขอลา"}
              </h3>

              {/* สรุปความเห็นของขั้นตอนก่อนหน้า (ถ้ามี) */}
              {(noteModal.request.headComment || noteModal.request.deanComment) && (
                <div className="modal-previous-comments">
                  <h5>ความเห็นตามลำดับชั้นก่อนหน้า:</h5>
                  {noteModal.request.headComment && (
                    <div style={{ marginBottom: "0.4rem" }}>
                      <strong>๑. หัวหน้างาน:</strong> {noteModal.request.headComment}
                      {noteModal.request.headApprover && (
                        <span style={{ color: "#64748b" }}> ({noteModal.request.headApprover.firstName} {noteModal.request.headApprover.lastName})</span>
                      )}
                    </div>
                  )}
                  {noteModal.request.deanComment && (
                    <div>
                      <strong>๒. คณบดี/ผอ.:</strong> {noteModal.request.deanComment}
                      {noteModal.request.deanApprover && (
                        <span style={{ color: "#64748b" }}> ({noteModal.request.deanApprover.firstName} {noteModal.request.deanApprover.lastName})</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* กรณีรองอธิการบดี (VP) ให้เลือกคำสั่ง อนุญาต / ไม่อนุญาต */}
              {noteModal.action === "approve" &&
                (user?.role === "vp" || noteModal.request.status === "pending_vp") && (
                  <div className="form-group">
                    <label style={{ fontWeight: 600, display: "block", marginBottom: "0.5rem" }}>
                      คำสั่ง:
                    </label>
                    <div className="decision-selector">
                      <label
                        className={`decision-option allow ${
                          vpDecision === "allow" ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="vpDecision"
                          value="allow"
                          checked={vpDecision === "allow"}
                          onChange={() => setVpDecision("allow")}
                        />
                        ✓ อนุญาต
                      </label>
                      <label
                        className={`decision-option disallow ${
                          vpDecision === "disallow" ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="vpDecision"
                          value="disallow"
                          checked={vpDecision === "disallow"}
                          onChange={() => setVpDecision("disallow")}
                        />
                        ✕ ไม่อนุญาต
                      </label>
                    </div>
                  </div>
                )}

              <div className="form-group">
                <label>
                  {noteModal.action === "approve"
                    ? user?.role === "vp" || noteModal.request.status === "pending_vp"
                      ? "ข้อความคำสั่งเพิ่มเติม / หมายเหตุ (ถ้ามี)"
                      : "ความเห็นของผู้บังคับบัญชา"
                    : "เหตุผลที่ไม่อนุมัติ"}
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    noteModal.action === "approve"
                      ? user?.role === "vp"
                        ? "ระบุข้อความคำสั่ง (ถ้ามี)..."
                        : "ระบุความเห็น เช่น เห็นควรอนุญาต..."
                      : "ระบุเหตุผลที่ไม่อนุมัติ..."
                  }
                  rows={3}
                  required={noteModal.action === "reject"}
                />
              </div>

              <div className="modal-actions">
                <button
                  className="cancel-btn"
                  onClick={() =>
                    setNoteModal({ open: false, request: null, action: null })
                  }
                >
                  <FaTimes /> ยกเลิก
                </button>
                <button
                  className={noteModal.action === "approve" ? "approve-btn" : "reject-btn"}
                  onClick={confirmAction}
                  disabled={processing}
                >
                  {processing ? (
                    "กำลังดำเนินการ..."
                  ) : noteModal.action === "approve" ? (
                    <>
                      <FaCheckCircle /> บันทึกและอนุมัติ
                    </>
                  ) : (
                    <>
                      <FaTimesCircle /> ยืนยันไม่อนุมัติ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Approvals;
