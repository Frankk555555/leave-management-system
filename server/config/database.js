const { Sequelize } = require("sequelize");

// Determine if SSL is required (cloud databases like Aiven require SSL)
const dbHost = process.env.DB_HOST || "localhost";
const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(dbHost);

// Build dialect options with SSL for cloud connections
const dialectOptions = isLocalhost
  ? {}
  : {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Aiven uses self-signed certificates
      },
    };

// Create Sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME || "leave_management",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: dbHost,
    port: process.env.DB_PORT || 3307,
    dialect: "mysql",
    logging: false,
    dialectOptions,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true, // Use snake_case for column names
      freezeTableName: true, // Don't pluralize table names
    },
  }
);

// Helper to safely add column if missing
const ensureColumnExists = async (tableName, columnName, definition) => {
  try {
    const [results] = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND COLUMN_NAME = '${columnName}'`
    );
    if (results.length === 0) {
      await sequelize.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`
      );
      console.log(`✅ [Auto-Migration] Added missing column '${columnName}' to '${tableName}' table.`);
    }
  } catch (err) {
    // Ignore error if table does not exist yet
  }
};

// Helper to safely add index if missing
const ensureIndexExists = async (tableName, indexName, definition) => {
  try {
    const [results] = await sequelize.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}' AND INDEX_NAME = '${indexName}'`
    );
    if (results.length === 0) {
      await sequelize.query(
        `ALTER TABLE \`${tableName}\` ADD INDEX \`${indexName}\` ${definition}`
      );
      console.log(`✅ [Auto-Migration] Added missing index '${indexName}' to '${tableName}' table.`);
    }
  } catch (err) {
    // Ignore error
  }
};

// Test connection and auto-sync essential schema
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL connection successfully");

    // Ensure critical columns and indexes exist in production database
    try {
      // Users table additions
      await ensureColumnExists("users", "personnel_type", "VARCHAR(50) DEFAULT 'university_employee_academic' COMMENT 'ประเภทบุคลากรตามข้อ 1.4.2'");
      await ensureIndexExists("users", "idx_personnel_type", "(personnel_type)");
      await ensureColumnExists("users", "signature_image", "VARCHAR(500) NULL COMMENT 'Path to signature image file'");
      await ensureColumnExists("users", "profile_image", "VARCHAR(500) NULL COMMENT 'Path to profile image file'");
      await ensureColumnExists("users", "start_date", "DATE NULL COMMENT 'วันที่เริ่มรับราชการ'");
      await ensureColumnExists("users", "government_division", "VARCHAR(100) NULL COMMENT 'ส่วนราชการ'");
      await ensureColumnExists("users", "document_number", "VARCHAR(100) NULL COMMENT 'ที่ (เลขหนังสือ เช่น อว 0624.2/)'");
      await ensureColumnExists("users", "unit", "VARCHAR(100) NULL COMMENT 'หน่วยงาน'");
      await ensureColumnExists("users", "affiliation", "VARCHAR(100) NULL COMMENT 'สังกัด (คณะ)'");
      await ensureColumnExists("users", "reset_password_token", "VARCHAR(255) NULL COMMENT 'Token สำหรับการตั้งรหัสผ่านใหม่'");
      await ensureColumnExists("users", "reset_password_expires", "DATETIME NULL COMMENT 'เวลาหมดอายุของ Token รีเซ็ตรหัสผ่าน'");
      await ensureColumnExists("users", "is_active", "TINYINT(1) DEFAULT 1 COMMENT 'Soft delete flag'");
      await ensureIndexExists("users", "idx_is_active", "(is_active)");

      // Expand image URL columns if existing
      await sequelize.query(
        "ALTER TABLE users MODIFY profile_image VARCHAR(500), MODIFY signature_image VARCHAR(500);"
      );

      // Multi-Level Approval Schema Updates
      await sequelize.query(
        "ALTER TABLE users MODIFY role ENUM('employee', 'head', 'dean', 'vp', 'admin') DEFAULT 'employee';"
      ).catch(() => {});

      await ensureColumnExists("leave_requests", "head_comment", "VARCHAR(500) NULL COMMENT 'ความเห็นหัวหน้างาน'");
      await ensureColumnExists("leave_requests", "head_approved_by", "INT UNSIGNED NULL COMMENT 'FK: ผู้ให้ความเห็น (head)'");
      await ensureColumnExists("leave_requests", "head_approved_at", "TIMESTAMP NULL");

      await ensureColumnExists("leave_requests", "dean_comment", "VARCHAR(500) NULL COMMENT 'ความเห็นคณบดี'");
      await ensureColumnExists("leave_requests", "dean_approved_by", "INT UNSIGNED NULL COMMENT 'FK: ผู้ให้ความเห็น (dean)'");
      await ensureColumnExists("leave_requests", "dean_approved_at", "TIMESTAMP NULL");

      await ensureColumnExists("leave_requests", "vp_decision", "ENUM('allow', 'disallow') NULL COMMENT 'คำสั่งรองอธิการบดีฯ'");
      await ensureColumnExists("leave_requests", "vp_comment", "VARCHAR(500) NULL COMMENT 'คำสั่งหรือความเห็นเพิ่มเติมรองอธิการบดีฯ'");
      await ensureColumnExists("leave_requests", "vp_approved_by", "INT UNSIGNED NULL COMMENT 'FK: ผู้ลงนามคำสั่ง (vp)'");
      await ensureColumnExists("leave_requests", "vp_approved_at", "TIMESTAMP NULL");

      await sequelize.query(
        "ALTER TABLE leave_requests MODIFY status ENUM('pending', 'pending_dean', 'pending_vp', 'approved', 'rejected', 'confirmed', 'cancelled') DEFAULT 'pending';"
      ).catch(() => {});

      await sequelize.query(
        "ALTER TABLE leave_history MODIFY old_status ENUM('pending', 'pending_dean', 'pending_vp', 'approved', 'rejected', 'confirmed', 'cancelled'), MODIFY new_status ENUM('pending', 'pending_dean', 'pending_vp', 'approved', 'rejected', 'confirmed', 'cancelled');"
      ).catch(() => {});
    } catch (e) {
      // Table might not exist yet or dialect might differ; ignore safely
    }
  } catch (error) {
    console.error("❌ Unable to connect to MySQL database:", error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection };

