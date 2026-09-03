const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;
const axios = require("axios");
const ssrfFilter = require("ssrf-req-filter");
const ExcelJS = require("exceljs");
const { Op, QueryTypes } = require("sequelize");
const {
  User,
  LeaveBalance,
  LeaveType,
  Department,
  Faculty,
} = require("../models");
const { sequelize } = require("../config/database");
const { getFiscalYear } = require("./leaveValidationService");

class IngestionError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "IngestionError";
    this.statusCode = statusCode;
  }
}

/**
 * Check that a SQL query is a plain, read-only SELECT with no
 * file-writing or file-reading side effects.
 */
const isReadOnlySelectQuery = (query) => {
  if (typeof query !== "string") return false;
  const trimmed = query.trim();
  if (!trimmed.toUpperCase().startsWith("SELECT")) return false;

  const dangerousPatterns = /\b(INTO\s+(OUT|DUMP)FILE|LOAD_FILE)\b/i;
  if (dangerousPatterns.test(trimmed)) return false;

  return true;
};

/**
 * Check if URL is safe from SSRF (prevent access to private/internal IPs)
 */
const isSSRFSafeUrl = async (urlString) => {
  try {
    const parsedUrl = new URL(urlString);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return false;
    }

    const hostname = parsedUrl.hostname;
    const lookupResult = await dns.lookup(hostname);
    const ip = lookupResult.address;

    if (
      ip === "127.0.0.1" ||
      ip === "0.0.0.0" ||
      ip === "169.254.169.254" ||
      ip === "::1" ||
      ip.startsWith("10.") ||
      ip.startsWith("192.168.") ||
      /^(172\.(1[6-9]|2\d|3[0-1])\.)/.test(ip) ||
      /^fc00:/i.test(ip) ||
      /^fe80:/i.test(ip)
    ) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Extract clean string from ExcelJS cell
 */
const getCellValueString = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  if (cell.value instanceof Date) {
    return cell.value.toISOString().split("T")[0];
  }
  if (typeof cell.value === "object") {
    if (cell.value.result !== undefined) {
      if (cell.value.result instanceof Date) {
        return cell.value.result.toISOString().split("T")[0];
      }
      return String(cell.value.result).trim();
    }
    if (cell.value.text !== undefined) return String(cell.value.text).trim();
    if (Array.isArray(cell.value.richText)) {
      return cell.value.richText
        .map((rt) => rt.text || "")
        .join("")
        .trim();
    }
    return JSON.stringify(cell.value);
  }
  return String(cell.value).trim();
};

/**
 * Resolve Department ID from ID, Code, or Name
 */
const resolveDepartment = async (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const cleanValue = String(value).trim();

  const numericId = parseInt(cleanValue, 10);
  if (!isNaN(numericId)) {
    const dept = await Department.findByPk(numericId);
    if (dept) return dept.id;
  }

  const dept = await Department.findOne({
    where: {
      [Op.or]: [{ code: cleanValue }, { name: cleanValue }],
    },
  });
  if (dept) return dept.id;

  return null;
};

/**
 * Resolve Supervisor ID from ID, Email, or EmployeeID
 */
const resolveSupervisor = async (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const cleanValue = String(value).trim();

  const numericId = parseInt(cleanValue, 10);
  if (!isNaN(numericId)) {
    const sup = await User.findByPk(numericId);
    if (sup) return sup.id;
  }

  const sup = await User.findOne({
    where: {
      [Op.or]: [{ email: cleanValue }, { employeeId: cleanValue }],
    },
  });
  if (sup) return sup.id;

  return null;
};

/**
 * Normalize and auto-detect personnel type (5 categories from scope 1.4.2)
 */
const normalizePersonnelType = (raw, position = "") => {
  const text = `${raw || ""} ${position || ""}`.toLowerCase().trim();
  if (text.includes("ข้าราชการ")) {
    if (
      text.includes("สนับสนุน") ||
      text.includes("บริหาร") ||
      text.includes("ปฏิบัติการ")
    ) {
      return "civil_servant_support";
    }
    return "civil_servant_academic";
  }
  if (
    text.includes("อาจารย์อัตราจ้าง") ||
    text.includes("อัตราจ้าง") ||
    text === "contract_lecturer"
  ) {
    return "contract_lecturer";
  }
  if (
    text.includes("ลูกจ้างชั่วคราว") ||
    text.includes("ชั่วคราว") ||
    text === "temporary_employee"
  ) {
    return "temporary_employee";
  }
  if (
    text.includes("พนักงานมหาวิทยาลัย") ||
    text.includes("พนักงาน") ||
    text.includes("univ_")
  ) {
    if (
      text.includes("สนับสนุน") ||
      text.includes("เจ้าหน้าที่") ||
      text.includes("ปฏิบัติการ") ||
      text === "university_employee_support"
    ) {
      return "university_employee_support";
    }
    return "university_employee_academic";
  }
  if (text === "civil_servant_academic") return "civil_servant_academic";
  if (text === "civil_servant_support") return "civil_servant_support";
  if (text === "university_employee_academic") return "university_employee_academic";
  if (text === "university_employee_support") return "university_employee_support";

  return "university_employee_academic";
};

