// ============================================
// Model Associations (Sequelize) - V2
// Define all relationships between models
// ============================================

const User = require("./User");
const Faculty = require("./Faculty");
const Department = require("./Department");
const LeaveBalance = require("./LeaveBalance");
const LeaveRequest = require("./LeaveRequest");
const LeaveAttachment = require("./LeaveAttachment");
const Holiday = require("./Holiday");
const LeaveType = require("./LeaveType");
const Notification = require("./Notification");
const LeaveHistory = require("./LeaveHistory");

// ========================================
// Faculty - Department Associations
// ========================================
Department.belongsTo(Faculty, {
  foreignKey: "facultyId",
  as: "faculty",
});

Faculty.hasMany(Department, {
  foreignKey: "facultyId",
  as: "departments",
});

// ========================================
// User Associations
// ========================================
// User belongs to Department
User.belongsTo(Department, {
  foreignKey: "departmentId",
  as: "department",
});

Department.hasMany(User, {
  foreignKey: "departmentId",
  as: "employees",
});

// Self-referential: User has supervisor (also a User)
User.belongsTo(User, {
  foreignKey: "supervisorId",
  as: "supervisor",
});

User.hasMany(User, {
  foreignKey: "supervisorId",
  as: "subordinates",
});

// ========================================
// LeaveType - LeaveBalance Associations (NEW)
// ========================================
// User has many LeaveBalances (1 per leave_type per year)
User.hasMany(LeaveBalance, {
  foreignKey: "userId",
  as: "leaveBalances",
});

LeaveBalance.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

// LeaveBalance belongs to LeaveType
LeaveBalance.belongsTo(LeaveType, {
  foreignKey: "leaveTypeId",
  as: "leaveType",
});

LeaveType.hasMany(LeaveBalance, {
  foreignKey: "leaveTypeId",
  as: "balances",
});

// ========================================
// LeaveRequest Associations
// ========================================
// LeaveRequest belongs to User
LeaveRequest.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

User.hasMany(LeaveRequest, {
  foreignKey: "userId",
  as: "leaveRequests",
});

// LeaveRequest belongs to LeaveType (NEW - replaces VARCHAR)
LeaveRequest.belongsTo(LeaveType, {
  foreignKey: "leaveTypeId",
  as: "leaveType",
});

LeaveType.hasMany(LeaveRequest, {
  foreignKey: "leaveTypeId",
  as: "leaveRequests",
});

// LeaveRequest belongs to Approver (User) - Backward compatibility
LeaveRequest.belongsTo(User, {
  foreignKey: "approvedBy",
  as: "approver",
});

User.hasMany(LeaveRequest, {
  foreignKey: "approvedBy",
  as: "approvedRequests",
});

// LeaveRequest belongs to Head Approver (Level 1)
LeaveRequest.belongsTo(User, {
  foreignKey: "headApprovedBy",
  as: "headApprover",
});

User.hasMany(LeaveRequest, {
  foreignKey: "headApprovedBy",
  as: "headApprovedRequests",
});

// LeaveRequest belongs to Dean Approver (Level 2)
LeaveRequest.belongsTo(User, {
  foreignKey: "deanApprovedBy",
  as: "deanApprover",
});

User.hasMany(LeaveRequest, {
  foreignKey: "deanApprovedBy",
  as: "deanApprovedRequests",
});

// LeaveRequest belongs to VP Approver (Level 3)
LeaveRequest.belongsTo(User, {
  foreignKey: "vpApprovedBy",
  as: "vpApprover",
});

User.hasMany(LeaveRequest, {
  foreignKey: "vpApprovedBy",
  as: "vpApprovedRequests",
});

// LeaveRequest belongs to Confirmer (User)
LeaveRequest.belongsTo(User, {
  foreignKey: "confirmedBy",
  as: "confirmer",
});

// LeaveRequest has many Attachments
LeaveRequest.hasMany(LeaveAttachment, {
  foreignKey: "leaveRequestId",
  as: "attachments",
});

LeaveAttachment.belongsTo(LeaveRequest, {
  foreignKey: "leaveRequestId",
  as: "leaveRequest",
});

// ========================================
// LeaveHistory Associations (NEW)
// ========================================
LeaveRequest.hasMany(LeaveHistory, {
  foreignKey: "leaveRequestId",
  as: "history",
});

LeaveHistory.belongsTo(LeaveRequest, {
  foreignKey: "leaveRequestId",
  as: "leaveRequest",
});

LeaveHistory.belongsTo(User, {
  foreignKey: "actionBy",
  as: "actor",
});

User.hasMany(LeaveHistory, {
  foreignKey: "actionBy",
  as: "actions",
});

// ========================================
// Notification Associations
// ========================================
Notification.belongsTo(User, {
  foreignKey: "userId",
  as: "user",
});

User.hasMany(Notification, {
  foreignKey: "userId",
  as: "notifications",
});

// Notification belongs to LeaveRequest (optional)
Notification.belongsTo(LeaveRequest, {
  foreignKey: "relatedLeaveId",
  as: "relatedLeave",
});

LeaveRequest.hasMany(Notification, {
  foreignKey: "relatedLeaveId",
  as: "notifications",
});

module.exports = {
  User,
  Faculty,
  Department,
  LeaveBalance,
  LeaveRequest,
  LeaveAttachment,
  Holiday,
  LeaveType,
  Notification,
  LeaveHistory,
};
