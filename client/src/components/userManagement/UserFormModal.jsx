import React, { useState, useEffect, useMemo } from "react";
import {
  FaPlus,
  FaEdit,
  FaHospital,
  FaClipboardList,
  FaUmbrellaBeach,
  FaBaby,
  FaUserFriends,
  FaChild,
  FaPray,
  FaMedal,
} from "react-icons/fa";
import { useDepartments } from "../../hooks/queries/useReferenceData";
import { useCreateUser, useUpdateUser } from "../../hooks/queries/useUsers";
import { useToast } from "../common/Toast";
import { PERSONNEL_TYPES } from "../../constants/personnelTypes";

const initialFormState = {
  employeeId: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  departmentId: "",
  position: "",
  personnelType: "university_employee_academic",
  role: "employee",
  supervisorId: "",
  startDate: "",
  governmentDivision: "",
  documentNumber: "",
  unit: "",
  affiliation: "",
  leaveBalance: {
    sick: 60,
    personal: 45,
    vacation: 10,
    maternity: 90,
    paternity: 15,
    childcare: 150,
    ordination: 120,
    military: 60,
  },
};

const UserFormModal = ({
  isOpen,
  onClose,
  editingUser,
  faculties = [],
  supervisors = [],
  onSuccess,
}) => {
  const toast = useToast();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const [formData, setFormData] = useState(initialFormState);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false);
  const [supervisorSearchQuery, setSupervisorSearchQuery] = useState("");

  const { data: departments = [] } = useDepartments(selectedFacultyId);

  useEffect(() => {
    if (editingUser) {
      const userFacultyId =
        editingUser.department?.facultyId ||
        editingUser.department?.faculty?.id ||
        "";
      setSelectedFacultyId(userFacultyId ? userFacultyId.toString() : "");

      setFormData({
        employeeId: editingUser.employeeId || "",
        firstName: editingUser.firstName || "",
        lastName: editingUser.lastName || "",
        email: editingUser.email || "",
        password: "",
        departmentId:
          editingUser.departmentId || editingUser.department?.id || "",
        position: editingUser.position || "",
        personnelType:
          editingUser.personnelType || "university_employee_academic",
        role: editingUser.role || "employee",
        supervisorId:
          editingUser.supervisorId || editingUser.supervisor?.id || "",
        startDate: editingUser.startDate
          ? editingUser.startDate.split("T")[0]
          : "",
        governmentDivision: editingUser.governmentDivision || "",
        documentNumber: editingUser.documentNumber || "",
        unit: editingUser.unit || "",
        affiliation: editingUser.affiliation || "",
        leaveBalance:
          editingUser.leaveBalanceTotal ||
          editingUser.leaveBalance ||
          initialFormState.leaveBalance,
      });
    } else {
      setSelectedFacultyId("");
      setFormData(initialFormState);
    }
    setSupervisorDropdownOpen(false);
    setSupervisorSearchQuery("");
  }, [editingUser, isOpen]);

  const filteredSupervisors = useMemo(() => {
    if (!supervisorSearchQuery.trim()) {
      return supervisors;
    }
    const q = supervisorSearchQuery.toLowerCase();
    return supervisors.filter((s) => {
      const name = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      const pos = (s.position || "").toLowerCase();
      const dept = (s.department?.name || "").toLowerCase();
      return name.includes(q) || pos.includes(q) || dept.includes(q);
    });
  }, [supervisors, supervisorSearchQuery]);

  const selectedSupervisorName = useMemo(() => {
    if (!formData.supervisorId) return "";
    const sup = supervisors.find((s) => s.id === formData.supervisorId);
    if (!sup) return "";
    return `${sup.firstName} ${sup.lastName}${sup.position ? ` (${sup.position})` : ""}`;
  }, [formData.supervisorId, supervisors]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("leaveBalance.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        leaveBalance: { ...prev.leaveBalance, [field]: parseInt(value, 10) || 0 },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName) {
      toast.error("กรุณากรอกชื่อและนามสกุล");
      return;
    }
    if (!formData.email) {
      toast.error("กรุณากรอกอีเมล");
      return;
    }
    if (!formData.position) {
      toast.error("กรุณากรอกตำแหน่ง");
      return;
    }
    if (!editingUser && !formData.password) {
      toast.error("กรุณากรอกรหัสผ่านสำหรับผู้ใช้ใหม่");
      return;
    }

    try {
      if (editingUser) {
        await updateUserMutation.mutateAsync({
          id: editingUser.id || editingUser._id,
          ...formData,
        });
        toast.success("อัปเดตข้อมูลบุคลากรเรียบร้อยแล้ว");
      } else {
        await createUserMutation.mutateAsync(formData);
        toast.success("เพิ่มบุคลากรใหม่เรียบร้อยแล้ว");
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content user-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>
          {editingUser ? (
            <>
              <FaEdit style={{ marginRight: "8px" }} /> แก้ไขบุคลากร
            </>
          ) : (
            <>
              <FaPlus style={{ marginRight: "8px" }} /> เพิ่มบุคลากร
            </>
          )}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>
                {editingUser
                  ? "รหัสพนักงาน"
                  : "รหัสพนักงาน (เว้นว่างเพื่อสร้างอัตโนมัติ)"}
              </label>
              <input
                type="text"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                disabled={!!editingUser}
              />
            </div>
            <div className="form-group">
              <label>อีเมล</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>ชื่อ (โปรดระบุคำนำหน้า)</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>นามสกุล</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>คณะ/สำนัก/สถาบัน</label>
              <select
                name="facultyId"
                value={selectedFacultyId}
                onChange={(e) => {
                  setSelectedFacultyId(e.target.value);
                  setFormData({ ...formData, departmentId: "" });
                }}
                required
              >
                <option value="">-- เลือกคณะ --</option>
                {faculties.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>สาขาวิชา/หน่วยงาน</label>
              <select
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                required
                disabled={!selectedFacultyId}
              >
                <option value="">
                  {selectedFacultyId ? "-- เลือกสาขา --" : "-- เลือกคณะก่อน --"}
                </option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>ตำแหน่ง *</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>ประเภทบุคลากร (ตามระเบียบ 5 ประเภท) *</label>
              <select
                name="personnelType"
                value={formData.personnelType}
                onChange={handleChange}
                required
              >
                {PERSONNEL_TYPES.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>วันเริ่มรับราชการ/ทำงาน</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>ส่วนราชการ</label>
              <input
                type="text"
                name="governmentDivision"
                value={formData.governmentDivision}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>ที่ (เลขหนังสือ)</label>
            <input
              type="text"
              name="documentNumber"
              value={formData.documentNumber}
              onChange={handleChange}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>บทบาท</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="employee">บุคลากร</option>
                <option value="head">หัวหน้างาน</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </div>
            <div className="form-group supervisor-search-container">
              <label>หัวหน้างาน</label>
              <div className="searchable-select">
                <button
                  type="button"
                  className="searchable-select-trigger"
                  onClick={() =>
                    setSupervisorDropdownOpen(!supervisorDropdownOpen)
                  }
                  role="combobox"
                  aria-expanded={supervisorDropdownOpen}
                  aria-haspopup="listbox"
                  aria-label="เลือกหัวหน้างาน"
                >
                  <span>
                    {selectedSupervisorName || "-- ไม่มีหัวหน้างาน --"}
                  </span>
                  <span className="arrow">▼</span>
                </button>

                {supervisorDropdownOpen && (
                  <>
                    <div
                      className="select-overlay"
                      onClick={() => setSupervisorDropdownOpen(false)}
                    />
                    <div
                      className="searchable-select-dropdown"
                      role="listbox"
                    >
                      <input
                        type="text"
                        className="search-input"
                        placeholder="ค้นหาชื่อ, ตำแหน่ง หรือแผนก..."
                        value={supervisorSearchQuery}
                        onChange={(e) =>
                          setSupervisorSearchQuery(e.target.value)
                        }
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        aria-label="ค้นหารายชื่อหัวหน้างาน"
                      />
                      <div className="options-list">
                        <div
                          className={`option-item ${
                            !formData.supervisorId ? "selected" : ""
                          }`}
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              supervisorId: "",
                            }));
                            setSupervisorDropdownOpen(false);
                            setSupervisorSearchQuery("");
                          }}
                          role="option"
                          aria-selected={!formData.supervisorId}
                        >
                          -- ไม่มีหัวหน้างาน --
                        </div>
                        {filteredSupervisors.map((sup) => (
                          <div
                            key={sup.id}
                            className={`option-item ${
                              formData.supervisorId === sup.id ? "selected" : ""
                            }`}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                supervisorId: sup.id,
                              }));
                              setSupervisorDropdownOpen(false);
                              setSupervisorSearchQuery("");
                            }}
                            role="option"
                            aria-selected={formData.supervisorId === sup.id}
                          >
                            <div className="option-name">
                              {sup.firstName} {sup.lastName}
                            </div>
                            <div className="option-sub">
                              {sup.position}{" "}
                              {sup.department?.name
                                ? `(${sup.department.name})`
                                : ""}
                            </div>
                          </div>
                        ))}
                        {filteredSupervisors.length === 0 && (
                          <div className="no-options" role="status">
                            ไม่พบรายชื่อหัวหน้างาน
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {!editingUser && (
            <div className="form-group">
              <label>รหัสผ่าน</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required={!editingUser}
                minLength={6}
              />
            </div>
          )}

          <div className="form-section-title">วันลาคงเหลือ</div>
          <div className="form-row three-cols">
            <div className="form-group">
              <label>
                <FaHospital style={{ marginRight: "6px" }} /> ลาป่วย
              </label>
              <input
                type="number"
                name="leaveBalance.sick"
                value={formData.leaveBalance.sick}
                onChange={handleChange}
                min={0}
              />
            </div>
            <div className="form-group">
              <label>
                <FaClipboardList style={{ marginRight: "6px" }} /> ลากิจ
              </label>
              <input
                type="number"
                name="leaveBalance.personal"
                value={formData.leaveBalance.personal}
                onChange={handleChange}
                min={0}
              />
            </div>
            <div className="form-group">
              <label>
                <FaUmbrellaBeach style={{ marginRight: "6px" }} /> ลาพักร้อน
              </label>
              <input
                type="number"
                name="leaveBalance.vacation"
                value={formData.leaveBalance.vacation}
                onChange={handleChange}
                min={0}
              />
            </div>
          </div>

          <div className="form-row three-cols">
            <div className="form-group">
              <label>
                <FaBaby style={{ marginRight: "6px" }} /> ลาคลอดบุตร
              </label>
              <input
                type="number"
                name="leaveBalance.maternity"
                value={formData.leaveBalance.maternity}
                onChange={handleChange}
                min={0}
              />
            </div>
            <div className="form-group">
              <label>
                <FaUserFriends style={{ marginRight: "6px" }} />{" "}
                ลาช่วยภรรยาคลอด
              </label>
              <input
                type="number"
                name="leaveBalance.paternity"
                value={formData.leaveBalance.paternity}
                onChange={handleChange}
                min={0}
              />
            </div>
            <div className="form-group">
              <label>
                <FaChild style={{ marginRight: "6px" }} /> ลาเลี้ยงดูบุตร
              </label>
              <input
                type="number"
                name="leaveBalance.childcare"
                value={formData.leaveBalance.childcare}
                onChange={handleChange}
                min={0}
              />
            </div>
          </div>

          <div className="form-row three-cols">
            <div className="form-group">
              <label>
                <FaPray style={{ marginRight: "6px" }} /> ลาอุปสมบท
              </label>
              <input
                type="number"
                name="leaveBalance.ordination"
                value={formData.leaveBalance.ordination}
                onChange={handleChange}
                min={0}
              />
            </div>
            <div className="form-group">
              <label>
                <FaMedal style={{ marginRight: "6px" }} /> ลาตรวจเลือก
              </label>
              <input
                type="number"
                name="leaveBalance.military"
                value={formData.leaveBalance.military}
                onChange={handleChange}
                min={0}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-btn-form-edit"
              onClick={onClose}
            >
              ยกเลิก
            </button>
            <button type="submit" className="submit-btn-form-edit">
              {editingUser ? "บันทึก" : "เพิ่ม"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
