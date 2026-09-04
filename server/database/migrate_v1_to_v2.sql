-- ================================================================
-- Migration Script: V1 → V2
-- ================================================================
-- วิธีใช้ใน phpMyAdmin:
--   1. เลือกฐานข้อมูล leave_management
--   2. ไปที่แท็บ SQL
--   3. วาง script นี้ทั้งหมด แล้วกด Go
--
-- ⚠️ สำคัญ: BACKUP ฐานข้อมูลก่อนรัน!
--   phpMyAdmin → Export → Quick → Go
-- ================================================================

USE leave_management;

-- ================================================================
-- STEP 1: ปรับ faculties
-- ================================================================
ALTER TABLE faculties
  MODIFY id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY name VARCHAR(100) NOT NULL,
  MODIFY code VARCHAR(20) NOT NULL;

-- เพิ่ม is_active ถ้ายังไม่มี
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faculties' AND COLUMN_NAME = 'is_active');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE faculties ADD COLUMN is_active TINYINT(1) DEFAULT 1',
  'SELECT "is_active already exists in faculties"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================
-- STEP 2: ปรับ departments
-- ================================================================
ALTER TABLE departments
  MODIFY id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY faculty_id SMALLINT UNSIGNED,
  MODIFY name VARCHAR(100) NOT NULL,
  MODIFY code VARCHAR(20) NOT NULL;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'departments' AND COLUMN_NAME = 'is_active');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE departments ADD COLUMN is_active TINYINT(1) DEFAULT 1',
  'SELECT "is_active already exists in departments"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================
-- STEP 3: ปรับ users
-- ================================================================
ALTER TABLE users
  MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY employee_id VARCHAR(20) NOT NULL,
  MODIFY email VARCHAR(80) NOT NULL,
  MODIFY password CHAR(60) NOT NULL COMMENT 'bcrypt hash คงที่ 60 chars',
  MODIFY first_name VARCHAR(50),
  MODIFY last_name VARCHAR(50),
  MODIFY department_id SMALLINT UNSIGNED,
  MODIFY position VARCHAR(80),
  MODIFY supervisor_id INT UNSIGNED,
  MODIFY phone VARCHAR(15),
  MODIFY profile_image VARCHAR(150);

-- ปรับ columns ที่อาจมีอยู่แล้ว
ALTER TABLE users
  MODIFY government_division VARCHAR(100) COMMENT 'ส่วนราชการ',
  MODIFY document_number VARCHAR(50) COMMENT 'ที่ (เลขหนังสือ)',
  MODIFY unit VARCHAR(100) COMMENT 'หน่วยงาน',
  MODIFY affiliation VARCHAR(100) COMMENT 'สังกัด (คณะ)';

-- เพิ่ม is_active ถ้ายังไม่มี
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_active');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1 COMMENT "Soft delete flag"',
  'SELECT "is_active already exists in users"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index สำหรับ is_active
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_is_active');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE users ADD INDEX idx_is_active (is_active)',
  'SELECT "idx_is_active already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- เพิ่ม personnel_type ถ้ายังไม่มี
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'personnel_type');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN personnel_type VARCHAR(50) DEFAULT "university_employee_academic" COMMENT "ประเภทบุคลากรตามข้อ 1.4.2"',
  'SELECT "personnel_type already exists in users"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Index สำหรับ personnel_type
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_personnel_type');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE users ADD INDEX idx_personnel_type (personnel_type)',
  'SELECT "idx_personnel_type already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ================================================================
