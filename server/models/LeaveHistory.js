// ============================================
// LeaveHistory Model (Sequelize) - Audit Trail
// ============================================
// บันทึกทุกการเปลี่ยนแปลงสถานะของคำขอลา
// ============================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const LeaveHistory = sequelize.define(
  "LeaveHistory",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    leaveRequestId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "leave_request_id",
    },
    action: {
      type: DataTypes.ENUM(
        "created",
        "approved",
        "rejected",
        "confirmed",
        "cancelled",
        "edited"
      ),
      allowNull: false,
    },
    actionBy: {
      type: DataTypes.INTEGER.UNSIGNED,
      field: "action_by",
      comment: "FK: ผู้กระทำ",
    },
    oldStatus: {
      type: DataTypes.ENUM(
        "pending",
        "pending_dean",
        "pending_vp",
        "approved",
        "rejected",
        "confirmed",
        "cancelled"
      ),
      field: "old_status",
    },
    newStatus: {
      type: DataTypes.ENUM(
        "pending",
        "pending_dean",
        "pending_vp",
        "approved",
        "rejected",
        "confirmed",
        "cancelled"
      ),
      field: "new_status",
    },
    note: {
      type: DataTypes.STRING(500),
      comment: "หมายเหตุเพิ่มเติม",
    },
  },
  {
    tableName: "leave_history",
    timestamps: true,
    underscored: true,
    updatedAt: false, // Audit log ไม่ต้องมี updatedAt
    indexes: [
      {
        name: "idx_leave_history_request_created",
        fields: ["leave_request_id", "created_at"],
      },
      {
        name: "idx_leave_history_action_by",
        fields: ["action_by"],
      },
    ],
  }
);

module.exports = LeaveHistory;
