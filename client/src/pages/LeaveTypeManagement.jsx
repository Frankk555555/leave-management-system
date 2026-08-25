import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { leaveTypesAPI, reportsAPI } from "../services/api";
import { useLeaveTypes } from "../hooks/queries/useReferenceData";
import { useToast } from "../components/common/Toast";
import Loading from "../components/common/Loading";
import {
  FaHospital,
  FaClipboardList,
  FaUmbrellaBeach,
  FaBaby,
  FaUserFriends,
  FaChild,
  FaPray,
  FaMedal,
  FaFileAlt,
  FaSyncAlt,
  FaEdit,
  FaPlus,
  FaFileMedical,
  FaInfoCircle,
  FaTrashAlt,
  FaTimes,
} from "react-icons/fa";
import SEO, { SEOConfig } from "../components/common/SEO";
import "./LeaveTypeManagement.css";

// Semantic color and icon mappings for leave types
const LEAVE_TYPE_CONFIG = {
  sick: {
    icon: FaHospital,
    color: "#06b6d4", // Cyan
    bgLight: "rgba(6, 182, 212, 0.08)",
    borderLight: "rgba(6, 182, 212, 0.25)",
    label: "ลาป่วย",
  },
  personal: {
    icon: FaClipboardList,
    color: "#6366f1", // Indigo
    bgLight: "rgba(99, 102, 241, 0.08)",
    borderLight: "rgba(99, 102, 241, 0.25)",
    label: "ลากิจส่วนตัว",
  },
  vacation: {
    icon: FaUmbrellaBeach,
    color: "#f59e0b", // Amber
    bgLight: "rgba(245, 158, 11, 0.08)",
    borderLight: "rgba(245, 158, 11, 0.25)",
    label: "ลาพักผ่อน",
  },
  maternity: {
    icon: FaBaby,
    color: "#ec4899", // Rose
    bgLight: "rgba(236, 72, 153, 0.08)",
    borderLight: "rgba(236, 72, 153, 0.25)",
    label: "ลาคลอดบุตร",
  },
  paternity: {
    icon: FaUserFriends,
    color: "#8b5cf6", // Purple
    bgLight: "rgba(139, 92, 246, 0.08)",
    borderLight: "rgba(139, 92, 246, 0.25)",
    label: "ลาช่วยภริยาคลอด",
  },
  childcare: {
    icon: FaChild,
    color: "#14b8a6", // Teal
    bgLight: "rgba(20, 184, 166, 0.08)",
    borderLight: "rgba(20, 184, 166, 0.25)",
    label: "ลาเลี้ยงดูบุตร",
  },
  ordination: {
    icon: FaPray,
    color: "#eab308", // Yellow
    bgLight: "rgba(234, 179, 8, 0.08)",
    borderLight: "rgba(234, 179, 8, 0.25)",
    label: "ลาอุปสมบท/ฮัจย์",
  },
  military: {
    icon: FaMedal,
    color: "#3b82f6", // Blue
    bgLight: "rgba(59, 130, 246, 0.08)",
    borderLight: "rgba(59, 130, 246, 0.25)",
    label: "ลาตรวจเลือกทหาร",
  },
};

const DEFAULT_CODES = [
  { code: "sick", label: "sick (ลาป่วย)" },
  { code: "personal", label: "personal (ลากิจส่วนตัว)" },
  { code: "vacation", label: "vacation (ลาพักผ่อน)" },
  { code: "maternity", label: "maternity (ลาคลอดบุตร)" },
  { code: "paternity", label: "paternity (ลาช่วยภรรยาคลอด)" },
  { code: "childcare", label: "childcare (ลาเลี้ยงดูบุตร)" },
  { code: "ordination", label: "ordination (ลาอุปสมบท/ฮัจย์)" },
  { code: "military", label: "military (ลาตรวจเลือกทหาร)" },
];

