const jwt = require("jsonwebtoken");
const { User, LeaveBalance, LeaveType, Department } = require("../models");
const { getFiscalYear } = require("../services/leaveValidationService");

const protect = async (req, res, next) => {
  let token;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const currentYear = getFiscalYear();

      // Find basic user info (Removed heavy LeaveBalance join for performance)
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
        include: [
          {
            model: Department,
            as: "department",
          },
        ],
      });

      if (!req.user) {
        return res.status(401).json({ message: "ไม่พบผู้ใช้ในระบบ" });
      }

      if (!req.user.isActive) {
        return res.status(401).json({ message: "บัญชีผู้ใช้ถูกปิดใช้งาน" });
      }

      return next();
    } catch (error) {
      console.error("Auth error:", error.message);
      
      // If error is related to JWT, it means the token is invalid/expired
      if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token ไม่ถูกต้องหรือหมดอายุ" });
      }
      
      // Otherwise, it might be a database error (e.g. connection lost). 
      // Do not return 401, as it will force the user to log out.
      return res.status(500).json({ message: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "กรุณาเข้าสู่ระบบก่อน" });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Not authorized as admin" });
  }
};

const supervisor = (req, res, next) => {
  if (
    req.user &&
    ["head", "dean", "vp", "admin"].includes(req.user.role)
  ) {
    next();
  } else {
    res.status(403).json({ message: "ไม่มีสิทธิ์เข้าถึงส่วนการอนุมัติคำขอลา" });
  }
};

const approver = supervisor;

module.exports = { protect, admin, supervisor, approver };