/**
 * Create initial leave balances for a newly registered or imported user
 */
const createLeaveBalancesForUser = async (userId) => {
  const leaveTypes = await LeaveType.findAll({ where: { isActive: true } });
  const currentYear = getFiscalYear();

  await Promise.all(
    leaveTypes.map((lt) =>
      LeaveBalance.findOrCreate({
        where: { userId, leaveTypeId: lt.id, year: currentYear },
        defaults: {
          totalDays: lt.defaultDays,
          usedDays: 0,
          carriedOverDays: 0,
        },
      })
    )
  );
};

/**
 * Deep Module: UserIngestion
 * Consolidates file ingestion, external database synchronization, REST API sync,
 * security validations, and template builders.
 */
const UserIngestion = {
  isReadOnlySelectQuery,
  isSSRFSafeUrl,
  resolveDepartment,
  resolveSupervisor,
  getCellValueString,
  createLeaveBalancesForUser,

  /**
   * Preview rows and columns from uploaded CSV or Excel file
   */
  async previewFile({ filePath, originalName }) {
    if (!filePath) {
      throw new IngestionError("กรุณาอัปโหลดไฟล์", 400);
    }

    const workbook = new ExcelJS.Workbook();
    const fileExtension = originalName.split(".").pop().toLowerCase();

    if (fileExtension === "csv") {
      await workbook.csv.readFile(filePath, {
        parserOptions: { encoding: "utf8" },
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      await workbook.xlsx.readFile(filePath);
    } else {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new IngestionError("รองรับเฉพาะไฟล์ .csv, .xlsx, .xls", 400);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new IngestionError("ไม่พบข้อมูลในไฟล์", 400);
    }

    const headerRow = worksheet.getRow(1);
    const columns = [];
    const colMap = {};

    headerRow.eachCell((cell, colNumber) => {
      const value = cell.value?.toString().trim();
      if (value) {
        columns.push(value);
        colMap[colNumber] = value;
      }
    });

    const preview = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData = {};
      let hasData = false;

      Object.keys(colMap).forEach((colNumStr) => {
        const colNumber = parseInt(colNumStr, 10);
        const colName = colMap[colNumber];
        const val = getCellValueString(row.getCell(colNumber));
        rowData[colName] = val;
        if (val) hasData = true;
      });

      if (hasData) {
        preview.push(rowData);
      }
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      message: "อ่านไฟล์สำเร็จ",
      columns,
      preview,
    };
  },

  /**
   * Import users from CSV or Excel file
   */
  async importFile({ filePath, originalName }) {
    if (!filePath) {
      throw new IngestionError("กรุณาอัปโหลดไฟล์", 400);
    }

    const workbook = new ExcelJS.Workbook();
    const fileExtension = originalName.split(".").pop().toLowerCase();

    if (fileExtension === "csv") {
      await workbook.csv.readFile(filePath, {
        parserOptions: { encoding: "utf8" },
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      await workbook.xlsx.readFile(filePath);
    } else {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new IngestionError("รองรับเฉพาะไฟล์ .csv, .xlsx, .xls", 400);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new IngestionError("ไม่พบข้อมูลในไฟล์", 400);
    }

    const results = {
      success: [],
      failed: [],
    };

    const headerRow = worksheet.getRow(1);
    const headers = {};
    headerRow.eachCell((cell, colNumber) => {
      let value = cell.value?.toString().toLowerCase().trim();
      if (value) {
        value = value.replace(/\s*\(.*?\)\s*/g, "");
        headers[value] = colNumber;
      }
    });

    const requiredFields = ["firstname", "lastname", "email", "position"];
    const missingFields = requiredFields.filter((f) => !headers[f]);
    if (missingFields.length > 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new IngestionError(
        `ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.join(", ")}`,
        400
      );
    }

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData = {};

      const testEmail = headers["email"]
        ? getCellValueString(row.getCell(headers["email"]))
        : "";
      if (!testEmail) continue;

      let parsedEmpId = headers["employeeid"]
        ? getCellValueString(row.getCell(headers["employeeid"]))
        : "";
      rowData.firstName = getCellValueString(row.getCell(headers["firstname"]));
      rowData.lastName = getCellValueString(row.getCell(headers["lastname"]));
      rowData.email = getCellValueString(row.getCell(headers["email"]));
      rowData.password = headers["password"]
        ? getCellValueString(row.getCell(headers["password"]))
        : "";
      rowData.position = getCellValueString(row.getCell(headers["position"]));
      rowData.role = headers["role"]
        ? getCellValueString(row.getCell(headers["role"])) || "employee"
        : "employee";
      rowData.phone = headers["phone"]
        ? getCellValueString(row.getCell(headers["phone"]))
        : null;
      rowData.startDate = headers["startdate"]
        ? getCellValueString(row.getCell(headers["startdate"]))
        : null;
      rowData.governmentDivision = headers["governmentdivision"]
        ? getCellValueString(row.getCell(headers["governmentdivision"]))
        : null;
      rowData.documentNumber = headers["documentnumber"]
        ? getCellValueString(row.getCell(headers["documentnumber"]))
        : null;
      rowData.unit = headers["unit"]
        ? getCellValueString(row.getCell(headers["unit"]))
        : null;
      rowData.affiliation = headers["affiliation"]
        ? getCellValueString(row.getCell(headers["affiliation"]))
        : null;

      const rawPersonnelType = headers["personneltype"]
        ? getCellValueString(row.getCell(headers["personneltype"]))
        : null;
      rowData.personnelType = normalizePersonnelType(
        rawPersonnelType,
        rowData.position
      );

      const rawDept = headers["departmentid"]
        ? row.getCell(headers["departmentid"])?.value
        : null;
      const rawSup = headers["supervisorid"]
        ? row.getCell(headers["supervisorid"])?.value
        : null;
      rowData.departmentId = await resolveDepartment(rawDept);
      rowData.supervisorId = await resolveSupervisor(rawSup);

      if (!parsedEmpId || parsedEmpId.trim() === "") {
        const currentYear = new Date().getFullYear();
        const buddhistYear = currentYear + 543;
        const yearPrefix = buddhistYear.toString();

        const latestUser = await User.findOne({
          where: { employeeId: { [Op.like]: `${yearPrefix}%` } },
          order: [["employeeId", "DESC"]],
        });

        const inMemoryLatest =
          results.success
            .filter((u) => u.employeeId && u.employeeId.startsWith(yearPrefix))
            .map((u) => parseInt(u.employeeId.substring(yearPrefix.length), 10))
            .filter((n) => !isNaN(n))
            .sort((a, b) => b - a)[0] || 0;

        let dbLatestNumber = 0;
        if (latestUser) {
          const numberPart = latestUser.employeeId.substring(yearPrefix.length);
          dbLatestNumber = parseInt(numberPart, 10) || 0;
        }

        const nextNumber = Math.max(dbLatestNumber, inMemoryLatest) + 1;
        parsedEmpId = `${yearPrefix}${nextNumber.toString().padStart(3, "0")}`;
      }
      rowData.employeeId = parsedEmpId;

      const missingRowFields = [];
      if (!rowData.firstName) missingRowFields.push("firstName");
      if (!rowData.lastName) missingRowFields.push("lastName");
      if (!rowData.email) missingRowFields.push("email");
      if (!rowData.position) missingRowFields.push("position");

      if (missingRowFields.length > 0) {
        results.failed.push({
          row: rowNumber,
          employeeId: rowData.employeeId || "-",
          reason: `ข้อมูลไม่ครบ: ${missingRowFields.join(", ")}`,
        });
        continue;
      }

      const validRoles = ["employee", "head", "admin"];
      if (!validRoles.includes(rowData.role)) {
        rowData.role = "employee";
      }

      let passwordToUse = rowData.password;
      let isPasswordGenerated = false;
      if (!passwordToUse) {
        const randomNum = Math.floor(100 + Math.random() * 900);
        passwordToUse = `Welcome@2026${randomNum}`;
        isPasswordGenerated = true;
      }

      try {
        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              { email: rowData.email },
              { employeeId: rowData.employeeId },
            ],
          },
        });

        if (existingUser) {
          await existingUser.update({
            firstName: rowData.firstName,
            lastName: rowData.lastName,
            email: rowData.email,
            position: rowData.position,
            personnelType:
              rowData.personnelType || existingUser.personnelType,
            role: rowData.role,
            departmentId: rowData.departmentId || existingUser.departmentId,
            supervisorId: rowData.supervisorId || existingUser.supervisorId,
            phone: rowData.phone || existingUser.phone,
            startDate: rowData.startDate || existingUser.startDate,
            governmentDivision:
              rowData.governmentDivision || existingUser.governmentDivision,
            documentNumber:
              rowData.documentNumber || existingUser.documentNumber,
            unit: rowData.unit || existingUser.unit,
            affiliation: rowData.affiliation || existingUser.affiliation,
          });

          results.success.push({
            row: rowNumber,
            employeeId: rowData.employeeId,
            name: `${rowData.firstName} ${rowData.lastName}`,
            action: "updated",
          });
        } else {
          const user = await User.create({
            employeeId: rowData.employeeId,
            firstName: rowData.firstName,
            lastName: rowData.lastName,
            email: rowData.email,
            password: passwordToUse,
            position: rowData.position,
            personnelType:
              rowData.personnelType || "university_employee_academic",
            role: rowData.role,
            departmentId: rowData.departmentId,
            supervisorId: rowData.supervisorId,
            phone: rowData.phone,
            startDate: rowData.startDate,
            governmentDivision: rowData.governmentDivision,
            documentNumber: rowData.documentNumber,
            unit: rowData.unit,
            affiliation: rowData.affiliation,
          });

          await createLeaveBalancesForUser(user.id);

          results.success.push({
            row: rowNumber,
            employeeId: rowData.employeeId,
            name: `${rowData.firstName} ${rowData.lastName}`,
            action: "created",
            tempPassword: isPasswordGenerated ? passwordToUse : null,
          });
        }
      } catch (error) {
        results.failed.push({
          row: rowNumber,
          employeeId: rowData.employeeId,
          reason: error.message,
        });
      }
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return {
      message: `นำเข้าข้อมูลเสร็จสิ้น: สำเร็จ ${results.success.length} รายการ, ล้มเหลว ${results.failed.length} รายการ`,
      results,
    };
  },

  /**
   * Synchronize list of user objects with field mapping
   */
  async syncUsersList(rows, mapping = {}) {
    const results = {
      success: [],
      failed: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      const rowData = {};

      try {
        rowData.employeeId = mapping.employeeId
          ? String(row[mapping.employeeId] || "").trim()
          : "";
        rowData.firstName = mapping.firstName
          ? String(row[mapping.firstName] || "").trim()
          : "";
        rowData.lastName = mapping.lastName
          ? String(row[mapping.lastName] || "").trim()
          : "";
        rowData.email = mapping.email
          ? String(row[mapping.email] || "").trim()
          : "";
        rowData.position = mapping.position
          ? String(row[mapping.position] || "").trim()
          : "";
        const rawPersonnelType = mapping.personnelType
          ? String(row[mapping.personnelType] || "").trim()
          : "";
        rowData.personnelType = normalizePersonnelType(
          rawPersonnelType,
          rowData.position
        );
        rowData.role = mapping.role
          ? String(row[mapping.role] || "").trim()
          : "employee";
        rowData.phone = mapping.phone
          ? String(row[mapping.phone] || "").trim()
          : null;

        const rawStartDate = mapping.startDate ? row[mapping.startDate] : null;
        if (rawStartDate instanceof Date) {
          rowData.startDate = rawStartDate.toISOString().split("T")[0];
        } else if (rawStartDate) {
          rowData.startDate = String(rawStartDate).trim();
        } else {
          rowData.startDate = null;
        }

        rowData.governmentDivision = mapping.governmentDivision
          ? String(row[mapping.governmentDivision] || "").trim()
          : null;
        rowData.documentNumber = mapping.documentNumber
          ? String(row[mapping.documentNumber] || "").trim()
          : null;
        rowData.unit = mapping.unit
          ? String(row[mapping.unit] || "").trim()
          : null;
        rowData.affiliation = mapping.affiliation
          ? String(row[mapping.affiliation] || "").trim()
          : null;

        const rawDept = mapping.departmentId ? row[mapping.departmentId] : null;
        const rawSup = mapping.supervisorId ? row[mapping.supervisorId] : null;
        rowData.departmentId = await resolveDepartment(rawDept);
        rowData.supervisorId = await resolveSupervisor(rawSup);

        const missingRowFields = [];
        if (!rowData.employeeId) missingRowFields.push("employeeId");
        if (!rowData.firstName) missingRowFields.push("firstName");
        if (!rowData.lastName) missingRowFields.push("lastName");
        if (!rowData.email) missingRowFields.push("email");
        if (!rowData.position) missingRowFields.push("position");

        if (missingRowFields.length > 0) {
          results.failed.push({
            row: rowNumber,
            employeeId: rowData.employeeId || "-",
            reason: `ข้อมูลไม่ครบ: ${missingRowFields.join(", ")}`,
          });
          continue;
        }

        const validRoles = ["employee", "head", "admin"];
        if (!validRoles.includes(rowData.role)) {
          rowData.role = "employee";
        }

        let passwordToUse = mapping.defaultPassword || "Welcome@2026";
        let isPasswordGenerated = false;
        const mappedPass = mapping.password
          ? String(row[mapping.password] || "").trim()
          : "";
        if (mappedPass) {
          passwordToUse = mappedPass;
        } else {
          const randomNum = Math.floor(100 + Math.random() * 900);
          passwordToUse = `Welcome@2026${randomNum}`;
          isPasswordGenerated = true;
        }

        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              { email: rowData.email },
              { employeeId: rowData.employeeId },
            ],
          },
        });

        if (existingUser) {
          await existingUser.update({
            firstName: rowData.firstName,
            lastName: rowData.lastName,
            email: rowData.email,
            position: rowData.position,
            personnelType:
              rowData.personnelType || existingUser.personnelType,
            role: rowData.role,
            departmentId: rowData.departmentId || existingUser.departmentId,
            supervisorId: rowData.supervisorId || existingUser.supervisorId,
            phone: rowData.phone || existingUser.phone,
            startDate: rowData.startDate || existingUser.startDate,
            governmentDivision:
              rowData.governmentDivision || existingUser.governmentDivision,
            documentNumber:
              rowData.documentNumber || existingUser.documentNumber,
            unit: rowData.unit || existingUser.unit,
            affiliation: rowData.affiliation || existingUser.affiliation,
          });

          results.success.push({
            row: rowNumber,
            employeeId: rowData.employeeId,
            name: `${rowData.firstName} ${rowData.lastName}`,
            action: "updated",
          });
        } else {
          const user = await User.create({
            employeeId: rowData.employeeId,
            firstName: rowData.firstName,
            lastName: rowData.lastName,
            email: rowData.email,
            password: passwordToUse,
            position: rowData.position,
            personnelType:
              rowData.personnelType || "university_employee_academic",
            role: rowData.role,
            departmentId: rowData.departmentId,
            supervisorId: rowData.supervisorId,
            phone: rowData.phone,
            startDate: rowData.startDate,
            governmentDivision: rowData.governmentDivision,
            documentNumber: rowData.documentNumber,
            unit: rowData.unit,
            affiliation: rowData.affiliation,
          });

          await createLeaveBalancesForUser(user.id);

          results.success.push({
            row: rowNumber,
            employeeId: rowData.employeeId,
            name: `${rowData.firstName} ${rowData.lastName}`,
            action: "created",
            tempPassword: isPasswordGenerated ? passwordToUse : null,
          });
        }
      } catch (err) {
        results.failed.push({
          row: rowNumber,
          employeeId: rowData.employeeId || "-",
          reason: err.message,
        });
      }
    }

    return results;
  },

  /**
   * Preview external database connection & query
   */
  async previewDbSync(params = {}) {
    const mysql = require("mysql2/promise");

    const query = params.query;
    const config = params.config || {};
    const host = config.host || params.host || process.env.SYNC_DB_HOST;
    const port = config.port || params.port || process.env.SYNC_DB_PORT || 3306;
    const database =
      config.database || params.database || process.env.SYNC_DB_NAME;
    const user = config.user || params.user || process.env.SYNC_DB_USER;
    const password =
      config.password !== undefined
        ? config.password
        : params.password !== undefined
        ? params.password
        : process.env.SYNC_DB_PASSWORD || "";

    if (!host || !database || !user) {
      throw new IngestionError(
        "ไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูลปลายทางที่ฝั่งเซิร์ฟเวอร์",
        500
      );
    }

    if (!query) {
      throw new IngestionError("กรุณาระบุคำสั่ง SQL", 400);
    }

    if (!isReadOnlySelectQuery(query)) {
      throw new IngestionError(
        "Security Policy: อนุญาตเฉพาะคำสั่ง SELECT แบบอ่านอย่างเดียวเท่านั้น",
        403
      );
    }

    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port: parseInt(port, 10),
        database,
        user,
        password,
        connectTimeout: 5000,
      });
    } catch (connErr) {
      if (connErr.code === "ECONNREFUSED") {
        throw new IngestionError(
          `ไม่สามารถเชื่อมต่อไปยัง ${host}:${port} ได้ (Connection Refused) — กรุณาตรวจสอบว่าเปิด MySQL อยู่หรือไม่ และระบุ Port ถูกต้องหรือไม่ (หมายเหตุ: MySQL เครื่องของคุณถูกตั้งไว้ที่พอร์ต ${process.env.DB_PORT || 3307})`,
          400
        );
      }
      if (connErr.code === "ER_ACCESS_DENIED_ERROR") {
        throw new IngestionError(
          `ชื่อผู้ใช้ (Username) หรือรหัสผ่าน (Password) ไม่ถูกต้อง: ${connErr.message}`,
          400
        );
      }
      if (connErr.code === "ER_BAD_DB_ERROR") {
        throw new IngestionError(
          `ไม่พบฐานข้อมูลชื่อ "${database}" บนเซิร์ฟเวอร์ MySQL`,
          400
        );
      }
      throw new IngestionError(
        `การเชื่อมต่อฐานข้อมูลล้มเหลว: ${connErr.message}`,
        400
      );
    }

    try {
      const [rows] = await connection.execute(query);
      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          columns: [],
          preview: [],
          message: "เชื่อมต่อสำเร็จ แต่ไม่พบข้อมูลจากการค้นหา (0 rows)",
        };
      }

      const columns = Object.keys(rows[0]);
      const preview = rows.slice(0, 5);

      return {
        message: "เชื่อมต่อฐานข้อมูลสำเร็จ",
        columns,
        preview,
      };
    } catch (queryErr) {
      if (queryErr.code === "ER_NO_SUCH_TABLE") {
        throw new IngestionError(
          `ไม่พบตารางตามคำสั่ง SQL — หากเป็นการทดสอบ กรุณากดปุ่ม "ตั้งค่าตารางจำลองในระบบเพื่อทดสอบ" ด้านบนก่อน (${queryErr.message})`,
          400
        );
      }
      throw new IngestionError(
        `คำสั่ง SQL ไม่ถูกต้อง: ${queryErr.message}`,
        400
      );
    } finally {
      if (connection) await connection.end();
    }
  },

  /**
   * Execute external database synchronization
   */
  async executeDbSync(params = {}) {
    const mysql = require("mysql2/promise");

    const query = params.query;
    const mapping = params.mapping;
    const config = params.config || {};
    const host = config.host || params.host || process.env.SYNC_DB_HOST;
    const port = config.port || params.port || process.env.SYNC_DB_PORT || 3306;
    const database =
      config.database || params.database || process.env.SYNC_DB_NAME;
    const user = config.user || params.user || process.env.SYNC_DB_USER;
    const password =
      config.password !== undefined
        ? config.password
        : params.password !== undefined
        ? params.password
        : process.env.SYNC_DB_PASSWORD || "";

    if (!host || !database || !user) {
      throw new IngestionError(
        "ไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูลปลายทางที่ฝั่งเซิร์ฟเวอร์",
        500
      );
    }

    if (!query || !mapping) {
      throw new IngestionError("ข้อมูลไม่ครบถ้วน (ต้องการ query และ mapping)", 400);
    }

    if (!isReadOnlySelectQuery(query)) {
      throw new IngestionError(
        "Security Policy: อนุญาตเฉพาะคำสั่ง SELECT แบบอ่านอย่างเดียวเท่านั้น",
        403
      );
    }

    let connection;
    try {
      connection = await mysql.createConnection({
        host,
        port: parseInt(port, 10),
        database,
        user,
        password,
        connectTimeout: 5000,
      });
    } catch (connErr) {
      if (connErr.code === "ECONNREFUSED") {
        throw new IngestionError(
          `ไม่สามารถเชื่อมต่อไปยัง ${host}:${port} ได้ (Connection Refused) — กรุณาตรวจสอบ Port (MySQL เครื่องของคุณใช้พอร์ต ${process.env.DB_PORT || 3307})`,
          400
        );
      }
      throw new IngestionError(
        `การเชื่อมต่อฐานข้อมูลล้มเหลว: ${connErr.message}`,
        400
      );
    }

    try {
      const [rows] = await connection.execute(query);
      const results = await this.syncUsersList(rows, mapping);

      return {
        message: `ซิงค์ข้อมูลจากฐานข้อมูลเสร็จสิ้น: สำเร็จ ${results.success.length} รายการ, ล้มเหลว ${results.failed.length} รายการ`,
        results,
      };
    } catch (queryErr) {
      throw new IngestionError(
        `เกิดข้อผิดพลาดในการดึงข้อมูล: ${queryErr.message}`,
        400
      );
    } finally {
      if (connection) await connection.end();
    }
  },

  /**
   * Preview external REST API endpoint
   */
  async previewApiSync({ url, headers }) {
    if (!url) {
      throw new IngestionError("กรุณาระบุ URL ของ API", 400);
    }

    const isDev = process.env.NODE_ENV === "development";
    const isLocalhost =
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("::1");

    if (!isDev || !isLocalhost) {
      const isSafe = await isSSRFSafeUrl(url);
      if (!isSafe) {
        throw new IngestionError(
          "ไม่อนุญาตให้เชื่อมต่อไปยัง URL ปลายทางที่ระบุ (Security Policy)",
          403
        );
      }
    }

    const fetchOptions = {
      headers: { "Content-Type": "application/json" },
    };

    if (headers) {
      try {
        const parsedHeaders = JSON.parse(headers);
        fetchOptions.headers = { ...fetchOptions.headers, ...parsedHeaders };
      } catch (e) {
        if (headers.includes(":")) {
          const [key, val] = headers.split(":");
          fetchOptions.headers[key.trim()] = val.trim();
        } else {
          fetchOptions.headers["Authorization"] = headers.trim();
        }
      }
    }

    const axiosConfig = {
      headers: fetchOptions.headers,
      timeout: 10000,
    };

    if (!isDev || !isLocalhost) {
      axiosConfig.httpAgent = ssrfFilter(url);
      axiosConfig.httpsAgent = ssrfFilter(url);
    }

    const response = await axios.get(url, axiosConfig);

    const data = response.data;
    const rows = Array.isArray(data)
      ? data
      : data.data && Array.isArray(data.data)
        ? data.data
        : null;

    if (!rows || rows.length === 0) {
      throw new IngestionError(
        "ดึงข้อมูลสำเร็จ แต่รูปแบบข้อมูลไม่ใช่ Array ของบุคลากร",
        400
      );
    }

    const columns = Object.keys(rows[0]);
    const preview = rows.slice(0, 5);

    return {
      message: "เชื่อมต่อ API สำเร็จ",
      columns,
      preview,
    };
  },

  /**
   * Execute external REST API synchronization
   */
  async executeApiSync({ url, headers, mapping }) {
    if (!url || !mapping) {
      throw new IngestionError("ข้อมูลไม่ครบถ้วน", 400);
    }

    const isDev = process.env.NODE_ENV === "development";
    const isLocalhost =
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("::1");

    if (!isDev || !isLocalhost) {
      const isSafe = await isSSRFSafeUrl(url);
      if (!isSafe) {
        throw new IngestionError(
          "ไม่อนุญาตให้เชื่อมต่อไปยัง URL ปลายทางที่ระบุ (Security Policy)",
          403
        );
      }
    }

    const fetchOptions = {
      headers: { "Content-Type": "application/json" },
    };

    if (headers) {
      try {
        const parsedHeaders = JSON.parse(headers);
        fetchOptions.headers = { ...fetchOptions.headers, ...parsedHeaders };
      } catch (e) {
        if (headers.includes(":")) {
          const [key, val] = headers.split(":");
          fetchOptions.headers[key.trim()] = val.trim();
        } else {
          fetchOptions.headers["Authorization"] = headers.trim();
        }
      }
    }

    const axiosConfig = {
      headers: fetchOptions.headers,
      timeout: 10000,
    };

    if (!isDev || !isLocalhost) {
      axiosConfig.httpAgent = ssrfFilter(url);
      axiosConfig.httpsAgent = ssrfFilter(url);
    }

    const response = await axios.get(url, axiosConfig);

    const data = response.data;
    const rows = Array.isArray(data)
      ? data
      : data.data && Array.isArray(data.data)
        ? data.data
        : null;

    if (!rows || rows.length === 0) {
      throw new IngestionError("ดึงข้อมูลสำเร็จ แต่ไม่พบข้อมูลบุคลากร", 400);
    }

    const results = await this.syncUsersList(rows, mapping);

    return {
      message: `ซิงค์ข้อมูลจาก API เสร็จสิ้น: สำเร็จ ${results.success.length} รายการ, ล้มเหลว ${results.failed.length} รายการ`,
      results,
    };
  },

  /**
   * Generate downloadable Excel import template with dropdown data validation
   */
  async generateImportTemplate(res) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    const dataSheet = workbook.addWorksheet("DropdownData");
    dataSheet.state = "hidden";

    const departments = await Department.findAll({ attributes: ["id", "name"] });
    const faculties = await Faculty.findAll({ attributes: ["id", "name"] });
    const supervisors = await User.findAll({
      where: { role: { [Op.in]: ["head", "admin"] } },
      attributes: ["id", "firstName", "lastName", "employeeId"],
    });

    const roles = ["employee", "head", "admin"];
    const personnelTypes = [
      "ข้าราชการในสถาบันอุดมศึกษา (สายผู้สอน)",
      "ข้าราชการในสถาบันอุดมศึกษา (สายสนับสนุน)",
      "พนักงานมหาวิทยาลัยสายผู้สอน",
      "พนักงานมหาวิทยาลัยสายสนับสนุน",
      "อาจารย์อัตราจ้าง",
      "ลูกจ้างชั่วคราวมหาวิทยาลัย",
    ];
    const deptNames = departments.map((d) => d.name);
    const facultyNames = faculties.map((f) => f.name);
    const supervisorNames = supervisors.map(
      (s) => `${s.firstName} ${s.lastName}`
    );

    dataSheet.getColumn("A").values = ["Role", ...roles];
    dataSheet.getColumn("B").values = ["Department", ...deptNames];
    dataSheet.getColumn("C").values = ["Supervisor", ...supervisorNames];
    dataSheet.getColumn("D").values = ["Faculty", ...facultyNames];
    dataSheet.getColumn("E").values = ["PersonnelType", ...personnelTypes];

    const headers = [
      { header: "firstName(ชื่อ)", key: "firstName", width: 20 },
      { header: "lastName(นามสกุล)", key: "lastName", width: 20 },
      { header: "email(อีเมล)", key: "email", width: 30 },
      { header: "password(รหัสผ่าน เว้นว่างได้)", key: "password", width: 15 },
      { header: "position(ตำแหน่ง)", key: "position", width: 20 },
      { header: "personnelType(ประเภทบุคลากร)", key: "personnelType", width: 35 },
      { header: "role(บทบาท)", key: "role", width: 15 },
      { header: "facultyId(คณะ)", key: "facultyId", width: 25 },
      { header: "departmentId(สาขาวิชา/หน่วยงาน)", key: "departmentId", width: 30 },
      { header: "supervisorId(หัวหน้างาน)", key: "supervisorId", width: 25 },
    ];
    sheet.columns = headers;

    sheet.addRow({
      firstName: "นายสมชาย",
      lastName: "ใจดี",
      email: "somchai@example.com",
      password: "Password1",
      position: "อาจารย์",
      personnelType: personnelTypes[2],
      role: "employee",
      facultyId: facultyNames[0] || "",
      departmentId: deptNames[0] || "",
      supervisorId: supervisorNames[0] || "",
    });

    for (let rowNum = 2; rowNum <= 1000; rowNum++) {
      sheet.getCell(`F${rowNum}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`DropdownData!$E$2:$E$${personnelTypes.length + 1}`],
      };
      sheet.getCell(`G${rowNum}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`DropdownData!$A$2:$A$${roles.length + 1}`],
      };
      if (facultyNames.length > 0) {
        sheet.getCell(`H${rowNum}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`DropdownData!$D$2:$D$${facultyNames.length + 1}`],
        };
      }
      if (deptNames.length > 0) {
        sheet.getCell(`I${rowNum}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`DropdownData!$B$2:$B$${deptNames.length + 1}`],
        };
      }
      if (supervisorNames.length > 0) {
        sheet.getCell(`J${rowNum}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`DropdownData!$C$2:$C$${supervisorNames.length + 1}`],
        };
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=user_import_template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  },

  /**
   * Mock university staff directory data
   */
  getMockUniversityApi() {
    return [
      {
        emp_id: "UNI001",
        name_first: "รศ.ดร.กิตติพงษ์",
        name_last: "เจริญสุข",
        email_address: "kittipong.c@bru.ac.th",
        position_title: "อาจารย์ประจำสาขาวิชาคณิตศาสตร์",
        personnel_type: "civil_servant_academic",
        job_role: "employee",
        phone_no: "0811223344",
        division_name: "คณะวิทยาศาสตร์",
        dept_name: "สาขาวิชาคณิตศาสตร์",
        start_date: "2019-03-01",
      },
      {
        emp_id: "UNI002",
        name_first: "ดร.วรรณภา",
        name_last: "ศรีสวัสดิ์",
        email_address: "wannapa.s@bru.ac.th",
        position_title: "อาจารย์ประจำสาขาวิชาเทคโนโลยีสารสนเทศ",
        personnel_type: "university_employee_academic",
        job_role: "employee",
        phone_no: "0899887766",
        division_name: "คณะวิทยาศาสตร์",
        dept_name: "สาขาวิชาเทคโนโลยีสารสนเทศ",
        start_date: "2021-08-15",
      },
      {
        emp_id: "UNI003",
        name_first: "ผศ.มานพ",
        name_last: "ยอดดี",
        email_address: "manop.y@bru.ac.th",
        position_title: "หัวหน้าภาควิชาคณิตศาสตร์",
        personnel_type: "civil_servant_academic",
        job_role: "head",
        phone_no: "0855443322",
        division_name: "คณะวิทยาศาสตร์",
        dept_name: "สาขาวิชาคณิตศาสตร์",
        start_date: "2015-05-10",
      },
      {
        emp_id: "UNI004",
        name_first: "นางสาวศิริลักษณ์",
        name_last: "ใจงาม",
        email_address: "sirilak.j@bru.ac.th",
        position_title: "เจ้าหน้าที่บริหารงานทั่วไป",
        personnel_type: "university_employee_support",
        job_role: "employee",
        phone_no: "0877665544",
        division_name: "สำนักงานอธิการบดี",
        dept_name: "สำนักงานอธิการบดี",
        start_date: "2022-01-10",
      },
      {
        emp_id: "UNI005",
        name_first: "ดร.ณรงค์",
        name_last: "แก้วสะอาด",
        email_address: "narong.k@bru.ac.th",
        position_title: "อาจารย์อัตราจ้างสาขาวิชาเคมี",
        personnel_type: "contract_lecturer",
        job_role: "employee",
        phone_no: "0866554433",
        division_name: "คณะวิทยาศาสตร์",
        dept_name: "สาขาวิชาเคมี",
        start_date: "2020-11-01",
      },
    ];
  },

  /**
   * Setup & seed mock_university_personnel table in local DB for testing sync
   */
  async setupMockDb() {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS mock_university_personnel (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emp_id VARCHAR(20) UNIQUE NOT NULL,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        email VARCHAR(80) UNIQUE NOT NULL,
        position_title VARCHAR(80),
        personnel_type VARCHAR(50) DEFAULT 'university_employee_academic',
        role_name VARCHAR(20) DEFAULT 'employee',
        phone_no VARCHAR(15),
        dept_name VARCHAR(100),
        faculty_name VARCHAR(100),
        start_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const countResult = await sequelize.query(
      "SELECT COUNT(*) as count FROM mock_university_personnel",
      { type: QueryTypes.SELECT }
    );
    const count = countResult[0].count;

    if (count === 0) {
      const mockUsers = [
        [
          "UNI001",
          "รศ.ดร.กิตติพงษ์",
          "เจริญสุข",
          "kittipong.c@bru.ac.th",
          "อาจารย์ประจำสาขาวิชาวิทยาการคอมพิวเตอร์",
          "civil_servant_academic",
          "employee",
          "0811223344",
          "สาขาวิชาวิทยาการคอมพิวเตอร์",
          "คณะวิทยาศาสตร์",
          "2019-03-01",
        ],
        [
          "UNI002",
          "ดร.วรรณภา",
          "ศรีสวัสดิ์",
          "wannapa.s@bru.ac.th",
          "อาจารย์ประจำสาขาวิชาเทคโนโลยีสารสนเทศ",
          "university_employee_academic",
          "employee",
          "0899887766",
          "สาขาวิชาเทคโนโลยีสารสนเทศ",
          "คณะวิทยาศาสตร์",
          "2021-08-15",
        ],
        [
          "UNI003",
          "ผศ.มานพ",
          "ยอดดี",
          "manop.y@bru.ac.th",
          "หัวหน้าภาควิชาคณิตศาสตร์",
          "civil_servant_academic",
          "head",
          "0855443322",
          "สาขาวิชาคณิตศาสตร์",
          "คณะวิทยาศาสตร์",
          "2015-05-10",
        ],
        [
          "UNI004",
          "นางสาวศิริลักษณ์",
          "ใจงาม",
          "sirilak.j@bru.ac.th",
          "เจ้าหน้าที่บริหารงานทั่วไป",
          "university_employee_support",
          "employee",
          "0877665544",
          "สำนักงานอธิการบดี",
          "สำนักงานอธิการบดี",
          "2022-01-10",
        ],
        [
          "UNI005",
          "ดร.ณรงค์",
          "แก้วสะอาด",
          "narong.k@bru.ac.th",
          "อาจารย์อัตราจ้างสาขาวิชาเคมี",
          "contract_lecturer",
          "employee",
          "0866554433",
          "สาขาวิชาเคมี",
          "คณะวิทยาศาสตร์",
          "2020-11-01",
        ],
      ];

      for (const user of mockUsers) {
        await sequelize.query(
          `INSERT INTO mock_university_personnel 
          (emp_id, first_name, last_name, email, position_title, personnel_type, role_name, phone_no, dept_name, faculty_name, start_date) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          { replacements: user }
        );
      }
    }

    return {
      message:
        "ตั้งค่าตารางจำลอง mock_university_personnel เรียบร้อยแล้ว พร้อมข้อมูลบุคลากร 5 รายการ",
    };
  },
};

module.exports = {
  UserIngestion,
  IngestionError,
  createLeaveBalancesForUser,
};
