import React, { useState, useMemo } from "react";
import {
  useUsers,
  useSupervisors,
  useDeleteUser,
} from "../hooks/queries/useUsers";
import {
  useFaculties,
  useDepartments,
} from "../hooks/queries/useReferenceData";
import { useToast } from "../components/common/Toast";
import Loading from "../components/common/Loading";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaHospital,
  FaClipboardList,
  FaUmbrellaBeach,
  FaKey,
  FaFileImport,
  FaBaby,
  FaUserFriends,
  FaChild,
  FaPray,
  FaMedal,
} from "react-icons/fa";
import SEO, { SEOConfig } from "../components/common/SEO";
import useCollectionQuery from "../hooks/useCollectionQuery";
import UserFormModal from "../components/userManagement/UserFormModal";
import PasswordResetModal from "../components/userManagement/PasswordResetModal";
import UserImportModal from "../components/userManagement/UserImportModal";
import "./UserManagement.css";

const mapUserBalances = (u) => {
  const balances = u.leaveBalances || [];
  const map = {
    sick: 0,
    personal: 0,
    vacation: 0,
    maternity: 0,
    paternity: 0,
    childcare: 0,
    ordination: 0,
    military: 0,
  };
  const totalMap = { ...map };

  balances.forEach((b) => {
    const code = b.leaveType?.code || "";
    if (code in map) {
      map[code] = Math.max(
        0,
        (parseFloat(b.totalDays) || 0) +
          (parseFloat(b.carriedOverDays) || 0) -
          (parseFloat(b.usedDays) || 0)
      );
      totalMap[code] = parseFloat(b.totalDays) || 0;
    }
  });

  return {
    ...u,
    leaveBalance: map,
    leaveBalanceTotal: totalMap,
  };
};

const getRoleBadge = (role) => {
  switch (role) {
    case "admin":
      return <span className="role-badge admin">ผู้ดูแลระบบ</span>;
    case "head":
      return <span className="role-badge head">หัวหน้างาน</span>;
    default:
      return <span className="role-badge employee">บุคลากร</span>;
  }
};