-- STEP 4: สร้าง/ปรับ leave_types
-- ================================================================
CREATE TABLE IF NOT EXISTS leave_types (
  id                    TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name                  VARCHAR(60)  NOT NULL,
  code                  VARCHAR(20)  NOT NULL UNIQUE,
  description           VARCHAR(200),
  default_days          SMALLINT UNSIGNED NOT NULL DEFAULT 0
                        COMMENT 'จำนวนวันลาสูงสุดต่อปี (0 = ไม่จำกัด)',
  requires_medical_cert TINYINT(1) DEFAULT 0,
  is_active             TINYINT(1) DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default leave types (ถ้ายังไม่มี)
INSERT IGNORE INTO leave_types (name, code, description, default_days, requires_medical_cert) VALUES
  ('ลาป่วย',           'sick',       'ลาป่วยเนื่องจากเจ็บป่วย',                   60,  TRUE),
  ('ลากิจส่วนตัว',     'personal',   'ลากิจส่วนตัว',                               45,  FALSE),
  ('ลาพักผ่อน',        'vacation',   'ลาพักผ่อนประจำปี',                            10,  FALSE),
  ('ลาคลอดบุตร',       'maternity',  'ลาคลอดบุตรสำหรับพนักงานหญิง',                 90,  FALSE),
  ('ลาช่วยภรรยาคลอด',  'paternity',  'ลาช่วยภรรยาคลอดสำหรับพนักงานชาย',            15,  FALSE),
  ('ลาเลี้ยงดูบุตร',   'childcare',  'ลาเลี้ยงดูบุตร',                            150,  FALSE),
  ('ลาอุปสมบท/ฮัจย์',  'ordination', 'ลาอุปสมบทหรือประกอบพิธีฮัจย์',               120,  FALSE),
  ('ลาตรวจเลือก',      'military',   'ลาตรวจเลือกเข้ารับราชการทหาร',               60,  FALSE);

-- ================================================================
-- STEP 5: สร้างตาราง leave_balances ใหม่ (Normalized)
-- ================================================================
-- ⚠️ ถ้ามี leave_balances เดิม จะ rename เป็น _old แล้วสร้างใหม่

-- 5a: Rename ตารางเดิม (ถ้ามี)
SET @tbl_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_balances');
SET @old_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_balances_v1_backup');
SET @sql = IF(@tbl_exists > 0 AND @old_exists = 0,
  'RENAME TABLE leave_balances TO leave_balances_v1_backup',
  'SELECT "leave_balances rename: skipped"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5b: สร้างตารางใหม่
CREATE TABLE IF NOT EXISTS leave_balances (
  id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id             INT UNSIGNED NOT NULL,
  leave_type_id       TINYINT UNSIGNED NOT NULL,
  year                YEAR NOT NULL COMMENT 'ปีงบประมาณ',
  total_days          DECIMAL(4,1) NOT NULL DEFAULT 0,
  used_days           DECIMAL(4,1) NOT NULL DEFAULT 0,
  carried_over_days   DECIMAL(4,1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_type_year (user_id, leave_type_id, year),
  INDEX idx_user_id (user_id),
  INDEX idx_leave_type_id (leave_type_id),
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5c: Migrate ข้อมูลจาก V1 → V2 (ถ้ามี backup)
-- ย้ายวันลาป่วย
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'sick'),
         YEAR(CURDATE()),
         COALESCE(b.sick, 60),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลากิจ
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'personal'),
         YEAR(CURDATE()),
         COALESCE(b.personal, 45),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลาพักผ่อน
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days, carried_over_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'vacation'),
         YEAR(CURDATE()),
         COALESCE(b.vacation, 10),
         0,
         COALESCE(b.vacation_accrued, 0)
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลาคลอดบุตร
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'maternity'),
         YEAR(CURDATE()),
         COALESCE(b.maternity, 90),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลาช่วยภรรยาคลอด
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'paternity'),
         YEAR(CURDATE()),
         COALESCE(b.paternity, 15),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลาเลี้ยงดูบุตร
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'childcare'),
         YEAR(CURDATE()),
         COALESCE(b.childcare, 150),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลาอุปสมบท
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'ordination'),
         YEAR(CURDATE()),
         COALESCE(b.ordination, 120),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ย้ายวันลาตรวจเลือก
INSERT IGNORE INTO leave_balances (user_id, leave_type_id, year, total_days, used_days)
  SELECT b.user_id,
         (SELECT id FROM leave_types WHERE code = 'military'),
         YEAR(CURDATE()),
         COALESCE(b.military, 60),
         0
  FROM leave_balances_v1_backup b
  WHERE EXISTS (SELECT 1 FROM leave_balances_v1_backup LIMIT 1);

-- ================================================================
-- STEP 6: ปรับ leave_requests
-- ================================================================

-- 6a: เพิ่ม column leave_type_id (ถ้ายังไม่มี)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'leave_type_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE leave_requests ADD COLUMN leave_type_id TINYINT UNSIGNED AFTER user_id',
  'SELECT "leave_type_id already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6b: Migrate ข้อมูล leaveType (VARCHAR) → leave_type_id (FK)
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'sick') WHERE leave_type = 'sick' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'personal') WHERE leave_type = 'personal' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'vacation') WHERE leave_type = 'vacation' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'maternity') WHERE leave_type = 'maternity' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'paternity') WHERE leave_type = 'paternity' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'childcare') WHERE leave_type = 'childcare' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'ordination') WHERE leave_type = 'ordination' AND leave_type_id IS NULL;
UPDATE leave_requests SET leave_type_id = (SELECT id FROM leave_types WHERE code = 'military') WHERE leave_type = 'military' AND leave_type_id IS NULL;

-- 6c: ปรับ column types
ALTER TABLE leave_requests
  MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY user_id INT UNSIGNED NOT NULL,
  MODIFY total_days DECIMAL(4,1) NOT NULL,
  MODIFY approved_by INT UNSIGNED,
  MODIFY confirmed_by INT UNSIGNED;

-- เปลี่ยน reason/notes จาก TEXT → VARCHAR(500)
ALTER TABLE leave_requests
  MODIFY reason VARCHAR(500),
  MODIFY contact_address VARCHAR(300),
  MODIFY contact_phone VARCHAR(15),
  MODIFY rejection_reason VARCHAR(500);

