const {
  LeaveRequest,
  User,
  LeaveBalance,
  LeaveAttachment,
  LeaveType,
  Department,
  Faculty,
  Notification,
  LeaveHistory,
} = require("../models");
const { Op } = require("sequelize");
const {
  LeaveLifecycle,
  LifecycleError,
} = require("../services/leaveLifecycleService");

// @desc    Create leave request
// @route   POST /api/leave-requests
// @access  Private
const createLeaveRequest = async (req, res) => {
  try {
    const createdRequest = await LeaveLifecycle.create(
      req.body,
      req.user,
      req.files
    );
    res.status(201).json(createdRequest);
  } catch (error) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Standard approver attributes to include
const approverAttributes = ["id", "firstName", "lastName", "position", "signatureImage"];

// @desc    Get my leave requests
// @route   GET /api/leave-requests
// @access  Private
const getMyLeaveRequests = async (req, res) => {
  try {
    const leaveRequests = await LeaveRequest.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: User,
          as: "approver",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "headApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "deanApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "vpApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "confirmer",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "employeeId",
            "firstName",
            "lastName",
            "position",
            "unit",
            "affiliation",
            "documentNumber",
            "phone",
            "signatureImage",
          ],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name"],
              include: [
                {
                  model: Faculty,
                  as: "faculty",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        { model: LeaveType, as: "leaveType" },
        { model: LeaveAttachment, as: "attachments" },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(leaveRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get all leave requests (admin)
// @route   GET /api/leave-requests/all
// @access  Private/Admin
const getAllLeaveRequests = async (req, res) => {
  try {
    const leaveRequests = await LeaveRequest.findAll({
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "employeeId",
            "firstName",
            "lastName",
            "email",
            "position",
            "unit",
            "affiliation",
            "phone",
            "documentNumber",
            "signatureImage",
          ],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name"],
              include: [
                {
                  model: Faculty,
                  as: "faculty",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "headApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "deanApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "vpApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "confirmer",
          attributes: approverAttributes,
        },
        { model: LeaveType, as: "leaveType" },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(leaveRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get leave request by ID
// @route   GET /api/leave-requests/:id
// @access  Private
const getLeaveRequestById = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "employeeId",
            "firstName",
            "lastName",
            "email",
            "position",
            "unit",
            "affiliation",
            "phone",
            "documentNumber",
            "signatureImage",
          ],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name", "facultyId"],
              include: [
                {
                  model: Faculty,
                  as: "faculty",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "headApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "deanApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "vpApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "confirmer",
          attributes: approverAttributes,
        },
        { model: LeaveType, as: "leaveType" },
        { model: LeaveAttachment, as: "attachments" },
        {
          model: LeaveHistory,
          as: "history",
          include: [
            {
              model: User,
              as: "actor",
              attributes: ["id", "firstName", "lastName", "role"],
            },
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // IDOR Check
    const isOwner = leaveRequest.userId === req.user.id;
    const isAdmin = req.user.role === "admin";
    const isVP = req.user.role === "vp";
    const isDean = req.user.role === "dean";

    const isHeadOfSameDepartment =
      req.user.role === "head" &&
      leaveRequest.user &&
      leaveRequest.user.department &&
      leaveRequest.user.department.id === req.user.departmentId;

    if (!isOwner && !isAdmin && !isVP && !isDean && !isHeadOfSameDepartment) {
      return res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงใบลานี้" });
    }

    res.json(leaveRequest);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Cancel leave request (soft cancel)
// @route   PUT /api/leave-requests/:id/cancel
// @access  Private
const cancelLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveLifecycle.transition(
      req.params.id,
      "cancel",
      req.user,
      { reason: req.body.reason }
    );
    res.json({ message: "ยกเลิกการลาเรียบร้อยแล้ว", leaveRequest });
  } catch (error) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update leave request
// @route   PUT /api/leave-requests/:id
// @access  Private
const updateLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveLifecycle.transition(
      req.params.id,
      "edit",
      req.user,
      { payload: req.body }
    );
    res.json({ message: "อัปเดตบันทึกการลาเรียบร้อยแล้ว", leaveRequest });
  } catch (error) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get team leave requests (for team calendar)
// @route   GET /api/leave-requests/team
// @access  Private
const getTeamLeaveRequests = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: Department,
          as: "department",
        },
      ],
    });

    let teamWhere = {};

    if (user.supervisorId) {
      teamWhere = {
        [Op.or]: [
          { supervisorId: user.supervisorId },
          { id: user.supervisorId },
        ],
      };
    } else if (user.departmentId) {
      teamWhere = { departmentId: user.departmentId };
    }

    const teamMembers = await User.findAll({
      where: teamWhere,
      attributes: ["id"],
    });
    const teamIds = teamMembers.map((m) => m.id);

    const leaveRequests = await LeaveRequest.findAll({
      where: {
        userId: { [Op.in]: teamIds },
        status: "approved",
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName"],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name"],
            },
          ],
        },
        { model: LeaveType, as: "leaveType" },
      ],
      attributes: {
        exclude: [
          "reason",
          "rejectionReason",
          "contactAddress",
          "contactPhone",
        ],
      },
      order: [["startDate", "DESC"]],
    });

    res.json(leaveRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Confirm leave request (admin marks as processed in university system)
// @route   PUT /api/leave-requests/:id/confirm
// @access  Private/Admin
const confirmLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveLifecycle.transition(
      req.params.id,
      "confirm",
      req.user,
      { note: req.body.note }
    );
    res.json({ message: "ยืนยันการลงข้อมูลเรียบร้อยแล้ว", leaveRequest });
  } catch (error) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get pending leave requests (for approvers: head, dean, vp, admin)
// @route   GET /api/leave-requests/pending
// @access  Private/Supervisor
const getPendingLeaveRequests = async (req, res) => {
  try {
    const role = req.user.role;
    let whereClause = {};
    let userWhere = {};

    if (role === "head") {
      whereClause.status = "pending";
      const userDeptId = req.user.departmentId;
      if (!userDeptId) {
        return res.status(400).json({
          message: "ผู้ใช้ไม่มีสังกัดหน่วยงาน ไม่สามารถอนุมัติใบลาได้",
        });
      }
      userWhere.departmentId = userDeptId;
    } else if (role === "dean") {
      whereClause.status = "pending_dean";
    } else if (role === "vp") {
      whereClause.status = "pending_vp";
    } else if (role === "admin") {
      if (req.query.status) {
        whereClause.status = req.query.status;
      } else {
        whereClause.status = {
          [Op.in]: ["pending", "pending_dean", "pending_vp"],
        };
      }
    }

    const leaveRequests = await LeaveRequest.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "user",
          where: userWhere,
          attributes: [
            "id",
            "employeeId",
            "firstName",
            "lastName",
            "position",
            "profileImage",
            "departmentId",
            "signatureImage",
            "documentNumber",
            "phone",
          ],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name", "facultyId"],
              include: [
                {
                  model: Faculty,
                  as: "faculty",
                  attributes: ["id", "name"],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: "headApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "deanApprover",
          attributes: approverAttributes,
        },
        {
          model: User,
          as: "vpApprover",
          attributes: approverAttributes,
        },
        { model: LeaveType, as: "leaveType" },
        { model: LeaveAttachment, as: "attachments" },
        {
          model: LeaveHistory,
          as: "history",
          include: [
            {
              model: User,
              as: "actor",
              attributes: ["id", "firstName", "lastName", "role"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(leaveRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Approve leave request (department head, dean, vp)
// @route   PUT /api/leave-requests/:id/approve
// @access  Private/Supervisor
const approveLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveLifecycle.transition(
      req.params.id,
      "approve",
      req.user,
      {
        note: req.body.note || req.body.comment,
        comment: req.body.comment || req.body.note,
        decision: req.body.decision,
      }
    );
    res.json({ message: "อนุมัติคำขอลาเรียบร้อยแล้ว", leaveRequest });
  } catch (error) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Reject leave request (department head, dean, vp)
// @route   PUT /api/leave-requests/:id/reject
// @access  Private/Supervisor
const rejectLeaveRequest = async (req, res) => {
  try {
    const leaveRequest = await LeaveLifecycle.transition(
      req.params.id,
      "reject",
      req.user,
      { reason: req.body.reason || req.body.note }
    );
    res.json({ message: "ปฏิเสธคำขอลาเรียบร้อยแล้ว", leaveRequest });
  } catch (error) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  createLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  cancelLeaveRequest,
  updateLeaveRequest,
  getTeamLeaveRequests,
  confirmLeaveRequest,
  getPendingLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
};
