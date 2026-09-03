import React, { useState, useEffect, useRef } from "react";
import { usersAPI, facultiesAPI, departmentsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/common/Toast";
import config from "../config";
import {
  FaUser,
  FaSave,
  FaCamera,
  FaEnvelope,
  FaPhone,
  FaLock,
  FaIdCard,
  FaBuilding,
  FaBriefcase,
  FaUniversity,
  FaFileAlt,
  FaSitemap,
  FaUserTag,
} from "react-icons/fa";
import { getPersonnelTypeLabel } from "../constants/personnelTypes";
import SEO, { SEOConfig } from "../components/common/SEO";
import "./Profile.css";

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const signatureInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState("");

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    departmentId: "",
    governmentDivision: "",
    documentNumber: "",
    unit: "",
    affiliation: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetchFaculties();
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        departmentId: user.departmentId || user.department?.id || "",
        governmentDivision: user.governmentDivision || "",
        documentNumber: user.documentNumber || "",
        unit: user.unit || "",
        affiliation: user.affiliation || "",
        password: "",
        confirmPassword: "",
      });

      // Set initial faculty if user has department
      if (user.department?.facultyId) {
        setSelectedFacultyId(user.department.facultyId);
      }
    }
  }, [user]);

  // Fetch departments when faculty changes
  useEffect(() => {
    if (selectedFacultyId) {
      fetchDepartments(selectedFacultyId);
    } else {
      setDepartments([]);
    }
  }, [selectedFacultyId]);

  const fetchFaculties = async () => {
    try {
      const response = await facultiesAPI.getAll();
      setFaculties(response.data);
    } catch (error) {
      console.error("Error fetching faculties:", error);
    }
  };

  const fetchDepartments = async (facultyId) => {
    try {
      const response = await departmentsAPI.getAll(facultyId);
      setDepartments(response.data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate passwords if changing
    if (formData.password && formData.password.trim() !== "") {
      // ต้องกรอกยืนยันรหัสผ่านด้วย
      if (!formData.confirmPassword || formData.confirmPassword.trim() === "") {
        toast.error("กรุณากรอกยืนยันรหัสผ่านใหม่");
        return;
      }

      // รหัสผ่านต้องตรงกัน
      if (formData.password !== formData.confirmPassword) {
        toast.error("รหัสผ่านไม่ตรงกัน");
        return;
      }

      // รหัสผ่านต้องมีอย่างน้อย 6 ตัว
      if (formData.password.length < 6) {
        toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
        return;
      }
    }

    setLoading(true);
    try {
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        departmentId: formData.departmentId,
        governmentDivision: formData.governmentDivision,
        documentNumber: formData.documentNumber,
        unit: formData.unit,
        affiliation: formData.affiliation,
      };

      // Only include password if it's being changed
      if (formData.password && formData.password.trim() !== "") {
        updateData.password = formData.password;
      }

      await usersAPI.updateProfile(updateData);
      toast.success("อัปเดตโปรไฟล์เรียบร้อยแล้ว");

      // Clear password fields
      setFormData({
        ...formData,
        password: "",
        confirmPassword: "",
      });

      // Refresh user data in context
      if (refreshUser) {
        await refreshUser();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append("profileImage", file);

      const response = await usersAPI.updateProfileImage(formData);
      toast.success("อัปเดตรูปโปรไฟล์เรียบร้อยแล้ว");

      // Refresh user state immediately
      await refreshUser();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "เกิดข้อผิดพลาดในการอัปโหลดรูป"
      );
    } finally {
      setImageLoading(false);
      // Reset input value so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getProfileImageUrl = () => {
    if (user?.profileImage) {
      if (user.profileImage.startsWith("http://") || user.profileImage.startsWith("https://")) {
        return user.profileImage;
      }
      let normalized = user.profileImage.replace(/\\/g, "/");
      if (!normalized.startsWith("/")) normalized = "/" + normalized;
      return `${config.API_URL}${normalized}`;
    }
    return null;
  };

  const handleSignatureClick = () => {
    signatureInputRef.current?.click();
  };

  const handleSignatureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return;
    }

    setSignatureLoading(true);
    try {
      const formData = new FormData();
      formData.append("signatureImage", file);

      const response = await usersAPI.updateSignatureImage(formData);
      toast.success("อัปเดตลายเซ็นต์เรียบร้อยแล้ว");

      // Refresh user context เพื่อให้ signatureImage อัปเดตเลย
      await refreshUser();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "เกิดข้อผิดพลาดในการอัปโหลดลายเซ็นต์"
      );
    } finally {
      setSignatureLoading(false);
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  };

  const getSignatureImageUrl = () => {
    if (user?.signatureImage) {
      if (user.signatureImage.startsWith("http://") || user.signatureImage.startsWith("https://")) {
        return user.signatureImage;
      }
      let normalized = user.signatureImage.replace(/\\/g, "/");
      if (!normalized.startsWith("/")) normalized = "/" + normalized;
      return `${config.API_URL}${normalized}`;
    }
    return null;
  };

  return (
    <>
      <SEO {...SEOConfig.profile} />
      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-header">
            <h1>
              <FaUser style={{ marginRight: "10px" }} />
              โปรไฟล์ของฉัน
            </h1>
            <p>แก้ไขข้อมูลส่วนตัวของคุณ</p>
          </div>

          <div className="profile-content">
            {/* Profile & Signature Image Section */}
            <div className="profile-image-section-container">
              <div className="profile-image-section">
                <h3>รูปโปรไฟล์</h3>
                <div
                  className={`profile-avatar ${imageLoading ? "loading" : ""}`}
                  onClick={handleImageClick}
                >
                  {getProfileImageUrl() ? (
                    <img src={getProfileImageUrl()} alt="Profile" />
                  ) : (
                    <div className="avatar-placeholder">
                      <FaUser size={48} />
                    </div>
                  )}
                  <div className="avatar-overlay">
                    <FaCamera size={24} />
                    <span>เปลี่ยนรูป</span>
                  </div>
                  {imageLoading && (
                    <div className="avatar-loading">กำลังอัปโหลด...</div>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/jfif,image/*"
                  style={{ display: "none" }}
                />
                <p className="image-hint">
                  คลิกเพื่อเปลี่ยนรูป (สูงสุด 5MB)
                </p>
              </div>

              <div className="profile-image-section" style={{ flex: '1', minWidth: '250px' }}>
                <h3>รูปลายเซ็นต์ (สำหรับใบลา)</h3>
                <div
                  className={`profile-avatar ${signatureLoading ? "loading" : ""}`}
                  onClick={handleSignatureClick}
                  style={{ borderRadius: '8px', width: '200px', height: '100px', margin: '0 auto 1rem' }}
                >
                  {getSignatureImageUrl() ? (
                    <img src={getSignatureImageUrl()} alt="Signature" style={{ objectFit: 'contain' }} />
                  ) : (
                    <div className="avatar-placeholder" style={{ borderRadius: '8px' }}>
                      <span style={{ fontSize: '24px', color: '#a0aec0' }}>(ลงชื่อ)</span>
                    </div>
                  )}
                  <div className="avatar-overlay" style={{ borderRadius: '8px' }}>
                    <FaCamera size={24} />
                    <span>เปลี่ยนลายเซ็นต์</span>
                  </div>
                  {signatureLoading && (
                    <div className="avatar-loading" style={{ borderRadius: '8px' }}>กำลังอัปโหลด...</div>
                  )}
                </div>
                <input
                  type="file"
                  ref={signatureInputRef}
                  onChange={handleSignatureChange}
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/*"
                  style={{ display: "none" }}
                />
                <p className="image-hint">
                  คลิกเพื่อเปลี่ยนลายเซ็นต์ (สูงสุด 5MB แนะนำให้ใช้พื้นหลังโปร่งใส)
                </p>
              </div>
            </div>

            {/* User Info Display */}
            <div className="profile-info-card">
              <div className="info-item">
                <FaIdCard className="info-icon" />
                <div>
                  <label>รหัสพนักงาน</label>
                  <span>{user?.employeeId}</span>
                </div>
              </div>
              <div className="info-item">
                <FaBuilding className="info-icon" />
                <div>
                  <label>สาขา/หน่วยงาน</label>
                  <span>{user?.department?.name || "-"}</span>
                </div>
              </div>
              <div className="info-item">
                <FaBriefcase className="info-icon" />
                <div>
                  <label>ตำแหน่ง</label>
                  <span>{user?.position || "-"}</span>
                </div>
              </div>
              <div className="info-item">
                <FaUserTag className="info-icon" />
                <div>
                  <label>ประเภทบุคลากร</label>
                  <span>{getPersonnelTypeLabel(user?.personnelType)}</span>
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSubmit} className="profile-form">
              <h3>แก้ไขข้อมูลส่วนตัว</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <FaUser style={{ marginRight: "6px" }} />
                    ชื่อ (โปรดระบุคำนำหน้า)
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    <FaUser style={{ marginRight: "6px" }} />
                    นามสกุล
                  </label>
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
                  <label>
                    <FaEnvelope style={{ marginRight: "6px" }} />
                    อีเมล
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>
                    <FaPhone style={{ marginRight: "6px" }} />
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <FaUniversity style={{ marginRight: "6px" }} />
                    ส่วนราชการ
                  </label>
                  <input
                    type="text"
                    name="governmentDivision"
                    value={formData.governmentDivision}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>
                    <FaFileAlt style={{ marginRight: "6px" }} />
                    ที่
                  </label>
                  <input
                    type="text"
                    name="documentNumber"
                    value={formData.documentNumber}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <h3 style={{ marginTop: "1.5rem" }}>
                เปลี่ยนรหัสผ่าน (ถ้าต้องการ)
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    <FaLock style={{ marginRight: "6px" }} />
                    รหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="เว้นว่างถ้าไม่ต้องการเปลี่ยน"
                  />
                </div>
                <div className="form-group">
                  <label>
                    <FaLock style={{ marginRight: "6px" }} />
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="ยืนยันรหัสผ่านใหม่"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="save-btn" disabled={loading}>
                  <FaSave style={{ marginRight: "6px" }} />
                  {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