-- 6d: เพิ่ม columns ใหม่ (ถ้ายังไม่มี)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'time_slot');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE leave_requests ADD COLUMN time_slot ENUM('full','morning','afternoon') DEFAULT 'full' AFTER total_days",
  'SELECT "time_slot already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'confirmed_by');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE leave_requests ADD COLUMN confirmed_by INT UNSIGNED, ADD COLUMN confirmed_at TIMESTAMP NULL, ADD COLUMN confirmed_note VARCHAR(500)',
  'SELECT "confirmed_by already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND COLUMN_NAME = 'cancelled_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE leave_requests ADD COLUMN cancelled_at TIMESTAMP NULL, ADD COLUMN cancel_reason VARCHAR(500)',
  'SELECT "cancelled_at already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6e: เพิ่ม status 'confirmed' และ 'cancelled' ถ้ายังไม่มี
ALTER TABLE leave_requests
  MODIFY status ENUM('pending','approved','rejected','confirmed','cancelled') DEFAULT 'pending';

-- 6f: เพิ่ม FK สำหรับ leave_type_id
SET @fk_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests'
  AND CONSTRAINT_NAME = 'fk_lr_leave_type_id');
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE leave_requests ADD CONSTRAINT fk_lr_leave_type_id FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT',
  'SELECT "FK already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6g: Index สำหรับ leave_type_id
SET @idx_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_requests' AND INDEX_NAME = 'idx_leave_type_id');
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE leave_requests ADD INDEX idx_leave_type_id (leave_type_id)',
  'SELECT "idx_leave_type_id already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================
-- STEP 7: ปรับ leave_attachments
-- ================================================================
ALTER TABLE leave_attachments
  MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY leave_request_id INT UNSIGNED NOT NULL,
  MODIFY file_name VARCHAR(100) NOT NULL,
  MODIFY file_path VARCHAR(255) NOT NULL,
  MODIFY file_type VARCHAR(50),
  MODIFY file_size INT UNSIGNED;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leave_attachments' AND COLUMN_NAME = 'original_name');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE leave_attachments ADD COLUMN original_name VARCHAR(150) AFTER file_name',
  'ALTER TABLE leave_attachments MODIFY original_name VARCHAR(150)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================
-- STEP 8: ปรับ holidays
-- ================================================================
ALTER TABLE holidays
  MODIFY id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY name VARCHAR(120) NOT NULL;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'holidays' AND COLUMN_NAME = 'year');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE holidays ADD COLUMN year YEAR AFTER date',
  'SELECT "year already exists in holidays"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'holidays' AND COLUMN_NAME = 'type');
SET @sql = IF(@col_exists = 0,
  "ALTER TABLE holidays ADD COLUMN type ENUM('national','special','compensatory') DEFAULT 'national'",
  'SELECT "type already exists in holidays"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'holidays' AND COLUMN_NAME = 'description');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE holidays ADD COLUMN description VARCHAR(255)',
  'ALTER TABLE holidays MODIFY description VARCHAR(255)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================
-- STEP 9: ปรับ notifications
-- ================================================================
ALTER TABLE notifications
  MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  MODIFY user_id INT UNSIGNED NOT NULL,
  MODIFY title VARCHAR(100) NOT NULL,
  MODIFY message VARCHAR(500) NOT NULL;

-- ปรับ type ENUM
ALTER TABLE notifications
  MODIFY type ENUM('leave_request','approval','rejection','confirmation',
                   'new_leave','cancellation','reminder') NOT NULL;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'related_leave_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN related_leave_id INT UNSIGNED',
  'ALTER TABLE notifications MODIFY related_leave_id INT UNSIGNED');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'read_at');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE notifications ADD COLUMN read_at TIMESTAMP NULL AFTER is_read',
  'SELECT "read_at already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ================================================================
-- STEP 10: สร้างตาราง leave_history (Audit Trail)
-- ================================================================
CREATE TABLE IF NOT EXISTS leave_history (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  leave_request_id  INT UNSIGNED NOT NULL,
  action            ENUM('created','approved','rejected','confirmed','cancelled','edited') NOT NULL,
  action_by         INT UNSIGNED,
  old_status        ENUM('pending','approved','rejected','confirmed','cancelled'),
  new_status        ENUM('pending','approved','rejected','confirmed','cancelled'),
  note              VARCHAR(500),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (action_by)        REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_leave_request_id (leave_request_id),
  INDEX idx_action_by (action_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- ✅ MIGRATION COMPLETE
-- ================================================================
-- ตรวจสอบ:
--   1. ดูตาราง leave_balances → ควรมีข้อมูล normalized (1 row ต่อ user+type+year)
--   2. ดูตาราง leave_requests → ควรมี column leave_type_id ที่มีค่า
--   3. ดูตาราง leave_history → ตารางว่าง (ใหม่)
--   4. ตาราง leave_balances_v1_backup → backup ข้อมูลเดิม (ลบทีหลังได้)
--
-- หลังตรวจสอบเรียบร้อย สามารถลบ column เก่าและ backup ได้:
--   ALTER TABLE leave_requests DROP COLUMN leave_type;
--   DROP TABLE IF EXISTS leave_balances_v1_backup;
-- ================================================================
