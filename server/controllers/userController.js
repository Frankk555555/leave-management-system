const {
  User,
  LeaveBalance,
  LeaveType,
  Department,
  LeaveRequest,
  LeaveHistory,
  Notification,
} = require("../models");
const { Op } = require("sequelize");
const { getFiscalYear } = require("../services/leaveValidationService");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../config/cloudinary");
const {
  UserIngestion,
  IngestionError,
  createLeaveBalancesForUser,
} = require("../services/userIngestionService");

/**
 * Helper to delete files from Cloudinary or local disk
 */
const deleteFile = async (filePath) => {
  if (!filePath) return;
  try {
    if (
      filePath.includes("cloudinary.com") ||
      filePath.includes("res.cloudinary.com")
    ) {
      const parts = filePath.split("/");
      const filenameWithExt = parts[parts.length - 1];
      const folderName = parts[parts.length - 2];
      const filename = filenameWithExt.split(".")[0];
      const publicId = `${folderName}/${filename}`;
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    } else {
      const localPath = path.join(__dirname, "..", filePath.replace(/^\//, ""));
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }
  } catch (err) {
    console.error("Error deleting file:", err);
  }
};

/**
 * Helper: สร้าง include สำหรับ leaveBalances (ปีปัจจุบัน + LeaveType)
 */
const getLeaveBalancesInclude = () => {
  const currentYear = getFiscalYear();
  return {
    model: LeaveBalance,
    as: "leaveBalances",
    where: { year: currentYear },
    required: false,
    include: [
      {
        model: LeaveType,
        as: "leaveType",
        attributes: ["id", "name", "code", "defaultDays"],
      },
    ],
  };
};

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: {
        exclude: [
          "password",
          "signatureImage",
          "resetPasswordToken",
          "resetPasswordExpires",
        ],
      },
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        getLeaveBalancesInclude(),
        {
          model: Department,
          as: "department",
        },
      ],
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [
        {
          model: User,
          as: "supervisor",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        getLeaveBalancesInclude(),
        {
          model: Department,
          as: "department",
        },
      ],
    });

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
const createUser = async (req, res) => {
  try {
    const {
      employeeId,
      firstName,
      lastName,
      email,
      password,
      departmentId,
      position,
      personnelType,
      role,
      supervisorId,
      governmentDivision,
      documentNumber,
      unit,
      affiliation,
    } = req.body;

    const safeDepartmentId = departmentId === "" ? null : departmentId;
    const safeSupervisorId = supervisorId === "" ? null : supervisorId;

    let finalEmployeeId = employeeId;
    if (!finalEmployeeId || finalEmployeeId.trim() === "") {
      const currentYear = new Date().getFullYear();
      const buddhistYear = currentYear + 543;
      const yearPrefix = buddhistYear.toString();

      const latestUser = await User.findOne({
        where: {
          employeeId: {
            [Op.like]: `${yearPrefix}%`,
          },
        },
        order: [["employeeId", "DESC"]],
      });

      if (latestUser) {
        const latestId = latestUser.employeeId;
        const numberPart = latestId.substring(yearPrefix.length);
        const nextNumber = parseInt(numberPart, 10) + 1;
        finalEmployeeId = `${yearPrefix}${nextNumber.toString().padStart(3, "0")}`;
      } else {
        finalEmployeeId = `${yearPrefix}001`;
      }
    }

    const userExistsConditions = [{ email }];
    if (finalEmployeeId) {
      userExistsConditions.push({ employeeId: finalEmployeeId });
    }

    const userExists = await User.findOne({
      where: {
        [Op.or]: userExistsConditions,
      },
    });

    if (userExists) {
      return res
        .status(400)
        .json({ message: "User already exists (email or employee ID)" });
    }

    const user = await User.create({
      employeeId: finalEmployeeId,
      firstName,
      lastName,
      email,
      password,
      departmentId: safeDepartmentId,
      position,
      personnelType: personnelType || "university_employee_academic",
      role: role || "employee",
      supervisorId: safeSupervisorId,
      governmentDivision,
      documentNumber,
      unit,
      affiliation,
    });

    await createLeaveBalancesForUser(user.id);

    const userWithBalance = await User.findByPk(user.id, {
      include: [
        getLeaveBalancesInclude(),
        { model: Department, as: "department" },
      ],
    });

    res.status(201).json({
      id: user.id,
      employeeId: user.employeeId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      department: userWithBalance.department,
      position: user.position,
      personnelType: user.personnelType,
      role: user.role,
      leaveBalances: userWithBalance.leaveBalances,
    });
  } catch (error) {
    if (
      error.name === "SequelizeValidationError" ||
      error.name === "SequelizeUniqueConstraintError"
    ) {
      const isEmail = error.errors?.some(
        (e) => e.path === "email" || e.validatorKey === "isEmail"
      );
      if (isEmail) {
        return res.status(400).json({
          message:
            "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลอีกครั้ง (เช่น user@bru.ac.th)",
        });
      }
      const isEmployeeIdUnique = error.errors?.some(
        (e) => e.path === "employee_id" || e.path === "employeeId"
      );
      if (isEmployeeIdUnique) {
        return res.status(400).json({
          message: "รหัสบุคลากรนี้มีอยู่ในระบบแล้ว",
        });
      }
      const isEmailUnique = error.errors?.some((e) => e.path === "email");
      if (isEmailUnique) {
        return res.status(400).json({
          message: "อีเมลนี้มีอยู่ในระบบแล้ว",
        });
      }
      const messages =
        error.errors?.map((e) => e.message).join(", ") || "ข้อมูลไม่ถูกต้อง";
      return res.status(400).json({ message: messages });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [getLeaveBalancesInclude()],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      firstName,
      lastName,
      email,
      departmentId,
      position,
      personnelType,
      role,
      supervisorId,
      startDate,
      governmentDivision,
      documentNumber,
      unit,
      affiliation,
      leaveBalances,
    } = req.body;

    const safeDepartmentId = departmentId === "" ? null : departmentId;
    const safeSupervisorId = supervisorId === "" ? null : supervisorId;
    const safeStartDate = startDate === "" ? null : startDate;

    await user.update({
      firstName: firstName || user.firstName,
      lastName: lastName || user.lastName,
      email: email || user.email,
      departmentId:
        safeDepartmentId !== undefined ? safeDepartmentId : user.departmentId,
      position: position || user.position,
      personnelType:
        personnelType !== undefined ? personnelType : user.personnelType,
      role: role || user.role,
      supervisorId:
        safeSupervisorId !== undefined ? safeSupervisorId : user.supervisorId,
      startDate: safeStartDate !== undefined ? safeStartDate : user.startDate,
      governmentDivision:
        governmentDivision !== undefined
          ? governmentDivision
          : user.governmentDivision,
      documentNumber:
        documentNumber !== undefined ? documentNumber : user.documentNumber,
      unit: unit !== undefined ? unit : user.unit,
      affiliation: affiliation !== undefined ? affiliation : user.affiliation,
    });

    if (leaveBalances && Array.isArray(leaveBalances)) {
      const currentYear = getFiscalYear();
      for (const lb of leaveBalances) {
        if (lb.leaveTypeId) {
          await LeaveBalance.upsert({
            userId: user.id,
            leaveTypeId: lb.leaveTypeId,
            year: lb.year || currentYear,
            totalDays: lb.totalDays,
            usedDays: lb.usedDays || 0,
            carriedOverDays: lb.carriedOverDays || 0,
          });
        }
      }
    }

    const updatedUser = await User.findByPk(user.id, {
      include: [
        getLeaveBalancesInclude(),
        { model: Department, as: "department" },
      ],
    });

    res.json(updatedUser);
  } catch (error) {
    if (
      error.name === "SequelizeValidationError" ||
      error.name === "SequelizeUniqueConstraintError"
    ) {
      const isEmail = error.errors?.some(
        (e) => e.path === "email" || e.validatorKey === "isEmail"
      );
      if (isEmail) {
        return res.status(400).json({
          message:
            "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีเมลอีกครั้ง (เช่น user@bru.ac.th)",
        });
      }
      const isEmployeeIdUnique = error.errors?.some(
        (e) => e.path === "employee_id" || e.path === "employeeId"
      );
      if (isEmployeeIdUnique) {
        return res.status(400).json({
          message: "รหัสบุคลากรนี้มีอยู่ในระบบแล้ว",
        });
      }
      const isEmailUnique = error.errors?.some((e) => e.path === "email");
      if (isEmailUnique) {
        return res.status(400).json({
          message: "อีเมลนี้มีอยู่ในระบบแล้ว",
        });
      }
      const messages =
        error.errors?.map((e) => e.message).join(", ") || "ข้อมูลไม่ถูกต้อง";
      return res.status(400).json({ message: messages });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await LeaveRequest.update(
      { approvedBy: null },
      { where: { approvedBy: user.id } }
    );
    await LeaveRequest.update(
      { confirmedBy: null },
      { where: { confirmedBy: user.id } }
    );

    const userLeaveRequests = await LeaveRequest.findAll({
      where: { userId: user.id },
    });
    const leaveRequestIds = userLeaveRequests.map((req) => req.id);

    await LeaveBalance.destroy({ where: { userId: user.id } });
    await Notification.destroy({ where: { userId: user.id } });

    if (leaveRequestIds.length > 0) {
      await LeaveHistory.destroy({
        where: { leaveRequestId: leaveRequestIds },
      });
      const { LeaveAttachment } = require("../models");
      const attachments = await LeaveAttachment.findAll({
        where: { leaveRequestId: leaveRequestIds },
      });
      for (const attachment of attachments) {
        await deleteFile(attachment.filePath);
      }
      await LeaveAttachment.destroy({
        where: { leaveRequestId: leaveRequestIds },
      });
    }

    await deleteFile(user.profileImage);
    await deleteFile(user.signatureImage);

    await LeaveRequest.destroy({ where: { userId: user.id } });

    await User.update(
      { supervisorId: null },
      { where: { supervisorId: user.id } }
    );

    await user.destroy();
    res.json({ message: "User removed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Get supervisors
// @route   GET /api/users/supervisors
// @access  Private
const getSupervisors = async (req, res) => {
  try {
    const supervisors = await User.findAll({
      where: {
        role: { [Op.in]: ["head", "admin"] },
        isActive: true,
      },
      attributes: [
        "id",
        "employeeId",
        "firstName",
        "lastName",
        "email",
        "departmentId",
      ],
      include: [{ model: Department, as: "department" }],
    });
    res.json(supervisors);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update own profile (for regular users)
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      governmentDivision,
      documentNumber,
      departmentId,
      unit,
      affiliation,
    } = req.body;

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (departmentId !== undefined && departmentId !== "")
      user.departmentId = departmentId;
    if (governmentDivision !== undefined)
      user.governmentDivision = governmentDivision;
    if (documentNumber !== undefined) user.documentNumber = documentNumber;
    if (unit !== undefined) user.unit = unit;
    if (affiliation !== undefined) user.affiliation = affiliation;

    if (password && password.trim() !== "") {
      if (password.length < 8) {
        return res
          .status(400)
          .json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
      }
      const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)/;
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message:
            "รหัสผ่านต้องประกอบด้วยตัวอักษรและตัวเลขอย่างน้อยอย่างละ 1 ตัว",
        });
      }
      user.password = password;
    }

    await user.save();

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password"] },
      include: [
        getLeaveBalancesInclude(),
        { model: Department, as: "department" },
      ],
    });

    res.json({ message: "อัปเดตโปรไฟล์เรียบร้อยแล้ว", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update profile image
// @route   PUT /api/users/profile/image
// @access  Private
const updateProfileImage = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "กรุณาอัปโหลดรูปภาพ" });
    }

    user.profileImage =
      req.file.path && req.file.path.startsWith("http")
        ? req.file.path
        : `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.json({
      message: "อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว",
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error("Error updating profile image:", error);
    res.status(500).json({
      message: error.message || "เกิดข้อผิดพลาดในการบันทึกรูปโปรไฟล์",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Update signature image
// @route   PUT /api/users/profile/signature
// @access  Private
const updateSignatureImage = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: "กรุณาอัปโหลดรูปลงนาม (ลายเซ็นต์)" });
    }

    user.signatureImage =
      req.file.path && req.file.path.startsWith("http")
        ? req.file.path
        : `/uploads/signatures/${req.file.filename}`;
    await user.save();

    res.json({
      message: "อัปเดตลายเซ็นต์เรียบร้อยแล้ว",
      signatureImage: user.signatureImage,
    });
  } catch (error) {
    console.error("Error updating signature image:", error);
    res.status(500).json({
      message: error.message || "เกิดข้อผิดพลาดในการบันทึกลายเซ็นต์",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Reset user password (Admin only)
// @route   PUT /api/users/:id/reset-password
// @access  Private/Admin
const resetUserPassword = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    const { newPassword } = req.body;

    if (!newPassword || newPassword.trim() === "") {
      return res.status(400).json({ message: "กรุณากรอกรหัสผ่านใหม่" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        message:
          "รหัสผ่านต้องประกอบด้วยตัวอักษรและตัวเลขอย่างน้อยอย่างละ 1 ตัว",
      });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "รีเซ็ตรหัสผ่านเรียบร้อยแล้ว" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ==================== User Ingestion & External Sync Delegations ====================

// @desc    Import users from CSV/Excel file
// @route   POST /api/users/import
// @access  Private/Admin
const importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
    }
    const result = await UserIngestion.importFile({
      filePath: req.file.path,
      originalName: req.file.originalname,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof IngestionError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Preview users from CSV/Excel file before import
// @route   POST /api/users/import-preview
// @access  Private/Admin
const previewImportFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "กรุณาอัปโหลดไฟล์" });
    }
    const result = await UserIngestion.previewFile({
      filePath: req.file.path,
      originalName: req.file.originalname,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof IngestionError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Import file preview error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการอ่านไฟล์",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Preview database connection & select query columns
// @route   POST /api/users/import-db-preview
// @access  Private/Admin
const previewDbSync = async (req, res) => {
  try {
    const result = await UserIngestion.previewDbSync(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof IngestionError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Database preview error:", error);
    res.status(500).json({
      message: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Sync user data from database with field mapping
// @route   POST /api/users/import-db-sync
// @access  Private/Admin
const executeDbSync = async (req, res) => {
  try {
    const result = await UserIngestion.executeDbSync(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof IngestionError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Database sync error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการซิงค์ฐานข้อมูล",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Preview external API endpoint data
// @route   POST /api/users/import-api-preview
// @access  Private/Admin
const previewApiSync = async (req, res) => {
  try {
    const result = await UserIngestion.previewApiSync(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof IngestionError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("API preview error:", error);
    res.status(500).json({
      message: "ไม่สามารถเชื่อมต่อ API ได้",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Sync user data from API endpoint with field mapping
// @route   POST /api/users/import-api-sync
// @access  Private/Admin
const executeApiSync = async (req, res) => {
  try {
    const result = await UserIngestion.executeApiSync(req.body);
    res.json(result);
  } catch (error) {
    if (error instanceof IngestionError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("API sync error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการซิงค์ API",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// @desc    Download Excel template with dropdowns for importing users
// @route   GET /api/users/import-template
// @access  Private/Admin
const downloadImportTemplate = async (req, res) => {
  try {
    await UserIngestion.generateImportTemplate(res);
  } catch (error) {
    console.error("Error generating import template:", error);
    res.status(500).json({
      message: "Failed to generate template",
      error: error.message,
    });
  }
};

// @desc    Mock university database staff directory API
// @route   GET /api/users/mock-university-api
// @access  Private/Admin
const getMockUniversityApi = async (req, res) => {
  const mockUsers = UserIngestion.getMockUniversityApi();
  res.json(mockUsers);
};

// @desc    Setup & Seed mock_university_personnel table in local DB for testing sync
// @route   POST /api/users/setup-mock-db
// @access  Private/Admin
const setupMockDb = async (req, res) => {
  try {
    const result = await UserIngestion.setupMockDb();
    res.json(result);
  } catch (error) {
    console.error("Setup mock DB error:", error);
    res.status(500).json({
      message: "เกิดข้อผิดพลาดในการตั้งค่าตารางจำลอง",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getSupervisors,
  updateProfile,
  updateProfileImage,
  updateSignatureImage,
  resetUserPassword,
  importUsers,
  previewDbSync,
  executeDbSync,
  previewApiSync,
  executeApiSync,
  getMockUniversityApi,
  setupMockDb,
  previewImportFile,
  downloadImportTemplate,
};
