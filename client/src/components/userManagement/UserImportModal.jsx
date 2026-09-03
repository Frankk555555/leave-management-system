import React, { useState } from "react";
import {
  FaFileImport,
  FaDatabase,
  FaNetworkWired,
  FaDownload,
  FaUsers,
  FaCog,
  FaLink,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import { usersAPI } from "../../services/api";
import { useToast } from "../common/Toast";

const UserImportModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();

  const [importTab, setImportTab] = useState("file");
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  // Sync state
  const [dbConfig, setDbConfig] = useState({
    host: "127.0.0.1",
    port: "3307",
    database: "leave_management",
    user: "root",
    password: "",
    query:
      "SELECT emp_id, first_name, last_name, email, position_title, role_name, phone_no, dept_name, faculty_name, start_date FROM mock_university_personnel",
  });

  const [apiConfig, setApiConfig] = useState({
    url: "http://localhost:5000/api/users/mock-university-api",
    headers: "",
  });

  const [sourceColumns, setSourceColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    role: "",
    phone: "",
    startDate: "",
    departmentId: "",
    facultyId: "",
    supervisorId: "",
    governmentDivision: "",
    documentNumber: "",
    unit: "",
    affiliation: "",
  });
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [isPreviewed, setIsPreviewed] = useState(false);

  if (!isOpen) return null;

  const autoMapColumns = (cols) => {
    const newMapping = { ...fieldMapping };
    const lowerCols = cols.map((c) => ({
      orig: c,
      lower: c.toLowerCase().replace(/[^a-z0-9]/g, ""),
    }));

    const findMatch = (candidates) => {
      for (const cand of candidates) {
        const match = lowerCols.find((c) => c.lower.includes(cand));
        if (match) return match.orig;
      }
      return "";
    };

    newMapping.employeeId = findMatch(["empid", "employeeid", "empcode", "code", "id", "staffid"]);
    newMapping.firstName = findMatch(["firstname", "fname", "namefirst", "thai_fname", "name"]);
    newMapping.lastName = findMatch(["lastname", "lname", "namelast", "thai_lname", "surname"]);
    newMapping.email = findMatch(["email", "mail", "emailaddress"]);
    newMapping.position = findMatch(["position", "pos", "positiontitle", "jobtitle", "title"]);
    newMapping.role = findMatch(["role", "jobrole", "rolename"]);
    newMapping.phone = findMatch(["phone", "tel", "phoneno", "mobile", "telephone"]);
    newMapping.startDate = findMatch(["startdate", "start_date", "hiredate", "entrydate"]);
    newMapping.departmentId = findMatch(["dept", "department", "deptname", "departmentname", "major"]);
    newMapping.facultyId = findMatch(["faculty", "fac", "facultyname", "division"]);
    newMapping.supervisorId = findMatch(["supervisor", "head", "manager", "leader"]);
    newMapping.governmentDivision = findMatch(["division", "governmentdivision"]);
    newMapping.documentNumber = findMatch(["documentnumber", "docno", "docnum"]);
    newMapping.unit = findMatch(["unit", "team", "section"]);
    newMapping.affiliation = findMatch(["affiliation", "affiliated", "org"]);

    setFieldMapping(newMapping);
  };

  const downloadTemplate = async () => {
    try {
      await usersAPI.downloadTemplate();
    } catch (error) {
      console.error(error);
      toast.error("ไม่สามารถดาวน์โหลดไฟล์ตัวอย่างได้");
    }
  };

  const handlePreviewFile = async (e) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("กรุณาเลือกไฟล์ที่ต้องการนำเข้า");
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      setImporting(true);
      const res = await usersAPI.previewImportFile(formData);
      setSourceColumns(res.data.columns || []);
      setPreviewRows(res.data.preview || []);
      setIsPreviewed(true);
      toast.success("อ่านตัวอย่างข้อมูลจากไฟล์สำเร็จ");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "ไม่สามารถอ่านไฟล์ได้");
    } finally {
      setImporting(false);
    }
  };

  const handleImportUsers = async (e) => {
    e.preventDefault();
    if (!importFile) {
      toast.error("กรุณาเลือกไฟล์");
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

    try {
      setImporting(true);
      const res = await usersAPI.importUsers(formData);
      setImportResults(res.data.results);
      toast.success(res.data.message || "นำเข้าข้อมูลสำเร็จ");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
    } finally {
      setImporting(false);
    }
  };

  const handleSetupMockDb = async () => {
    try {
      setImporting(true);
      const res = await usersAPI.setupMockDb();
      toast.success(res.data.message);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการตั้งค่าตารางจำลอง");
    } finally {
      setImporting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConn(true);
    try {
      if (importTab === "db") {
        const res = await usersAPI.previewDbSync(dbConfig);
        setSourceColumns(res.data.columns || []);
        setPreviewRows(res.data.preview || []);
        autoMapColumns(res.data.columns || []);
        setIsPreviewed(true);
        toast.success(res.data.message || "เชื่อมต่อฐานข้อมูลสำเร็จ");
      } else if (importTab === "api") {
        const res = await usersAPI.previewApiSync(apiConfig);
        setSourceColumns(res.data.columns || []);
        setPreviewRows(res.data.preview || []);
        autoMapColumns(res.data.columns || []);
        setIsPreviewed(true);
        toast.success(res.data.message || "เชื่อมต่อ API สำเร็จ");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "ไม่สามารถเชื่อมต่อได้"
      );
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleSyncSubmit = async (e) => {
    e.preventDefault();
    if (
      !fieldMapping.employeeId ||
      !fieldMapping.firstName ||
      !fieldMapping.lastName ||
      !fieldMapping.email ||
      !fieldMapping.position
    ) {
      toast.error("กรุณาจับคู่คอลัมน์ที่จำเป็นให้ครบถ้วน (รหัส, ชื่อ, สกุล, อีเมล, ตำแหน่ง)");
      return;
    }

    try {
      setImporting(true);
      let res;
      if (importTab === "db") {
        res = await usersAPI.executeDbSync({
          ...dbConfig,
          mapping: fieldMapping,
        });
      } else {
        res = await usersAPI.executeApiSync({
          ...apiConfig,
          mapping: fieldMapping,
        });
      }

      setImportResults(res.data.results);
      toast.success(res.data.message || "ซิงค์ข้อมูลสำเร็จ");
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการซิงค์ข้อมูล");
    } finally {
      setImporting(false);
    }
  };

  const renderMappingUI = () => (
    <div className="mapping-section">
      <h4>
        <FaCog style={{ marginRight: "6px" }} /> ตั้งค่าการจับคู่คอลัมน์ (Column Mapping)
      </h4>
      <p className="mapping-subtitle">
        จับคู่ฟิลด์ของระบบปลายทางเข้ากับโครงสร้างฐานข้อมูลของระบบจัดการวันลา
      </p>
      <div className="mapping-grid">
        <div className="mapping-group required">
          <label>รหัสพนักงาน (Employee ID) *</label>
          <select
            value={fieldMapping.employeeId}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, employeeId: e.target.value })
            }
            required
          >
            <option value="">-- เลือกคอลัมน์ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group required">
          <label>ชื่อ (First Name) *</label>
          <select
            value={fieldMapping.firstName}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, firstName: e.target.value })
            }
            required
          >
            <option value="">-- เลือกคอลัมน์ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group required">
          <label>นามสกุล (Last Name) *</label>
          <select
            value={fieldMapping.lastName}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, lastName: e.target.value })
            }
            required
          >
            <option value="">-- เลือกคอลัมน์ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group required">
          <label>อีเมล (Email) *</label>
          <select
            value={fieldMapping.email}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, email: e.target.value })
            }
            required
          >
            <option value="">-- เลือกคอลัมน์ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group required">
          <label>ตำแหน่ง (Position) *</label>
          <select
            value={fieldMapping.position}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, position: e.target.value })
            }
            required
          >
            <option value="">-- เลือกคอลัมน์ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group">
          <label>บทบาท (Role)</label>
          <select
            value={fieldMapping.role}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, role: e.target.value })
            }
          >
            <option value="">-- ไม่ระบุ (ค่าเริ่มต้น: employee) --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group">
          <label>สาขาวิชา/หน่วยงาน (Department)</label>
          <select
            value={fieldMapping.departmentId}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, departmentId: e.target.value })
            }
          >
            <option value="">-- ไม่ระบุ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group">
          <label>คณะ/สถาบัน (Faculty)</label>
          <select
            value={fieldMapping.facultyId}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, facultyId: e.target.value })
            }
          >
            <option value="">-- ไม่ระบุ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group">
          <label>เบอร์โทรศัพท์ (Phone)</label>
          <select
            value={fieldMapping.phone}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, phone: e.target.value })
            }
          >
            <option value="">-- ไม่ระบุ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="mapping-group">
          <label>วันเริ่มรับราชการ (Start Date)</label>
          <select
            value={fieldMapping.startDate}
            onChange={(e) =>
              setFieldMapping({ ...fieldMapping, startDate: e.target.value })
            }
          >
            <option value="">-- ไม่ระบุ --</option>
            {sourceColumns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderDataPreview = () => {
    if (!previewRows || previewRows.length === 0) return null;
    return (
      <div className="preview-section">
        <h4>
          <FaUsers style={{ marginRight: "6px" }} /> ตัวอย่างข้อมูล 5 รายการแรก
        </h4>
        <div className="preview-table-wrapper">
          <table className="preview-table">
            <thead>
              <tr>
                {sourceColumns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={idx}>
                  {sourceColumns.map((col) => (
                    <td key={col}>{String(row[col] ?? "-")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content import-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="import-modal-tabs">
          <button
            type="button"
            className={`tab-btn ${importTab === "file" ? "active" : ""}`}
            onClick={() => {
              setImportTab("file");
              setImportResults(null);
              setIsPreviewed(false);
            }}
          >
            <FaFileImport /> นำเข้าไฟล์ CSV/Excel
          </button>
          <button
            type="button"
            className={`tab-btn ${importTab === "db" ? "active" : ""}`}
            onClick={() => {
              setImportTab("db");
              setImportResults(null);
              setIsPreviewed(false);
            }}
          >
            <FaDatabase /> ซิงค์ฐานข้อมูล (SQL)
          </button>
          <button
            type="button"
            className={`tab-btn ${importTab === "api" ? "active" : ""}`}
            onClick={() => {
              setImportTab("api");
              setImportResults(null);
              setIsPreviewed(false);
            }}
          >
            <FaNetworkWired /> ซิงค์จาก API (JSON)
          </button>
        </div>

        {!importResults ? (
          <div>
            {/* TAB 1: FILE UPLOAD */}
            {importTab === "file" && (
              <form
                onSubmit={isPreviewed ? handleImportUsers : handlePreviewFile}
              >
                {!isPreviewed ? (
                  <>
                    <div className="import-info">
                      <p>
                        อัปโหลดไฟล์ CSV หรือ Excel (.xlsx) ที่มีข้อมูลบุคลากร
                      </p>
                      <div className="template-info">
                        <div style={{ marginBottom: "6px" }}>
                          <strong>คอลัมน์บังคับ (Required):</strong>
                          <br />
                          <code>firstName, lastName, email, position</code>
                          <br />
                          <small style={{ color: "#e53e3e" }}>
                            * หากไม่มีคอลัมน์ password ระบบจะสร้างให้อัตโนมัติ
                          </small>
                        </div>
                        <div>
                          <strong>คอลัมน์เสริมที่รองรับ (Optional):</strong>
                          <br />
                          <code>
                            password, role(บทบาท), facultyId(คณะ),
                            departmentId(สาขาวิชา/หน่วยงาน),
                            supervisorId(หัวหน้างาน), phone, startDate,
                            affiliation
                          </code>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="download-template-btn"
                        onClick={downloadTemplate}
                      >
                        <FaDownload style={{ marginRight: "6px" }} />
                        ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
                      </button>
                    </div>

                    <div className="form-group">
                      <label>เลือกไฟล์</label>
                      <input
                        type="file"
                        className="import-file-input"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => setImportFile(e.target.files[0])}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>{renderDataPreview()}</>
                )}

                <div className="modal-actions">
                  {isPreviewed ? (
                    <>
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => {
                          setIsPreviewed(false);
                          setPreviewRows([]);
                          setSourceColumns([]);
                        }}
                      >
                        กลับไปเลือกไฟล์ใหม่
                      </button>
                      <button
                        type="submit"
                        className="submit-btn-import-submit"
                        disabled={importing || !previewRows.length}
                      >
                        {importing ? (
                          <>
                            <span className="import-spinner" />
                            กำลังนำเข้า...
                          </>
                        ) : (
                          <>
                            <FaFileImport style={{ marginRight: "6px" }} />
                            ยืนยันการนำเข้า
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={onClose}
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        className="submit-btn-import-submit"
                        disabled={importing || !importFile}
                      >
                        {importing ? (
                          <>
                            <span className="import-spinner" />
                            กำลังตรวจสอบ...
                          </>
                        ) : (
                          <>
                            <FaUsers style={{ marginRight: "6px" }} />
                            ตรวจสอบข้อมูล (Preview)
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

            {/* TAB 2: DATABASE SYNC */}
            {importTab === "db" && (
              <div>
                <div className="sync-help-banner">
                  <p>
                    เชื่อมโยงและนำเข้าข้อมูลโดยตรงจากฐานข้อมูล SQL อื่น
                    เช่น ระบบทะเบียนหรือบุคลากรของมหาวิทยาลัย
                  </p>
                  <button
                    type="button"
                    className="mock-setup-btn"
                    onClick={handleSetupMockDb}
                    disabled={importing}
                  >
                    <FaCog /> ตั้งค่าตารางจำลองในระบบเพื่อทดสอบ
                  </button>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Host / IP *</label>
                    <input
                      type="text"
                      value={dbConfig.host}
                      onChange={(e) =>
                        setDbConfig({ ...dbConfig, host: e.target.value })
                      }
                      placeholder="127.0.0.1"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Port *{" "}
                      <small style={{ color: "#6b7280", fontWeight: "normal" }}>
                        (MySQL เครื่องนี้: 3307)
                      </small>
                    </label>
                    <input
                      type="text"
                      value={dbConfig.port}
                      onChange={(e) =>
                        setDbConfig({ ...dbConfig, port: e.target.value })
                      }
                      placeholder="3307"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>ชื่อฐานข้อมูล (Database) *</label>
                    <input
                      type="text"
                      value={dbConfig.database}
                      onChange={(e) =>
                        setDbConfig({
                          ...dbConfig,
                          database: e.target.value,
                        })
                      }
                      placeholder="leave_management"
                    />
                  </div>
                  <div className="form-group">
                    <label>ชื่อผู้ใช้ (Username) *</label>
                    <input
                      type="text"
                      value={dbConfig.user}
                      onChange={(e) =>
                        setDbConfig({ ...dbConfig, user: e.target.value })
                      }
                      placeholder="root"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>รหัสผ่าน (Password)</label>
                  <input
                    type="password"
                    value={dbConfig.password}
                    onChange={(e) =>
                      setDbConfig({
                        ...dbConfig,
                        password: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>คำสั่ง SQL Query ดึงข้อมูล *</label>
                  <textarea
                    className="sql-query-input"
                    value={dbConfig.query}
                    onChange={(e) =>
                      setDbConfig({ ...dbConfig, query: e.target.value })
                    }
                    placeholder="SELECT * FROM personnel_table"
                    rows={3}
                  />
                </div>

                {!isPreviewed ? (
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={onClose}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      className="test-conn-btn"
                      onClick={handleTestConnection}
                      disabled={
                        isTestingConn ||
                        !dbConfig.host ||
                        !dbConfig.database ||
                        !dbConfig.user ||
                        !dbConfig.query
                      }
                    >
                      {isTestingConn ? (
                        <>
                          <FaSpinner className="icon-spin" />{" "}
                          กำลังตรวจสอบ...
                        </>
                      ) : (
                        <>
                          <FaLink /> ทดสอบเชื่อมต่อและดึงคอลัมน์
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSyncSubmit}>
                    {renderMappingUI()}
                    {renderDataPreview()}
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setIsPreviewed(false)}
                      >
                        แก้ไขการเชื่อมต่อ
                      </button>
                      <button
                        type="submit"
                        className="submit-btn-sync-execute"
                        disabled={importing}
                      >
                        {importing ? (
                          <>
                            <FaSpinner className="icon-spin" />{" "}
                            กำลังนำเข้าและซิงค์...
                          </>
                        ) : (
                          <>
                            <FaDatabase /> ดำเนินการซิงค์ข้อมูล
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 3: REST API SYNC */}
            {importTab === "api" && (
              <div>
                <div className="sync-help-banner">
                  <p>
                    ดึงข้อมูลและนำเข้าจากเว็บบริการ (REST API Endpoint)
                    ของมหาวิทยาลัย ซึ่งตอบกลับในรูปแบบ JSON Array
                  </p>
                  <button
                    type="button"
                    className="mock-setup-btn"
                    onClick={() => {
                      setApiConfig({
                        url: "http://localhost:5000/api/users/mock-university-api",
                        headers: "",
                      });
                      toast.success(
                        "กรอกที่อยู่ Mock API มหาวิทยาลัย เรียบร้อย"
                      );
                    }}
                  >
                    <FaLink /> ใช้ที่อยู่ Mock API มหาวิทยาลัย
                  </button>
                </div>

                <div className="form-group">
                  <label>API Endpoint URL *</label>
                  <input
                    type="url"
                    value={apiConfig.url}
                    onChange={(e) =>
                      setApiConfig({ ...apiConfig, url: e.target.value })
                    }
                    placeholder="https://api.university.ac.th/v1/personnel"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    Authorization Header / API Key (ระบุเป็น JSON หรือ Token
                    ดิบ)
                  </label>
                  <input
                    type="text"
                    value={apiConfig.headers}
                    onChange={(e) =>
                      setApiConfig({
                        ...apiConfig,
                        headers: e.target.value,
                      })
                    }
                    placeholder='{"Authorization": "Bearer key_here"} หรือ key_here'
                  />
                </div>

                {!isPreviewed ? (
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={onClose}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="button"
                      className="test-conn-btn"
                      onClick={handleTestConnection}
                      disabled={isTestingConn || !apiConfig.url}
                    >
                      {isTestingConn ? (
                        <>
                          <FaSpinner className="icon-spin" />{" "}
                          กำลังตรวจสอบ...
                        </>
                      ) : (
                        <>
                          <FaLink /> ดึงข้อมูลเพื่อตั้งค่าคอลัมน์
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSyncSubmit}>
                    {renderMappingUI()}
                    {renderDataPreview()}
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="cancel-btn"
                        onClick={() => setIsPreviewed(false)}
                      >
                        แก้ไขการเชื่อมต่อ
                      </button>
                      <button
                        type="submit"
                        className="submit-btn-sync-execute"
                        disabled={importing}
                      >
                        {importing ? (
                          <>
                            <FaSpinner className="icon-spin" />{" "}
                            กำลังนำเข้าและซิงค์...
                          </>
                        ) : (
                          <>
                            <FaNetworkWired /> ดำเนินการซิงค์ข้อมูล
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="import-results">
            <div className="results-summary">
              <div className="result-success">
                <FaCheckCircle />
                <span>สำเร็จ: {importResults.success.length} รายการ</span>
              </div>
              <div className="result-failed">
                <FaTimesCircle />
                <span>ล้มเหลว: {importResults.failed.length} รายการ</span>
              </div>
            </div>

            {importResults.success.length > 0 && (
              <div className="success-list">
                <strong>รายการที่ซิงค์สำเร็จ:</strong>
                <ul>
                  {importResults.success.map((item, index) => (
                    <li key={index} className="success-item">
                      <FaCheckCircle
                        style={{
                          color: "#38a169",
                          marginRight: "6px",
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        <strong>{item.name}</strong> ({item.employeeId}) -{" "}
                        <span className={`badge-action ${item.action}`}>
                          {item.action === "created"
                            ? "สร้างใหม่"
                            : "อัปเดตข้อมูล"}
                        </span>
                        {item.tempPassword && (
                          <span className="temp-password-badge">
                            รหัสผ่านเริ่มต้น: <code>{item.tempPassword}</code>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResults.failed.length > 0 && (
              <div className="failed-list">
                <strong>รายการที่ล้มเหลว:</strong>
                <ul>
                  {importResults.failed.map((item, index) => (
                    <li key={index}>
                      แถว/รายการที่ {item.row} ({item.employeeId || "-"}):{" "}
                      {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setImportResults(null);
                  setIsPreviewed(false);
                  setImportFile(null);
                }}
              >
                ซิงค์เพิ่มเติม
              </button>
              <button className="submit-btn" onClick={onClose}>
                ปิดหน้านี้
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserImportModal;