const LeaveTypeManagement = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: leaveTypes = [], isLoading: loading } = useLeaveTypes();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "sick",
    description: "",
    defaultDays: 10,
    requiresMedicalCert: false,
  });

  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleResetYearly = async () => {
    const confirmed = await toast.confirm(
      "คุณแน่ใจหรือไม่ที่จะรีเซ็ตยอดวันลาของบุคลากรทุกคนสำหรับปีงบประมาณใหม่? (การดำเนินการนี้จะคำนวณสิทธิ์ใหม่ตามประเภทการลาที่ตั้งไว้)",
      "ยืนยันการรีเซ็ตวันลาประจำปี"
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      const response = await reportsAPI.resetYearly();
      toast.success(
        `${response.data.message || "รีเซ็ตยอดวันลาเรียบร้อยแล้ว"} (อัปเดตแล้ว ${
          response.data?.data?.processedUsers || response.data?.updatedCount || 0
        } คน)`
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการรีเซ็ตยอดวันลา");
    } finally {
      setResetting(false);
    }
  };

  const handleInitialize = async () => {
    const confirmed = await toast.confirm(
      "ต้องการกู้คืนหรือสร้างประเภทการลามาตรฐานตามระเบียบราชการ (8 ประเภท) หรือไม่?",
      "กู้คืนประเภทการลาเริ่มต้น"
    );
    if (!confirmed) return;
    try {
      await leaveTypesAPI.initialize();
      queryClient.invalidateQueries(["leaveTypes"]);
      toast.success("กู้คืนประเภทการลาเริ่มต้นเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาด");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
          ? parseInt(value, 10) || 0
          : value,
    }));
  };

  const openModal = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        code: type.code,
        description: type.description || "",
        defaultDays: type.defaultDays || 0,
        requiresMedicalCert: Boolean(type.requiresMedicalCert),
      });
    } else {
      setEditingType(null);
      setFormData({
        name: "",
        code: "sick",
        description: "",
        defaultDays: 10,
        requiresMedicalCert: false,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("กรุณาระบุชื่อประเภทการลา");
      return;
    }
    setSaving(true);
    try {
      if (editingType) {
        await leaveTypesAPI.update(editingType.id || editingType._id, formData);
        toast.success("แก้ไขประเภทการลาเรียบร้อยแล้ว");
      } else {
        await leaveTypesAPI.create(formData);
        toast.success("เพิ่มประเภทการลาใหม่เรียบร้อยแล้ว");
      }
      queryClient.invalidateQueries(["leaveTypes"]);
      setModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = await toast.confirm(
      `คุณต้องการลบประเภทการลา "${name}" หรือไม่? ข้อมูลการลาเดิมที่เคยบันทึกไว้จะไม่สูญหาย`,
      "ยืนยันการลบประเภทการลา"
    );
    if (!confirmed) return;
    try {
      await leaveTypesAPI.delete(id);
      queryClient.invalidateQueries(["leaveTypes"]);
      toast.success("ลบประเภทการลาเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการลบ");
    }
  };

  const getTypeMeta = (code) => {
    return (
      LEAVE_TYPE_CONFIG[code] || {
        icon: FaFileAlt,
        color: "#64748b",
        bgLight: "rgba(100, 116, 139, 0.08)",
        borderLight: "rgba(100, 116, 139, 0.25)",
        label: code,
      }
    );
  };

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.leaveTypes} />
        <Loading size="fullpage" text="กำลังโหลดประเภทการลา..." />
      </>
    );
  }

  return (
    <>
      <SEO {...SEOConfig.leaveTypes} />
      <div className="leave-type-page-container">
        {/* Executive Header */}
        <header className="leave-type-header">
          <div className="leave-type-header-text">
            <h1 className="leave-type-title">จัดการประเภทและสิทธิ์การลา</h1>
            <p className="leave-type-subtitle">
              กำหนดประเภท สิทธิ์วันลาสะสมประจำปี และเงื่อนไขการแนบเอกสารตามระเบียบมหาวิทยาลัย
            </p>
          </div>

          <div className="leave-type-toolbar">
            <button
              className="toolbar-btn btn-secondary"
              onClick={handleInitialize}
              title="กู้คืนรายการประเภทการลามาตรฐาน 8 รูปแบบ"
            >
              <FaSyncAlt className="btn-icon" />
              <span>กู้คืนค่าเริ่มต้น</span>
            </button>

            <button
              className="toolbar-btn btn-warning"
              onClick={handleResetYearly}
              disabled={resetting}
              title="คำนวณและรีเซ็ตโควตาวันลาประจำปีงบประมาณของบุคลากรทุกคน"
            >
              <FaSyncAlt className={`btn-icon ${resetting ? "spin" : ""}`} />
              <span>{resetting ? "กำลังรีเซ็ต..." : "รีเซ็ตวันลาประจำปี"}</span>
            </button>

            <button
              className="toolbar-btn btn-primary"
              onClick={() => openModal(null)}
            >
              <FaPlus className="btn-icon" />
              <span>เพิ่มประเภทการลา</span>
            </button>
          </div>
        </header>

        {/* Policy & Guide Callout (Top) */}
        <section className="leave-type-guide-card">
          <div className="guide-icon-wrap">
            <FaInfoCircle />
          </div>
          <div className="guide-content">
            <h4 className="guide-title">แนวปฏิบัติการจัดการสิทธิ์และประเภทการลา</h4>
            <div className="guide-grid">
              <div className="guide-item">
                <span className="guide-bullet">1</span>
                <div>
                  <strong>การรีเซ็ตวันลาประจำปี:</strong> ควรดำเนินการเมื่อเริ่มต้นปีงบประมาณใหม่ (1 ต.ค.) เพื่อคำนวณและตั้งต้นยอดสิทธิ์วันลาสะสมใหม่ให้บุคลากรทุกคน
                </div>
              </div>
              <div className="guide-item">
                <span className="guide-bullet">2</span>
                <div>
                  <strong>เงื่อนไขใบรับรองแพทย์:</strong> ระบบจะบังคับให้บุคลากรต้องแนบไฟล์เอกสารใบรับรองแพทย์ในขั้นตอนยื่นใบลาเมื่อเลือกประเภทนี้
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Leave Types Grid */}
        {leaveTypes.length === 0 ? (
          <div className="leave-type-empty-state">
            <div className="empty-state-icon-wrap">
              <FaFileAlt />
            </div>
            <h3>ไม่พบข้อมูลประเภทการลา</h3>
            <p>
              ยังไม่มีประเภทการลาในระบบ คลิกปุ่ม 'กู้คืนค่าเริ่มต้น' เพื่อโหลดข้อมูลมาตรฐาน
            </p>
            <button className="empty-action-btn" onClick={handleInitialize}>
              <FaSyncAlt /> กู้คืนประเภทการลาเริ่มต้น
            </button>
          </div>
        ) : (
          <div className="leave-types-card-grid">
            {leaveTypes.map((type) => {
              const meta = getTypeMeta(type.code);
              const IconComponent = meta.icon;
              return (
                <div key={type.id || type._id} className="leave-type-item-card">
                  <div className="card-top-row">
                    <div className="card-identity-group">
                      <div
                        className="type-avatar"
                        style={{
                          backgroundColor: meta.bgLight,
                          color: meta.color,
                          borderColor: meta.borderLight,
                        }}
                      >
                        <IconComponent />
                      </div>
                      <div className="type-title-box">
                        <h3 className="type-name">{type.name}</h3>
                        <div className="type-meta-tags">
                          <span className="code-pill">#{type.code}</span>
                          {type.requiresMedicalCert && (
                            <span className="cert-pill" title="ต้องแนบใบรับรองแพทย์">
                              <FaFileMedical className="pill-icon" /> แนบใบรับรองแพทย์
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-quota-box">
                    <div className="quota-number-group">
                      <span className="quota-val">{type.defaultDays}</span>
                      <span className="quota-unit">วัน / ปีงบประมาณ</span>
                    </div>
                  </div>

                  <p className="card-description">
                    {type.description || "ไม่มีคำอธิบายระเบียบสำหรับประเภทนี้"}
                  </p>

                  <div className="card-footer-actions">
                    <button
                      className="card-action-btn edit-action"
                      onClick={() => openModal(type)}
                      title="แก้ไขข้อมูลประเภทการลานี้"
                    >
                      <FaEdit className="action-icon" />
                      <span>แก้ไข</span>
                    </button>

                    <button
                      className="card-action-btn delete-action"
                      onClick={() => handleDelete(type.id || type._id, type.name)}
                      title="ลบประเภทการลานี้"
                    >
                      <FaTrashAlt className="action-icon" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Add/Edit Leave Type */}
        {modalOpen && (
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
            <div
              className="leave-type-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-group">
                  <div className="modal-icon-pill">
                    {editingType ? <FaEdit /> : <FaPlus />}
                  </div>
                  <div>
                    <h3 className="modal-title">
                      {editingType ? "แก้ไขประเภทการลา" : "เพิ่มประเภทการลาใหม่"}
                    </h3>
                    <p className="modal-desc">
                      {editingType
                        ? `ปรับปรุงข้อกำหนดและสิทธิ์ของ ${editingType.name}`
                        : "กำหนดรายละเอียดสิทธิ์วันลาและเงื่อนไขตามระเบียบ"}
                    </p>
                  </div>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setModalOpen(false)}
                  aria-label="ปิดหน้าต่าง"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">
                    ชื่อประเภทการลา <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="เช่น ลาป่วย, ลาพักผ่อน, ลากิจส่วนตัว"
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">
                      รหัสระบบ (System Code) <span className="req-star">*</span>
                    </label>
                    <select
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      disabled={!!editingType}
                      className="form-control form-select"
                    >
                      {DEFAULT_CODES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {editingType && (
                      <span className="field-hint">รหัสระบบไม่สามารถแก้ไขได้หลังสร้าง</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      สิทธิ์วันลาต่อปี (วัน) <span className="req-star">*</span>
                    </label>
                    <input
                      type="number"
                      name="defaultDays"
                      value={formData.defaultDays}
                      onChange={handleChange}
                      min={0}
                      max={365}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">คำอธิบายระเบียบ / เงื่อนไข</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="ระบุเงื่อนไขการใช้สิทธิ์ หรือเอกสารที่เกี่ยวข้อง..."
                    rows={3}
                    className="form-control form-textarea"
                  />
                </div>

                <div className="form-checkbox-row">
                  <label className="toggle-switch-label">
                    <input
                      type="checkbox"
                      name="requiresMedicalCert"
                      checked={formData.requiresMedicalCert}
                      onChange={handleChange}
                      className="toggle-checkbox"
                    />
                    <span className="toggle-slider" />
                    <span className="toggle-text">
                      <strong>บังคับแนบใบรับรองแพทย์</strong>
                      <small>เมื่อเลือกประเภทการลานี้ ผู้ยื่นจะต้องอัปโหลดไฟล์ใบรับรองแพทย์ก่อนส่งคำขอ</small>
                    </span>
                  </label>
                </div>

                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="modal-btn btn-ghost"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="modal-btn btn-primary"
                    disabled={saving}
                  >
                    {saving ? "กำลังบันทึก..." : editingType ? "บันทึกการเปลี่ยนแปลง" : "เพิ่มประเภทการลา"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LeaveTypeManagement;
