const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const {
  User,
  LeaveBalance,
  LeaveType,
  Department,
  Faculty,
} = require("../models");
const { Op } = require("sequelize");
const { getFiscalYear } = require("../services/leaveValidationService");

// Generate JWT - Reduced expiry for better security
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d", // Reduced from 30d for security
  });
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

// Note: User registration is handled by admin only via userController.createUser
// See routes/users.js and controllers/userController.js

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user with associations
    const user = await User.findOne({
      where: { email },
      include: [
        getLeaveBalancesInclude(),
        {
          model: Department,
          as: "department",
        },
      ],
    });

    if (!user) {
      return res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: "บัญชีนี้ถูกระงับการใช้งาน" });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (isPasswordValid) {
      const token = generateToken(user.id);

      // Set JWT in HttpOnly cookie
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // secure in prod
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // allows cross-site cookies in prod
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        id: user.id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        department: user.department,
        position: user.position,
        personnelType: user.personnelType,
        role: user.role,
        leaveBalances: user.leaveBalances,
        governmentDivision: user.governmentDivision,
        documentNumber: user.documentNumber,
        unit: user.unit,
        affiliation: user.affiliation,
        startDate: user.startDate,
        profileImage: user.profileImage,
        token, // Included for cross-domain / iOS ITP Bearer fallback
      });
    } else {
      res.status(401).json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
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
          include: [
            {
              model: Faculty,
              as: "faculty",
            },
          ],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      // For security, don't confirm if the email exists, but tell the user we sent the link anyway
      return res.status(200).json({
        message: "ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลที่ระบุเรียบร้อยแล้ว (หากมีอีเมลนี้ในระบบ)",
      });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Set token expiration (15 minutes)
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // Save to user model
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = expires;
    await user.save();

    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    // In development only: print reset URL to console for testing
    // In production: only log a safe summary (no full token) for security
    if (process.env.NODE_ENV === "development") {
      console.log(`\n==================================================`);
      console.log(`[PASSWORD RESET - DEV] Link for ${user.email}:`);
      console.log(`${resetUrl}`);
      console.log(`==================================================\n`);
    } else {
      const maskedEmail = user.email.replace(/(.)(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(b.length) + c);
      console.log(`[PASSWORD RESET] Token generated for ${maskedEmail} (token: ${token.substring(0, 8)}...)`);
    }

    // Dispatch reset email to background queue (Non-blocking)
    const { queuePasswordResetEmail } = require("../services/emailService");
    await queuePasswordResetEmail(user.email, resetUrl);

    res.json({
      message: "ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลที่ระบุเรียบร้อยแล้ว (หากมีอีเมลนี้ในระบบ)",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "ไม่พบ Token สำหรับตั้งรหัสผ่านใหม่" });
    }

    if (!password || password.trim() === "") {
      return res.status(400).json({ message: "กรุณากรอกรหัสผ่านใหม่" });
    }

    // Passwords must be at least 8 characters
    if (password.length < 8) {
      return res.status(400).json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }

    // Password regex (at least one letter, one digit)
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message: "รหัสผ่านต้องประกอบด้วยตัวอักษรและตัวเลขอย่างน้อยอย่างละ 1 ตัว",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by valid token and expiration
    const user = await User.findOne({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    // Update password
    user.password = password; // Hashed by hook
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "ตั้งรหัสผ่านใหม่เสร็จเรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    expires: new Date(0),
  });
  res.json({ message: "ออกจากระบบสำเร็จ" });
};

module.exports = { login, getMe, forgotPassword, resetPassword, logout };
