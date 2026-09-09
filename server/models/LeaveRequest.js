// ============================================
// LeaveRequest Model (Sequelize) - V2
// ============================================
// ปรับปรุง: ใช้ FK leave_type_id, DECIMAL, เพิ่ม cancelled
// ============================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const LeaveRequest = sequelize.define(
  "LeaveRequest",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "user_id",
    },
    leaveTypeId: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      field: "leave_type_id",
      comment: "FK ไปยัง leave_types",
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "start_date",
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "end_date",
    },
    totalDays: {
      type: DataTypes.DECIMAL(4, 1),
      allowNull: false,
      field: "total_days",
      comment: "รองรับครึ่งวัน (0.5)",
    },
    timeSlot: {
      type: DataTypes.ENUM("full", "morning", "afternoon"),
      defaultValue: "full",
      field: "time_slot",
    },
    reason: {
      type: DataTypes.STRING(500),
    },
    contactAddress: {
      type: DataTypes.STRING(300),
      field: "contact_address",
      comment: "ที่อยู่ระหว่างลา",
    },
    contactPhone: {
      type: DataTypes.STRING(15),
      field: "contact_phone",
      comment: "เบอร์โทรระหว่างลา",
    },
    // Approval workflow
    status: {
      type: DataTypes.ENUM(
        "pending",
        "pending_dean",
        "pending_vp",
        "approved",
        "rejected",
        "confirmed",
        "cancelled"
      ),
      defaultValue: "pending",
    },
    // Level 1: หัวหน้างาน
    headComment: {
      type: DataTypes.STRING(500),
      field: "head_comment",
      comment: "ความเห็นของหัวหน้าสำนักงาน/หัวหน้าภาค/หัวหน้าสาขาวิชา/หัวหน้างาน",
    },
    headApprovedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: "head_approved_by",
      comment: "FK: ผู้ให้ความเห็น (head)",
    },
    headApprovedAt: {
      type: DataTypes.DATE,
      field: "head_approved_at",
    },
    // Backward compatibility for approvedBy / approvedAt
    approvedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: "approved_by",
      comment: "FK: ผู้อนุมัติ (head)",
    },
    approvedAt: {
      type: DataTypes.DATE,
      field: "approved_at",
    },
    // Level 2: คณบดี / ผอ.สำนัก / ผอ.สถาบัน
    deanComment: {
      type: DataTypes.STRING(500),
      field: "dean_comment",
      comment: "ความเห็นของคณบดี/ผอ.สำนัก/ผอ.สถาบัน",
    },
    deanApprovedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: "dean_approved_by",
      comment: "FK: ผู้ให้ความเห็น (dean)",
    },
    deanApprovedAt: {
      type: DataTypes.DATE,
      field: "dean_approved_at",
    },
    // Level 3: คำสั่งรองอธิการบดีฝ่ายบริหารงานบุคคลและเทคโนโลยีสารสนเทศ
    vpDecision: {
      type: DataTypes.ENUM("allow", "disallow"),
      field: "vp_decision",
      comment: "คำสั่งรองอธิการบดีฯ: allow=อนุญาต, disallow=ไม่อนุญาต",
    },
    vpComment: {
      type: DataTypes.STRING(500),
      field: "vp_comment",
      comment: "คำสั่งหรือความเห็นเพิ่มเติมของรองอธิการบดีฯ",
    },
    vpApprovedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: "vp_approved_by",
      comment: "FK: ผู้ลงนามคำสั่ง (vp)",
    },
    vpApprovedAt: {
      type: DataTypes.DATE,
      field: "vp_approved_at",
    },
    rejectionReason: {
      type: DataTypes.STRING(500),
      field: "rejection_reason",
    },
    // Confirmation (admin)
    confirmedBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: "confirmed_by",
      comment: "FK: ผู้ยืนยัน (admin)",
    },
    confirmedAt: {
      type: DataTypes.DATE,
      field: "confirmed_at",
    },
    confirmedNote: {
      type: DataTypes.STRING(500),
      field: "confirmed_note",
    },
    // Cancellation
    cancelledAt: {
      type: DataTypes.DATE,
      field: "cancelled_at",
    },
    cancelReason: {
      type: DataTypes.STRING(500),
      field: "cancel_reason",
    },
  },
  {
    tableName: "leave_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: "idx_leave_requests_user_status_start_date",
        fields: ["user_id", "status", "start_date"],
      },
      {
        name: "idx_leave_requests_status_start_date",
        fields: ["status", "start_date"],
      },
      {
        name: "idx_leave_requests_user_status",
        fields: ["user_id", "status"],
      },
      {
        name: "idx_leave_requests_dates",
        fields: ["start_date", "end_date"],
      },
    ],
  }
);

module.exports = LeaveRequest;
