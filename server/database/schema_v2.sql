-- ================================================================
-- Leave Management System V2 - MySQL Schema (Redesigned)
-- ================================================================
-- การปรับปรุงจาก V1:
--   1. Normalize ตาราง leave_balances ให้ใช้ FK ไปยัง leave_types
--   2. เพิ่ม year tracking สำหรับ leave_balances
--   3. เปลี่ยน total_days เป็น DECIMAL สำหรับครึ่งวัน
--   4. เพิ่มตาราง leave_history สำหรับ Audit Trail
--   5. เพิ่ม UNIQUE constraints ป้องกันข้อมูลซ้ำ
--   6. เพิ่ม soft delete (is_active) สำหรับ users
--   7. ปรับปรุง indexes ให้ครอบคลุม queries
--   8. ปรับ Length/Values ทุก column ให้เหมาะสม ลด memory
-- ================================================================

CREATE DATABASE IF NOT EXISTS leave_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE leave_management;

-- ================================================================
-- 1. faculties - คณะ / สำนัก / สถาบัน
-- ================================================================
-- name: ชื่อคณะไทยยาวสุด ~60 chars (คณะมนุษยศาสตร์และสังคมศาสตร์)
-- code: รหัสคณะ ~10 chars (ADMIN, EDU, HUM)
-- ================================================================
CREATE TABLE faculties (
  id          SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  type        ENUM('faculty','office','institute') DEFAULT 'faculty'
              COMMENT 'faculty=คณะ, office=สำนัก, institute=สถาบัน',
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 2. departments - สาขาวิชา / หน่วยงาน
-- ================================================================
-- name: ชื่อภาควิชาไทย ~60 chars
-- code: รหัสภาค ~10 chars
-- ================================================================
CREATE TABLE departments (
  id          SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  faculty_id  SMALLINT UNSIGNED,
  name        VARCHAR(100) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL,
  INDEX idx_faculty_id (faculty_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 3. users - ผู้ใช้งาน / บุคลากร
-- ================================================================
-- employee_id:         รหัสพนักงาน ~10-20 chars (ADMIN001, EMP12345)
-- email:               อีเมล ~50 chars (admin@bru.ac.th)
-- password:            bcrypt hash = 60 chars คงที่
-- first_name/last_name: ชื่อภาษาไทย ~30 chars
-- position:            ตำแหน่ง ~50 chars (ผู้ช่วยศาสตราจารย์)
-- phone:               เบอร์โทร ~15 chars (0812345678, +66812345678)
-- profile_image:       path ~100 chars (/uploads/profiles/abc.jpg)
-- government_division: ส่วนราชการ ~80 chars
-- document_number:     เลขหนังสือ ~50 chars (อว 0624.2/)
-- unit:                หน่วยงาน ~80 chars
-- affiliation:         สังกัด ~80 chars
-- ================================================================
CREATE TABLE users (
  id                    INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  employee_id           VARCHAR(20)  NOT NULL UNIQUE,
  email                 VARCHAR(80)  NOT NULL UNIQUE,
  password              CHAR(60)     NOT NULL COMMENT 'bcrypt hash คงที่ 60 chars',
  first_name            VARCHAR(50),
  last_name             VARCHAR(50),
  department_id         SMALLINT UNSIGNED,
  position              VARCHAR(80), 
  personnel_type        VARCHAR(50)  DEFAULT 'university_employee_academic' COMMENT 'ประเภทบุคลากรตามข้อ 1.4.2',
  role                  ENUM('employee','head','dean','vp','admin') DEFAULT 'employee',
  supervisor_id         INT UNSIGNED COMMENT 'FK self-ref: หัวหน้าของพนักงานคนนี้',
  phone                 VARCHAR(15),
  profile_image         VARCHAR(500) COMMENT 'Path to profile image',
  start_date            DATE         COMMENT 'วันที่เริ่มรับราชการ',
  government_division   VARCHAR(100) COMMENT 'ส่วนราชการ',
  document_number       VARCHAR(50)  COMMENT 'ที่ (เลขหนังสือ เช่น อว 0624.2/)',
  unit                  VARCHAR(100) COMMENT 'หน่วยงาน',
  affiliation           VARCHAR(100) COMMENT 'สังกัด (คณะ)',
  signature_image       VARCHAR(500) COMMENT 'Path to signature image file',
  reset_password_token  VARCHAR(255) COMMENT 'Token สำหรับการตั้งรหัสผ่านใหม่',
  reset_password_expires DATETIME    COMMENT 'เวลาหมดอายุของ Token รีเซ็ตรหัสผ่าน',
  is_active             TINYINT(1) DEFAULT 1 COMMENT 'Soft delete flag',
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_email (email),
  INDEX idx_employee_id (employee_id),
  INDEX idx_role (role),
  INDEX idx_personnel_type (personnel_type),
  INDEX idx_department_id (department_id),
  INDEX idx_supervisor_id (supervisor_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 4. leave_types - ประเภทการลา
-- ================================================================
-- name:         ชื่อประเภทลาไทย ~40 chars (ลาช่วยภรรยาคลอด)
-- code:         รหัสลา ~15 chars (ordination, personal)
-- default_days: max 999 วัน → SMALLINT
-- ================================================================
CREATE TABLE leave_types (
  id                    TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name                  VARCHAR(60)  NOT NULL,
  code                  VARCHAR(20)  NOT NULL UNIQUE,
  description           VARCHAR(200),
  default_days          SMALLINT UNSIGNED NOT NULL DEFAULT 0
                        COMMENT 'จำนวนวันลาสูงสุดต่อปี (0 = ไม่จำกัด)',
  requires_medical_cert TINYINT(1) DEFAULT 0
                        COMMENT 'ต้องแนบใบรับรองแพทย์หรือไม่',
  is_active             TINYINT(1) DEFAULT 1,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_code (code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 5. leave_balances - ยอดวันลาคงเหลือ (Normalized)
-- ================================================================
-- total_days/used_days/carried_over: max 999.5 → DECIMAL(4,1)
-- ================================================================
CREATE TABLE leave_balances (
  id                  INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id             INT UNSIGNED NOT NULL,
  leave_type_id       TINYINT UNSIGNED NOT NULL,
  year                YEAR    NOT NULL COMMENT 'ปีงบประมาณ (พ.ศ. หรือ ค.ศ.)',
  total_days          DECIMAL(4,1) NOT NULL DEFAULT 0
                      COMMENT 'จำนวนวันลาทั้งหมดที่ได้รับ',
  used_days           DECIMAL(4,1) NOT NULL DEFAULT 0
                      COMMENT 'จำนวนวันลาที่ใช้ไปแล้ว',
  carried_over_days   DECIMAL(4,1) NOT NULL DEFAULT 0
                      COMMENT 'จำนวนวันลาสะสมจากปีก่อน',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,

  -- ป้องกันข้อมูลซ้ำ: 1 คน + 1 ประเภทลา + 1 ปี = 1 แถว
  UNIQUE KEY uk_user_type_year (user_id, leave_type_id, year),

  INDEX idx_user_id (user_id),
  INDEX idx_leave_type_id (leave_type_id),
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 6. leave_requests - คำขอลา
-- ================================================================
-- total_days: max 999.5 → DECIMAL(4,1)
-- contact_phone: ~15 chars
-- rejection_reason/confirmed_note/cancel_reason: short text → VARCHAR(500)
-- ================================================================
CREATE TABLE leave_requests (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id           INT UNSIGNED     NOT NULL,
  leave_type_id     TINYINT UNSIGNED NOT NULL COMMENT 'FK ไปยัง leave_types',
  start_date        DATE             NOT NULL,
  end_date          DATE             NOT NULL,
  total_days        DECIMAL(4,1)     NOT NULL COMMENT 'รองรับครึ่งวัน (0.5)',
  time_slot         ENUM('full','morning','afternoon') DEFAULT 'full',
  reason            VARCHAR(500),
  contact_address   VARCHAR(300)     COMMENT 'ที่อยู่ระหว่างลา',
  contact_phone     VARCHAR(15)      COMMENT 'เบอร์โทรระหว่างลา',

  -- Approval workflow (3 Levels)
  status            ENUM('pending','pending_dean','pending_vp','approved','rejected','confirmed','cancelled')
                    DEFAULT 'pending',
  -- Level 1: หัวหน้างาน
  head_comment      VARCHAR(500)     COMMENT 'ความเห็นของหัวหน้าสำนักงาน/หัวหน้าภาค/หัวหน้าสาขาวิชา/หัวหน้างาน',
  head_approved_by  INT UNSIGNED     COMMENT 'FK: ผู้ให้ความเห็น (head)',
  head_approved_at  TIMESTAMP NULL,
  approved_by       INT UNSIGNED     COMMENT 'FK: ผู้อนุมัติ (head) - backward compatibility',
  approved_at       TIMESTAMP NULL,

  -- Level 2: คณบดี / ผอ.สำนัก / ผอ.สถาบัน
  dean_comment      VARCHAR(500)     COMMENT 'ความเห็นของคณบดี/ผอ.สำนัก/ผอ.สถาบัน',
  dean_approved_by  INT UNSIGNED     COMMENT 'FK: ผู้ให้ความเห็น (dean)',
  dean_approved_at  TIMESTAMP NULL,

  -- Level 3: คำสั่งรองอธิการบดีฝ่ายบริหารงานบุคคลและเทคโนโลยีสารสนเทศ
  vp_decision       ENUM('allow','disallow') COMMENT 'คำสั่งรองอธิการบดีฯ: allow=อนุญาต, disallow=ไม่อนุญาต',
  vp_comment        VARCHAR(500)     COMMENT 'คำสั่งหรือความเห็นเพิ่มเติมของรองอธิการบดีฯ',
  vp_approved_by    INT UNSIGNED     COMMENT 'FK: ผู้ลงนามคำสั่ง (vp)',
  vp_approved_at    TIMESTAMP NULL,

  rejection_reason  VARCHAR(500),

  -- Confirmation (ขั้นตอนยืนยัน โดย admin)
  confirmed_by      INT UNSIGNED     COMMENT 'FK: ผู้ยืนยัน (admin)',
  confirmed_at      TIMESTAMP NULL,
  confirmed_note    VARCHAR(500),

  -- Cancellation
  cancelled_at      TIMESTAMP NULL,
  cancel_reason     VARCHAR(500),

  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)          REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id)    REFERENCES leave_types(id) ON DELETE RESTRICT,
  FOREIGN KEY (head_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by)      REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (dean_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (vp_approved_by)   REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (confirmed_by)     REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_user_id (user_id),
  INDEX idx_leave_type_id (leave_type_id),
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date),
  INDEX idx_approved_by (approved_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 7. leave_attachments - ไฟล์แนบคำขอลา
-- ================================================================
-- file_name:     stored filename ~80 chars (uuid.pdf)
-- original_name: ชื่อไฟล์ไทย ~120 chars
-- file_path:     path ~200 chars (/uploads/attachments/uuid.pdf)
-- file_type:     MIME type ~50 chars (application/pdf)
-- file_size:     INT UNSIGNED max 4GB
-- ================================================================
CREATE TABLE leave_attachments (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  leave_request_id  INT UNSIGNED NOT NULL,
  file_name         VARCHAR(100) NOT NULL,
  original_name     VARCHAR(150) COMMENT 'ชื่อไฟล์ต้นฉบับ (ภาษาไทย)',
  file_path         VARCHAR(255) NOT NULL,
  file_type         VARCHAR(50),
  file_size         INT UNSIGNED COMMENT 'ขนาดไฟล์ (bytes)',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  INDEX idx_leave_request_id (leave_request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 8. holidays - วันหยุดราชการ / วันหยุดนักขัตฤกษ์
-- ================================================================
-- name: ชื่อวันหยุดไทย ~80 chars (วันคล้ายวันพระบรมราชสมภพพระบาทสมเด็จพระบรมชนกาธิเบศร)
-- description: คำอธิบายสั้น ~200 chars
-- ================================================================
CREATE TABLE holidays (
  id          SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  date        DATE         NOT NULL,
  year        YEAR         COMMENT 'ปีของวันหยุด (สำหรับ filter)',
  type        ENUM('national','special','compensatory') DEFAULT 'national'
              COMMENT 'national=วันหยุดราชการ, special=วันหยุดพิเศษ, compensatory=วันชดเชย',
  is_half_day TINYINT(1) DEFAULT 0 COMMENT 'เป็นวันหยุดครึ่งวันหรือไม่',
  description VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_holiday_date (date),
  INDEX idx_date (date),
  INDEX idx_year (year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 9. notifications - การแจ้งเตือน
-- ================================================================
-- title:   หัวข้อแจ้งเตือน ~80 chars (ใบลาถูกลงข้อมูลแล้ว)
-- message: ข้อความแจ้งเตือน ~300 chars
-- ================================================================
CREATE TABLE notifications (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  type              ENUM('leave_request','approval','rejection','confirmation',
                         'new_leave','cancellation','reminder') NOT NULL,
  title             VARCHAR(100) NOT NULL,
  message           VARCHAR(500) NOT NULL,
  related_leave_id  INT UNSIGNED,
  is_read           TINYINT(1) DEFAULT 0,
  read_at           TIMESTAMP NULL COMMENT 'เวลาที่อ่าน notification',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)          REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_leave_id) REFERENCES leave_requests(id) ON DELETE SET NULL,

  INDEX idx_user_id (user_id),
  INDEX idx_is_read (is_read),
  INDEX idx_user_unread (user_id, is_read),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- 10. leave_history - ประวัติการเปลี่ยนแปลงคำขอลา (Audit Trail)
-- ================================================================
-- old_status/new_status: ใช้ ENUM แทน VARCHAR(20) ประหยัดพื้นที่
-- note: หมายเหตุ ~300 chars
-- ================================================================
CREATE TABLE leave_history (
  id                INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  leave_request_id  INT UNSIGNED NOT NULL,
  action            ENUM('created','approved','rejected','confirmed','cancelled',
                         'edited') NOT NULL,
  action_by         INT UNSIGNED COMMENT 'FK: ผู้กระทำ',
  old_status        ENUM('pending','pending_dean','pending_vp','approved','rejected','confirmed','cancelled'),
  new_status        ENUM('pending','pending_dean','pending_vp','approved','rejected','confirmed','cancelled'),
  note              VARCHAR(500) COMMENT 'หมายเหตุเพิ่มเติม',
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (action_by)        REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_leave_request_id (leave_request_id),
  INDEX idx_action_by (action_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Seed Data: Default Faculties
-- ================================================================
INSERT INTO faculties (name, code, type) VALUES
  ('คณะครุศาสตร์',                   'EDU',   'faculty'),
  ('คณะมนุษยศาสตร์และสังคมศาสตร์',   'HUM',   'faculty'),
  ('คณะวิทยาศาสตร์',                 'SCI',   'faculty'),
  ('คณะวิทยาการจัดการ',              'MNG',   'faculty'),
  ('สำนักงานอธิการบดี',              'ADMIN', 'office');

-- ================================================================
-- Seed Data: Default Departments
-- ================================================================
INSERT INTO departments (name, code, faculty_id) VALUES
  ('สำนักงานอธิการบดี',              'ADMIN', 5),
  ('คณะครุศาสตร์',                   'EDU',   1),
  ('คณะมนุษยศาสตร์และสังคมศาสตร์',   'HUM',   2),
  ('คณะวิทยาศาสตร์',                 'SCI',   3),
  ('คณะวิทยาการจัดการ',              'MNG',   4);

-- ================================================================
-- Seed Data: Default Leave Types
-- ================================================================
INSERT INTO leave_types (name, code, description, default_days, requires_medical_cert) VALUES
  ('ลาป่วย',           'sick',       'ลาป่วยเนื่องจากเจ็บป่วย',                   60,  TRUE),
  ('ลากิจส่วนตัว',     'personal',   'ลากิจส่วนตัว',                               45,  FALSE),
  ('ลาพักผ่อน',        'vacation',   'ลาพักผ่อนประจำปี',                            10,  FALSE),
  ('ลาคลอดบุตร',       'maternity',  'ลาคลอดบุตรสำหรับพนักงานหญิง',                 90,  FALSE),
  ('ลาช่วยภรรยาคลอด',  'paternity',  'ลาช่วยภรรยาคลอดสำหรับพนักงานชาย',            15,  FALSE),
  ('ลาเลี้ยงดูบุตร',   'childcare',  'ลาเลี้ยงดูบุตร',                            150,  FALSE),
  ('ลาอุปสมบท/ฮัจย์',  'ordination', 'ลาอุปสมบทหรือประกอบพิธีฮัจย์',               120,  FALSE),
  ('ลาตรวจเลือก',      'military',   'ลาตรวจเลือกเข้ารับราชการทหาร',               60,  FALSE);

-- ================================================================
-- END OF SCHEMA V2
-- ================================================================