const UserManagement = () => {
  const toast = useToast();
  const { data: usersData = [], isLoading: loading } = useUsers();
  const { data: supervisors = [] } = useSupervisors();
  const { data: faculties = [] } = useFaculties();
  const deleteUserMutation = useDeleteUser();

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Collapsible user details state
  const [expandedUserId, setExpandedUserId] = useState(null);

  const users = useMemo(() => {
    return [...usersData]
      .sort((a, b) =>
        (a.employeeId || "").localeCompare(
          b.employeeId || "",
          undefined,
          { numeric: true }
        )
      )
      .map(mapUserBalances);
  }, [usersData]);

  // Deep Collection Query Engine
  const {
    items: filteredUsers,
    search: searchQuery,
    setSearch: setSearchQuery,
    filters,
    setFilter,
    setFilters,
  } = useCollectionQuery(users, {
    searchFields: [
      (u) => `${u.firstName || ""} ${u.lastName || ""}`,
      "employeeId",
      "email",
      "position",
    ],
    initialFilters: {
      role: "all",
      facultyId: "all",
      departmentId: "all",
    },
    filterExtractors: {
      facultyId: (u) =>
        u.department?.facultyId || u.department?.faculty?.id || "",
      departmentId: (u) => u.departmentId || u.department?.id || "",
    },
  });

  const filterRole = filters.role || "all";
  const filterFaculty = filters.facultyId || "all";
  const filterDepartment = filters.departmentId || "all";
  const { data: filterDepartments = [] } = useDepartments(filterFaculty);

  const setFilterRole = (role) => setFilter("role", role);
  const setFilterFaculty = (facultyId) => {
    setFilters((prev) => ({
      ...prev,
      facultyId,
      departmentId: "all",
    }));
  };
  const setFilterDepartment = (departmentId) =>
    setFilter("departmentId", departmentId);

  const toggleUserExpand = (userId) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const openModal = (user = null) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const openResetModal = (user) => {
    setUserToReset(user);
    setResetModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("คุณต้องการลบบุคลากรนี้ใช่หรือไม่?")) {
      return;
    }
    try {
      await deleteUserMutation.mutateAsync(id);
      toast.success("ลบบุคลากรเรียบร้อยแล้ว");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการลบ");
    }
  };

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.users} />
        <Loading size="fullpage" text="กำลังโหลด..." />
      </>
    );
  }

  return (
    <>
      <SEO {...SEOConfig.users} />
      <div className="user-management-page">
        <div className="page-header">
          <div>
            <h1>จัดการบุคลากร</h1>
            <p>จัดการข้อมูลบุคลากรในระบบ ({users.length} คน)</p>
          </div>
          <div className="header-actions">
            <button className="import-btn" onClick={() => setImportModalOpen(true)}>
              <FaFileImport />
              นำเข้าข้อมูล
            </button>
            <button className="add-btn" onClick={() => openModal()}>
              <FaPlus />
              เพิ่มบุคลากร
            </button>
          </div>
        </div>

        {/* Directory Filters & Search Bar */}
        <div className="directory-filter-bar">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="ค้นหาบุคลากร (ชื่อ, รหัส, อีเมล, ตำแหน่ง)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="directory-search-input"
              aria-label="ค้นหารายชื่อบุคลากร"
            />
          </div>
          <div className="selects-wrapper">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="directory-filter-select"
              aria-label="กรองตามบทบาท"
            >
              <option value="all">ทุกบทบาท</option>
              <option value="admin">ผู้ดูแลระบบ (Admin)</option>
              <option value="head">หัวหน้างาน (Head)</option>
              <option value="employee">บุคลากร (Employee)</option>
            </select>

            <select
              value={filterFaculty}
              onChange={(e) => {
                setFilterFaculty(e.target.value);
              }}
              className="directory-filter-select"
              aria-label="กรองตามคณะ/สถาบัน"
            >
              <option value="all">ทุกคณะ/ส่วนงาน</option>
              {faculties.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name}
                </option>
              ))}
            </select>

            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="directory-filter-select"
              disabled={filterFaculty === "all"}
              aria-label="กรองตามสาขา/ฝ่ายงาน"
            >
              <option value="all">ทุกสาขา/หน่วยงาน</option>
              {filterDepartments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop View: Table Layout */}
        <div className="users-table-container desktop-only">
          <table className="users-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}></th>
                <th>รหัส</th>
                <th>ชื่อ-นามสกุล</th>
                <th>อีเมล</th>
                <th>สาขาวิชา/หน่วยงาน</th>
                <th>ตำแหน่ง</th>
                <th>บทบาท</th>
                <th>วันลาคงเหลือ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isExpanded = expandedUserId === (user.id || user._id);
                return (
                  <React.Fragment key={user.id || user._id}>
                    <tr className={isExpanded ? "row-expanded" : ""}>
                      <td>
                        <button
                          type="button"
                          className={`row-expand-btn ${isExpanded ? "active" : ""}`}
                          onClick={() => toggleUserExpand(user.id || user._id)}
                          aria-expanded={isExpanded}
                          aria-label="แสดงรายละเอียดวันลาคงเหลือทั้งหมด"
                        >
                          ▶
                        </button>
                      </td>
                      <td>{user.employeeId}</td>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar">
                            {user.firstName?.charAt(0)}
                          </div>
                          <span>
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.department?.name || user.department || "-"}</td>
                      <td>{user.position}</td>
                      <td>{getRoleBadge(user.role)}</td>
                      <td>
                        <div className="leave-balance-cell">
                          <span title="ลาป่วย">
                            <FaHospital /> {user.leaveBalance?.sick || 0}
                          </span>
                          <span title="ลากิจ">
                            <FaClipboardList />{" "}
                            {user.leaveBalance?.personal || 0}
                          </span>
                          <span title="ลาพักร้อน">
                            <FaUmbrellaBeach />{" "}
                            {user.leaveBalance?.vacation || 0}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons-cell">
                          <button
                            className="edit-btn-admin"
                            onClick={() => openModal(user)}
                            title="แก้ไข"
                            aria-label={`แก้ไขข้อมูลของ ${user.firstName} ${user.lastName}`}
                          >
                            <FaEdit style={{ color: "white" }} />
                            <span>แก้ไข</span>
                          </button>
                          <button
                            className="reset-btn-admin"
                            onClick={() => openResetModal(user)}
                            title="รีเซ็ตรหัสผ่าน"
                            aria-label={`รีเซ็ตรหัสผ่านของ ${user.firstName} ${user.lastName}`}
                          >
                            <FaKey style={{ color: "white" }} />
                            <span>รีเซ็ต</span>
                          </button>
                          <button
                            className="delete-btn-admin"
                            onClick={() => handleDelete(user.id || user._id)}
                            title="ลบ"
                            aria-label={`ลบรายชื่อของ ${user.firstName} ${user.lastName}`}
                          >
                            <FaTrash style={{ color: "white" }} />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-detail-row">
                        <td colSpan="9">
                          <div className="expanded-detail-content">
                            <div className="detail-header">
                              วันลาคงเหลือทั้งหมดของ {user.firstName}{" "}
                              {user.lastName}
                            </div>
                            <div className="detail-grid">
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaHospital />
                                </span>
                                <span className="detail-label">ลาป่วย:</span>
                                <span className="detail-value">
                                  {user.leaveBalance?.sick || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaClipboardList />
                                </span>
                                <span className="detail-label">ลากิจ:</span>
                                <span className="detail-value">
                                  {user.leaveBalance?.personal || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaUmbrellaBeach />
                                </span>
                                <span className="detail-label">ลาพักร้อน:</span>
                                <span className="detail-value">
                                  {user.leaveBalance?.vacation || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaBaby />
                                </span>
                                <span className="detail-label">
                                  ลาคลอดบุตร:
                                </span>
                                <span className="detail-value">
                                  {user.leaveBalance?.maternity || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaUserFriends />
                                </span>
                                <span className="detail-label">
                                  ลาช่วยภรรยาคลอด:
                                </span>
                                <span className="detail-value">
                                  {user.leaveBalance?.paternity || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaChild />
                                </span>
                                <span className="detail-label">
                                  ลาเลี้ยงดูบุตร:
                                </span>
                                <span className="detail-value">
                                  {user.leaveBalance?.childcare || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaPray />
                                </span>
                                <span className="detail-label">ลาอุปสมบท:</span>
                                <span className="detail-value">
                                  {user.leaveBalance?.ordination || 0} วัน
                                </span>
                              </div>
                              <div className="detail-item">
                                <span className="detail-icon">
                                  <FaMedal />
                                </span>
                                <span className="detail-label">
                                  ลาตรวจเลือก:
                                </span>
                                <span className="detail-value">
                                  {user.leaveBalance?.military || 0} วัน
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      padding: "2.5rem 1rem",
                      color: "#a0aec0",
                    }}
                  >
                    {searchQuery ||
                    filterRole !== "all" ||
                    filterFaculty !== "all" ||
                    filterDepartment !== "all"
                      ? `ไม่พบบุคลากรที่ตรงกับการค้นหา`
                      : "ยังไม่มีข้อมูลบุคลากรในระบบ"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Card-Stack Layout */}
        <div className="users-cards-list mobile-only">
          {filteredUsers.map((user) => {
            const isExpanded = expandedUserId === (user.id || user._id);
            return (
              <div className="user-card" key={user.id || user._id}>
                <div className="user-card-header">
                  <div className="user-cell">
                    <div className="user-avatar">
                      {user.firstName?.charAt(0)}
                    </div>
                    <div>
                      <div className="user-card-name">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="user-card-email">{user.email}</div>
                    </div>
                  </div>
                  <div>{getRoleBadge(user.role)}</div>
                </div>

                <div className="user-card-body">
                  <div className="user-card-info">
                    <span className="info-label">รหัส:</span>
                    <span className="info-value">{user.employeeId}</span>
                  </div>
                  <div className="user-card-info">
                    <span className="info-label">หน่วยงาน:</span>
                    <span className="info-value">
                      {user.department?.name || user.department || "-"}
                    </span>
                  </div>
                  <div className="user-card-info">
                    <span className="info-label">ตำแหน่ง:</span>
                    <span className="info-value">{user.position}</span>
                  </div>
                  <div className="user-card-info balances">
                    <span className="info-label">วันลาคงเหลือ:</span>
                    <div className="leave-balance-cell">
                      <span title="ลาป่วย">
                        <FaHospital /> {user.leaveBalance?.sick || 0}
                      </span>
                      <span title="ลากิจ">
                        <FaClipboardList /> {user.leaveBalance?.personal || 0}
                      </span>
                      <span title="ลาพักร้อน">
                        <FaUmbrellaBeach /> {user.leaveBalance?.vacation || 0}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="card-expand-toggle"
                      onClick={() => toggleUserExpand(user.id || user._id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded
                        ? "ซ่อนรายละเอียดวันลาทั้งหมด ▲"
                        : "แสดงรายละเอียดวันลาทั้งหมด ▼"}
                    </button>
                    {isExpanded && (
                      <div className="card-expanded-balances">
                        <div className="balance-grid-mini">
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaHospital /> ลาป่วย:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.sick || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaClipboardList /> ลากิจ:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.personal || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaUmbrellaBeach /> ลาพักร้อน:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.vacation || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaBaby /> ลาคลอดบุตร:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.maternity || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaUserFriends /> ลาช่วยภรรยาคลอด:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.paternity || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaChild /> ลาเลี้ยงดูบุตร:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.childcare || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaPray /> ลาอุปสมบท:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.ordination || 0} วัน
                            </span>
                          </div>
                          <div className="balance-item-mini">
                            <span className="balance-label">
                              <FaMedal /> ลาตรวจเลือก:
                            </span>
                            <span className="balance-value">
                              {user.leaveBalance?.military || 0} วัน
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="user-card-actions">
                  <button
                    className="edit-btn-admin"
                    onClick={() => openModal(user)}
                    title="แก้ไข"
                    aria-label={`แก้ไขข้อมูลของ ${user.firstName} ${user.lastName}`}
                  >
                    <FaEdit style={{ color: "white" }} />
                    <span>แก้ไข</span>
                  </button>
                  <button
                    className="reset-btn-admin"
                    onClick={() => openResetModal(user)}
                    title="รีเซ็ตรหัสผ่าน"
                    aria-label={`รีเซ็ตรหัสผ่านของ ${user.firstName} ${user.lastName}`}
                  >
                    <FaKey style={{ color: "white" }} />
                    <span>รีเซ็ต</span>
                  </button>
                  <button
                    className="delete-btn-admin"
                    onClick={() => handleDelete(user.id || user._id)}
                    title="ลบ"
                    aria-label={`ลบรายชื่อของ ${user.firstName} ${user.lastName}`}
                  >
                    <FaTrash style={{ color: "white" }} />
                    <span>ลบ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* User Form Modal */}
        <UserFormModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          editingUser={editingUser}
          faculties={faculties}
          supervisors={supervisors}
        />

        {/* Reset Password Modal */}
        <PasswordResetModal
          isOpen={resetModalOpen}
          onClose={() => setResetModalOpen(false)}
          user={userToReset}
        />

        {/* User Import / DB Sync / API Sync Modal */}
        <UserImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
        />
      </div>
    </>
  );
};

export default UserManagement;
