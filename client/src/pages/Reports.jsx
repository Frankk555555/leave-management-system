import React, { useState, useEffect, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { reportsAPI, facultiesAPI, departmentsAPI, usersAPI } from "../services/api";
import { useToast } from "../components/common/Toast";
import Loading from "../components/common/Loading";
import {
  FaChartBar,
  FaFileExcel,
  FaFilePdf,
  FaCalendarAlt,
  FaUsers,
  FaCheckCircle,
  FaChartLine,
  FaHospital,
  FaClipboardList,
  FaBuilding,
  FaFilter,
  FaInfoCircle,
  FaSpinner,
  FaSearch,
  FaTimes,
  FaCalendarDay,
  FaClock,
  FaPercentage,
  FaLayerGroup,
  FaArrowRight,
  FaTrophy,
} from "react-icons/fa";
import SEO, { SEOConfig } from "../components/common/SEO";
import "./Reports.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Reports = () => {
  const toast = useToast();
  const [statistics, setStatistics] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState("");
  const [exportingType, setExportingType] = useState(null);
  const [resetting, setResetting] = useState(false);

  // Filter states
  const [usersList, setUsersList] = useState([]);
  const [facultiesList, setFacultiesList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedFacultyId, setSelectedFacultyId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Time & Date range filter states
  const [filterType, setFilterType] = useState("year"); // "year", "month", "custom", "datetime"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeSlot, setTimeSlot] = useState("all");

  const thaiMonthsList = [
    { value: 1, label: "มกราคม" },
    { value: 2, label: "กุมภาพันธ์" },
    { value: 3, label: "มีนาคม" },
    { value: 4, label: "เมษายน" },
    { value: 5, label: "พฤษภาคม" },
    { value: 6, label: "มิถุนายน" },
    { value: 7, label: "กรกฎาคม" },
    { value: 8, label: "สิงหาคม" },
    { value: 9, label: "กันยายน" },
    { value: 10, label: "ตุลาคม" },
    { value: 11, label: "พฤศจิกายน" },
    { value: 12, label: "ธันวาคม" },
  ];

  useEffect(() => {
    const init = async () => {
      await fetchFilterData();
      await fetchStatistics(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!initialLoading) {
      fetchStatistics(false);
    }
  }, [
    year,
    month,
    filterType,
    startDate,
    endDate,
    startTime,
    endTime,
    timeSlot,
    selectedUserId,
    selectedFacultyId,
    selectedDepartmentId,
  ]);

  const fetchFilterData = async () => {
    try {
      const [usersRes, facultiesRes, deptsRes] = await Promise.all([
        usersAPI.getAll(),
        facultiesAPI.getAll(),
        departmentsAPI.getAll(),
      ]);
      const sortedUsers = usersRes.data.sort((a, b) =>
        a.firstName.localeCompare(b.firstName, "th")
      );
      setUsersList(sortedUsers);
      setFacultiesList(facultiesRes.data);
      setDepartmentsList(deptsRes.data);
    } catch (error) {
      console.error("Error fetching filter data:", error);
    }
  };

  const getFilterParams = () => {
    const params = {
      userId: selectedUserId || undefined,
      facultyId: selectedFacultyId || undefined,
      departmentId: selectedDepartmentId || undefined,
    };

    if (filterType === "year") {
      params.year = year;
    } else if (filterType === "month") {
      params.year = year;
      params.month = month || undefined;
    } else if (filterType === "custom") {
      params.startDate = startDate;
      params.endDate = endDate;
    } else if (filterType === "datetime") {
      params.startDate = startDate;
      params.endDate = endDate;
      params.startTime = startTime || undefined;
      params.endTime = endTime || undefined;
      params.timeSlot = timeSlot !== "all" ? timeSlot : undefined;
    }

    return params;
  };

  const fetchStatistics = async (isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setStatsLoading(true);
      }

      if (
        (filterType === "custom" || filterType === "datetime") &&
        (!startDate || !endDate)
      ) {
        setStatsLoading(false);
        if (isInitial) setInitialLoading(false);
        return;
      }

      const params = getFilterParams();
      const response = await reportsAPI.getStatistics(params);
      setStatistics(response.data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    } finally {
      if (isInitial) setInitialLoading(false);
      setStatsLoading(false);
    }
  };

  const handleFacultyChange = (e) => {
    const val = e.target.value;
    setSelectedFacultyId(val);
    setSelectedDepartmentId("");
  };

  const handleExportExcel = async () => {
    if ((filterType === "custom" || filterType === "datetime") && (!startDate || !endDate)) {
      toast.error("กรุณาเลือกช่วงวันที่ให้ครบถ้วนก่อนส่งออกรายงาน");
      return;
    }

    setExportingType("excel");
    try {
      const params = getFilterParams();
      const response = await reportsAPI.exportExcel(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      let filename = `leave-report-${year}.xlsx`;
      if (filterType === "month") {
        filename = `leave-report-${year}-month-${month || "all"}.xlsx`;
      } else if (filterType === "custom" || filterType === "datetime") {
        filename = `leave-report-${startDate}_to_${endDate}.xlsx`;
      }
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("ส่งออกไฟล์ Excel เรียบร้อยแล้ว");
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการส่งออกไฟล์");
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async () => {
    if ((filterType === "custom" || filterType === "datetime") && (!startDate || !endDate)) {
      toast.error("กรุณาเลือกช่วงวันที่ให้ครบถ้วนก่อนส่งออกรายงาน");
      return;
    }

    setExportingType("pdf");
    try {
      const params = getFilterParams();
      const response = await reportsAPI.exportPDF(params);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      let filename = `leave-report-${year}.pdf`;
      if (filterType === "month") {
        filename = `leave-report-${year}-month-${month || "all"}.pdf`;
      } else if (filterType === "custom" || filterType === "datetime") {
        filename = `leave-report-${startDate}_to_${endDate}.pdf`;
      }
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("ส่งออกไฟล์ PDF เรียบร้อยแล้ว");
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการส่งออกไฟล์");
    } finally {
      setExportingType(null);
    }
  };

  const resetAllFilters = () => {
    setSelectedUserId("");
    setSelectedFacultyId("");
    setSelectedDepartmentId("");
    setUserSearchQuery("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setTimeSlot("all");
    setMonth("");
    setYear(new Date().getFullYear());
  };

  // Month labels for Chart
  const monthNames = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
  ];

  // Modern Chart Colors
  const monthlyChartData = {
    labels: monthNames,
    datasets: [
      {
        label: "จำนวนวันลา (วัน)",
        data: statistics?.byMonth || [],
        backgroundColor: "rgba(99, 102, 241, 0.85)",
        hoverBackgroundColor: "rgba(79, 70, 229, 1)",
        borderColor: "#4f46e5",
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false,
        maxBarThickness: 32,
      },
    ],
  };

  // Dynamic Leave Types Configuration
  const leaveTypeCodeMap = {
    sick: { name: "ลาป่วย", color: "#06b6d4" },
    personal: { name: "ลากิจส่วนตัว", color: "#6366f1" },
    vacation: { name: "ลาพักผ่อน", color: "#f59e0b" },
    maternity: { name: "ลาคลอดบุตร", color: "#ec4899" },
    paternity: { name: "ลาช่วยภริยาคลอด", color: "#8b5cf6" },
    ordination: { name: "ลาอุปสมบท/ฮัจย์", color: "#eab308" },
    military: { name: "ลาตรวจเลือกทหาร", color: "#14b8a6" },
    childcare: { name: "ลาเลี้ยงดูบุตร", color: "#f97316" },
    other: { name: "อื่นๆ", color: "#64748b" },
  };

  const typeEntries = useMemo(() => {
    if (!statistics?.byType) return [];
    return Object.entries(statistics.byType)
      .map(([code, days]) => {
        const meta = leaveTypeCodeMap[code] || { name: code, color: "#64748b" };
        return {
          code,
          name: meta.name,
          color: meta.color,
          days: parseFloat(days || 0),
        };
      })
      .filter((item) => item.days > 0);
  }, [statistics?.byType]);

  const totalTypeDays = typeEntries.reduce((sum, item) => sum + item.days, 0);

  const typeChartData = {
    labels: typeEntries.length > 0 ? typeEntries.map((t) => t.name) : ["ไม่มีข้อมูล"],
    datasets: [
      {
        data: typeEntries.length > 0 ? typeEntries.map((t) => t.days) : [0],
        backgroundColor: typeEntries.length > 0 ? typeEntries.map((t) => t.color) : ["#e2e8f0"],
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: 6,
      },
    ],
  };

  const approvedCount = (statistics?.byStatus?.approved || 0) + (statistics?.byStatus?.confirmed || 0);
  const pendingCount = statistics?.byStatus?.pending || 0;
  const rejectedCount = (statistics?.byStatus?.rejected || 0) + (statistics?.byStatus?.cancelled || 0);
  const totalStatusCount = approvedCount + pendingCount + rejectedCount;

  const statusChartData = {
    labels: ["อนุมัติแล้ว", "รออนุมัติ", "ไม่อนุมัติ/ยกเลิก"],
    datasets: [
      {
        data: [approvedCount, pendingCount, rejectedCount],
        backgroundColor: [
          "#10b981", // Emerald
          "#f59e0b", // Amber
          "#ef4444", // Crimson
        ],
        borderWidth: 3,
        borderColor: "#ffffff",
        hoverOffset: 6,
      },
    ],
  };

  // KPI Calculations
  const totalRequests = statistics?.totalRequests || 0;
  const totalDays = statistics?.totalDays || 0;
  const totalEmployees = statistics?.totalEmployees || 0;
  const approvalRate = totalRequests > 0 ? ((approvedCount / totalRequests) * 100).toFixed(1) : "0.0";
  const avgDaysPerRequest = totalRequests > 0 ? (totalDays / totalRequests).toFixed(1) : "0.0";

  // Filtered lists for combobox
  const filteredUsers = useMemo(() => {
    const query = userSearchQuery.toLowerCase().trim();
    if (!query) return usersList;
    return usersList.filter(user => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const employeeId = (user.employeeId || "").toLowerCase();
      const dept = (user.department?.name || "").toLowerCase();
      return fullName.includes(query) || employeeId.includes(query) || dept.includes(query);
    });
  }, [usersList, userSearchQuery]);

  const selectedUser = usersList.find(u => String(u.id) === String(selectedUserId));
  const selectedUserName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : "";

  const filteredDepartments = selectedFacultyId
    ? departmentsList.filter(dept => String(dept.facultyId) === String(selectedFacultyId))
    : departmentsList;

  const selectedFacultyObj = facultiesList.find(f => String(f.id) === String(selectedFacultyId));
  const selectedDeptObj = departmentsList.find(d => String(d.id) === String(selectedDepartmentId));

  const hasActiveFilters = Boolean(
    selectedUserId ||
    selectedFacultyId ||
    selectedDepartmentId ||
    (filterType === "month" && month) ||
    ((filterType === "custom" || filterType === "datetime") && (startDate || endDate))
  );

  // Department Table Sorting & calculations
  const departmentEntries = useMemo(() => {
    if (!statistics?.byDepartment) return [];
    const entries = Object.entries(statistics.byDepartment);
    const maxDays = Math.max(...entries.map(([, days]) => days), 1);
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([name, days], idx) => ({
        rank: idx + 1,
        name,
        days,
        percentage: ((days / (totalDays || 1)) * 100).toFixed(1),
        barWidth: `${Math.min(100, Math.max(8, (days / maxDays) * 100))}%`,
      }));
  }, [statistics?.byDepartment, totalDays]);

  if (initialLoading) {
    return <Loading size="fullpage" text="กำลังโหลดรายงานสถิติ..." />;
  }

  return (
    <>
      <SEO {...SEOConfig.reports} />
      <div className="reports-page-container">
        {/* Executive Header */}
        <header className="reports-header">
          <div className="reports-header-text">
            <h1 className="reports-title">
              รายงานและสถิติภาพรวม
              {statsLoading && (
                <span className="reports-live-indicator">
                  <FaSpinner className="spin" /> กำลังประมวลผลข้อมูล...
                </span>
              )}
            </h1>
            <p className="reports-subtitle">
              วิเคราะห์แนวโน้มการลาของบุคลากร สถิติรายแผนก และข้อมูลสำหรับการบริหารจัดการ
            </p>
          </div>

          {/* Export & Action Hub */}
          <div className="reports-export-toolbar">
            <button
              className="export-action-btn btn-excel"
              onClick={handleExportExcel}
              disabled={!!exportingType}
              title="ส่งออกรายงานเป็นไฟล์ Microsoft Excel (.xlsx)"
            >
              {exportingType === "excel" ? (
                <><FaSpinner className="spin" /> <span>กำลังส่งออก...</span></>
              ) : (
                <><FaFileExcel className="btn-icon" /> <span>ส่งออก Excel</span></>
              )}
            </button>

            <button
              className="export-action-btn btn-pdf"
              onClick={handleExportPDF}
              disabled={!!exportingType}
              title="ส่งออกเอกสารสรุปเป็นไฟล์ PDF (.pdf)"
            >
              {exportingType === "pdf" ? (
                <><FaSpinner className="spin" /> <span>กำลังสร้าง PDF...</span></>
              ) : (
                <><FaFilePdf className="btn-icon" /> <span>ส่งออก PDF</span></>
              )}
            </button>
          </div>
        </header>

        {/* Executive Filter Console */}
        <section className="reports-filter-card">
          <div className="filter-card-header">
            <div className="filter-header-title">
              <FaFilter className="filter-title-icon" />
              <span>ตัวกรองและเงื่อนไขการค้นหา</span>
            </div>

            {/* Segmented Mode Selector */}
            <div className="filter-segmented-nav">
              <button
                type="button"
                className={`segmented-tab ${filterType === "year" ? "active" : ""}`}
                onClick={() => setFilterType("year")}
              >
                <FaCalendarAlt className="tab-icon" /> รายปีงบประมาณ
              </button>
              <button
                type="button"
                className={`segmented-tab ${filterType === "month" ? "active" : ""}`}
                onClick={() => setFilterType("month")}
              >
                <FaCalendarDay className="tab-icon" /> รายเดือน
              </button>
              <button
                type="button"
                className={`segmented-tab ${filterType === "custom" ? "active" : ""}`}
                onClick={() => setFilterType("custom")}
              >
                <FaLayerGroup className="tab-icon" /> ระบุช่วงวันที่
              </button>
              <button
                type="button"
                className={`segmented-tab ${filterType === "datetime" ? "active" : ""}`}
                onClick={() => setFilterType("datetime")}
              >
                <FaClock className="tab-icon" /> วันและเวลาละเอียด
              </button>
            </div>
          </div>

          <div className="filter-card-body">
            {/* Row 1: Time Parameters */}
            <div className="filter-controls-row">
              {(filterType === "year" || filterType === "month") && (
                <div className="control-item">
                  <label className="control-label">ปีงบประมาณ (พ.ศ.)</label>
                  <div className="select-wrapper">
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="control-input"
                    >
                      {[...Array(6)].map((_, i) => {
                        const y = new Date().getFullYear() - i + 1;
                        return (
                          <option key={y} value={y}>
                            ปีงบประมาณ {y + 543} ({y})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              )}

              {filterType === "month" && (
                <div className="control-item">
                  <label className="control-label">ประจำเดือน</label>
                  <div className="select-wrapper">
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}
                      className="control-input"
                    >
                      <option value="">-- ทุกเดือนในปีงบประมาณ --</option>
                      {thaiMonthsList.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {(filterType === "custom" || filterType === "datetime") && (
                <>
                  <div className="control-item">
                    <label className="control-label">ตั้งแต่วันที่</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="control-input date-input"
                    />
                  </div>
                  <div className="control-item">
                    <label className="control-label">ถึงวันที่</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="control-input date-input"
                    />
                  </div>
                </>
              )}

              {filterType === "datetime" && (
                <>
                  <div className="control-item">
                    <label className="control-label">เวลาเริ่มต้น</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="control-input"
                    />
                  </div>
                  <div className="control-item">
                    <label className="control-label">เวลาสิ้นสุด</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="control-input"
                    />
                  </div>
                  <div className="control-item">
                    <label className="control-label">ช่วงเวลาการลา</label>
                    <div className="select-wrapper">
                      <select
                        value={timeSlot}
                        onChange={(e) => setTimeSlot(e.target.value)}
                        className="control-input"
                      >
                        <option value="all">ทุกช่วงเวลา</option>
                        <option value="full">เต็มวัน (Full Day)</option>
                        <option value="morning">ครึ่งวันเช้า (Morning)</option>
                        <option value="afternoon">ครึ่งวันบ่าย (Afternoon)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Row 2: Organizational Dimensions */}
            <div className="filter-controls-row secondary-row">
              {/* Searchable User Combobox */}
              <div className="control-item user-combobox-item">
                <label className="control-label">ค้นหาตามรายชื่อบุคลากร</label>
                <div className="searchable-combobox">
                  <div
                    className={`combobox-trigger ${userDropdownOpen ? "active" : ""}`}
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  >
                    <div className="trigger-content">
                      <FaSearch className="search-icon-dim" />
                      <span className={selectedUserName ? "selected-text" : "placeholder-text"}>
                        {selectedUserName || "ค้นหาชื่อ-สกุล หรือรหัสบุคลากร..."}
                      </span>
                    </div>
                    {selectedUserId && (
                      <button
                        type="button"
                        className="combobox-clear-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUserId("");
                          setUserSearchQuery("");
                        }}
                        title="ล้างการเลือก"
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>

                  {userDropdownOpen && (
                    <>
                      <div
                        className="combobox-backdrop"
                        onClick={() => setUserDropdownOpen(false)}
                      />
                      <div className="combobox-menu">
                        <div className="combobox-search-box">
                          <FaSearch className="input-search-icon" />
                          <input
                            type="text"
                            className="combobox-input"
                            placeholder="พิมพ์ชื่อ นามสกุล หรือรหัส..."
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        <div className="combobox-list">
                          {filteredUsers.map((user) => (
                            <div
                              key={user.id}
                              className={`combobox-option ${selectedUserId === user.id ? "selected" : ""}`}
                              onClick={() => {
                                setSelectedUserId(user.id);
                                setUserDropdownOpen(false);
                                setUserSearchQuery("");
                              }}
                            >
                              <div className="option-avatar">
                                {user.firstName.charAt(0)}
                              </div>
                              <div className="option-details">
                                <span className="option-name">
                                  {user.firstName} {user.lastName}
                                </span>
                                <span className="option-meta">
                                  {user.employeeId && `รหัส: ${user.employeeId}`}
                                  {user.position && ` · ${user.position}`}
                                  {user.department?.name && ` (${user.department.name})`}
                                </span>
                              </div>
                            </div>
                          ))}
                          {filteredUsers.length === 0 && (
                            <div className="combobox-empty">
                              ไม่พบข้อมูลบุคลากรที่ตรงกับคำค้นหา
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Faculty Dropdown */}
              <div className="control-item">
                <label className="control-label">คณะ / สำนัก</label>
                <div className="select-wrapper">
                  <select
                    value={selectedFacultyId}
                    onChange={handleFacultyChange}
                    className="control-input"
                  >
                    <option value="">-- ทุกคณะ / ทุกหน่วยงาน --</option>
                    {facultiesList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Department Dropdown */}
              <div className="control-item">
                <label className="control-label">สาขาวิชา / ภาควิชา</label>
                <div className="select-wrapper">
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                    className="control-input"
                  >
                    <option value="">-- ทุกสาขาวิชา --</option>
                    {filteredDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Active Filter Chips & Summary */}
            {hasActiveFilters && (
              <div className="active-filters-bar">
                <span className="filters-bar-label">ตัวกรองที่เลือก:</span>
                <div className="filter-chips-list">
                  {selectedUser && (
                    <span className="filter-chip">
                      👤 {selectedUser.firstName} {selectedUser.lastName}
                      <button onClick={() => setSelectedUserId("")}>✕</button>
                    </span>
                  )}
                  {selectedFacultyObj && (
                    <span className="filter-chip">
                      🏛️ {selectedFacultyObj.name}
                      <button onClick={() => { setSelectedFacultyId(""); setSelectedDepartmentId(""); }}>✕</button>
                    </span>
                  )}
                  {selectedDeptObj && (
                    <span className="filter-chip">
                      📁 {selectedDeptObj.name}
                      <button onClick={() => setSelectedDepartmentId("")}>✕</button>
                    </span>
                  )}
                  {month && (
                    <span className="filter-chip">
                      🗓️ เดือน {thaiMonthsList.find(m => m.value === month)?.label}
                      <button onClick={() => setMonth("")}>✕</button>
                    </span>
                  )}
                  {(startDate || endDate) && (
                    <span className="filter-chip">
                      📅 {startDate || "เริ่มต้น"} ถึง {endDate || "สิ้นสุด"}
                      <button onClick={() => { setStartDate(""); setEndDate(""); }}>✕</button>
                    </span>
                  )}
                  <button
                    type="button"
                    className="clear-all-filters-btn"
                    onClick={resetAllFilters}
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Executive KPI Bento Grid */}
        <section className="reports-kpi-grid">
          {/* KPI 1 */}
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">คำขอลาทั้งหมด</span>
              <div className="kpi-icon-badge badge-indigo">
                <FaClipboardList />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-number">{totalRequests.toLocaleString()}</span>
              <span className="kpi-unit">รายการ</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-subtext">
                เฉลี่ย {avgDaysPerRequest} วัน ต่อ 1 คำขอ
              </span>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">จำนวนวันลาสะสม</span>
              <div className="kpi-icon-badge badge-cyan">
                <FaCalendarAlt />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-number">{totalDays.toLocaleString()}</span>
              <span className="kpi-unit">วันทำการ</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-subtext">
                นับรวมทุกประเภทการลาในช่วงที่เลือก
              </span>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="kpi-card">
            <div className="kpi-top">
              <span className="kpi-label">บุคลากรในระบบ</span>
              <div className="kpi-icon-badge badge-violet">
                <FaUsers />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-number">{totalEmployees.toLocaleString()}</span>
              <span className="kpi-unit">คน</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-subtext">
                บุคลากรที่ active ในระบบทั้งหมด
              </span>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="kpi-card highlight-card">
            <div className="kpi-top">
              <span className="kpi-label">อนุมัติเรียบร้อยแล้ว</span>
              <div className="kpi-icon-badge badge-emerald">
                <FaCheckCircle />
              </div>
            </div>
            <div className="kpi-value-row">
              <span className="kpi-number">{approvedCount.toLocaleString()}</span>
              <span className="kpi-badge-rate">
                {approvalRate}% อนุมัติ
              </span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-subtext">
                รออนุมัติ {pendingCount} · ไม่อนุมัติ {rejectedCount}
              </span>
            </div>
          </div>
        </section>

        {/* Executive Visual Analytics Layout */}
        <section className="reports-analytics-grid">
          {/* Main Bar Chart */}
          <div className="analytics-card chart-main-card">
            <div className="analytics-card-header">
              <div className="card-title-group">
                <div className="title-icon-wrap indigo">
                  <FaChartLine />
                </div>
                <div>
                  <h3 className="card-title">แนวโน้มสถิติการลาประจำเดือน</h3>
                  <p className="card-desc">สถิติวันลาสะสมในแต่ละเดือนตลอดรอบปีงบประมาณ</p>
                </div>
              </div>
            </div>

            <div className="chart-canvas-container">
              <Bar
                data={monthlyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      titleFont: { family: "Sarabun, sans-serif", size: 13, weight: "600" },
                      bodyFont: { family: "Sarabun, sans-serif", size: 12 },
                      padding: 12,
                      cornerRadius: 8,
                      displayColors: false,
                      callbacks: {
                        label: (ctx) => `  จำนวนวันลา: ${ctx.raw} วัน`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: {
                        font: { family: "Sarabun, sans-serif", size: 12 },
                        color: "#64748b",
                      },
                    },
                    y: {
                      beginAtZero: true,
                      grid: {
                        color: "rgba(226, 232, 240, 0.8)",
                      },
                      ticks: {
                        font: { family: "Sarabun, sans-serif", size: 12 },
                        color: "#64748b",
                        precision: 0,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          {/* Doughnut: Leave Types */}
          <div className="analytics-card chart-side-card">
            <div className="analytics-card-header">
              <div className="card-title-group">
                <div className="title-icon-wrap cyan">
                  <FaHospital />
                </div>
                <div>
                  <h3 className="card-title">สัดส่วนประเภทการลา</h3>
                  <p className="card-desc">จำแนกตามสิทธิ์การลา</p>
                </div>
              </div>
            </div>

            <div className="doughnut-canvas-container">
              <Doughnut
                data={typeChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "72%",
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      titleFont: { family: "Sarabun, sans-serif", size: 13, weight: "600" },
                      bodyFont: { family: "Sarabun, sans-serif", size: 12 },
                      padding: 12,
                      cornerRadius: 8,
                      callbacks: {
                        label: (ctx) => {
                          const val = ctx.raw;
                          const pct = totalTypeDays > 0 ? ((val / totalTypeDays) * 100).toFixed(1) : 0;
                          return ` ${ctx.label}: ${val} วัน (${pct}%)`;
                        },
                      },
                    },
                  },
                }}
              />
              <div className="doughnut-center-metric">
                <span className="metric-num">{totalTypeDays}</span>
                <span className="metric-lbl">วันรวม</span>
              </div>
            </div>

            <div className="custom-chart-legend">
              {typeEntries.length > 0 ? (
                typeEntries.map((item) => (
                  <div key={item.code} className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: item.color }} />
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-val">
                      {item.days} วัน ({totalTypeDays > 0 ? ((item.days / totalTypeDays) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                ))
              ) : (
                <div className="legend-item" style={{ justifyContent: "center", color: "#94a3b8" }}>
                  ยังไม่มีประวัติการลาที่อนุมัติ
                </div>
              )}
            </div>
          </div>

          {/* Doughnut: Status Distribution */}
          <div className="analytics-card chart-side-card">
            <div className="analytics-card-header">
              <div className="card-title-group">
                <div className="title-icon-wrap emerald">
                  <FaClipboardList />
                </div>
                <div>
                  <h3 className="card-title">สถานะคำขอลา</h3>
                  <p className="card-desc">สัดส่วนผลการพิจารณา</p>
                </div>
              </div>
            </div>

            <div className="doughnut-canvas-container">
              <Doughnut
                data={statusChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: "72%",
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      titleFont: { family: "Sarabun, sans-serif", size: 13, weight: "600" },
                      bodyFont: { family: "Sarabun, sans-serif", size: 12 },
                      padding: 12,
                      cornerRadius: 8,
                      callbacks: {
                        label: (ctx) => {
                          const val = ctx.raw;
                          const pct = totalStatusCount > 0 ? ((val / totalStatusCount) * 100).toFixed(1) : 0;
                          return ` ${ctx.label}: ${val} รายการ (${pct}%)`;
                        },
                      },
                    },
                  },
                }}
              />
              <div className="doughnut-center-metric">
                <span className="metric-num">{totalStatusCount}</span>
                <span className="metric-lbl">คำขอ</span>
              </div>
            </div>

            <div className="custom-chart-legend">
              <div className="legend-item">
                <div className="legend-dot dot-emerald" />
                <span className="legend-name">อนุมัติแล้ว</span>
                <span className="legend-val">{approvedCount} ({totalStatusCount > 0 ? ((approvedCount / totalStatusCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot dot-amber" />
                <span className="legend-name">รออนุมัติ</span>
                <span className="legend-val">{pendingCount} ({totalStatusCount > 0 ? ((pendingCount / totalStatusCount) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="legend-item">
                <div className="legend-dot dot-crimson" />
                <span className="legend-name">ไม่อนุมัติ</span>
                <span className="legend-val">{rejectedCount} ({totalStatusCount > 0 ? ((rejectedCount / totalStatusCount) * 100).toFixed(0) : 0}%)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Department Breakdown Visual Leaderboard */}
        {departmentEntries.length > 0 && (
          <section className="reports-department-section">
            <div className="dept-section-card">
              <div className="analytics-card-header">
                <div className="card-title-group">
                  <div className="title-icon-wrap violet">
                    <FaBuilding />
                  </div>
                  <div>
                    <h3 className="card-title">สถิติการลาแยกตามแผนก / สาขาวิชา</h3>
                    <p className="card-desc">จัดอันดับปริมาณวันลาสะสมเปรียบเทียบตามโครงสร้างหน่วยงาน</p>
                  </div>
                </div>
              </div>

              <div className="dept-table-wrapper">
                <table className="executive-dept-table">
                  <thead>
                    <tr>
                      <th style={{ width: "80px", textAlign: "center" }}>อันดับ</th>
                      <th>แผนก / สาขาวิชา</th>
                      <th style={{ width: "45%" }}>สัดส่วนการลาเปรียบเทียบ</th>
                      <th style={{ textAlign: "right", width: "140px" }}>จำนวนวันลา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentEntries.map((dept) => (
                      <tr key={dept.name} className="dept-table-row">
                        <td style={{ textAlign: "center" }}>
                          <span className={`rank-pill rank-${dept.rank <= 3 ? dept.rank : "default"}`}>
                            {dept.rank === 1 ? "🥇 1" : dept.rank === 2 ? "🥈 2" : dept.rank === 3 ? "🥉 3" : dept.rank}
                          </span>
                        </td>
                        <td className="dept-name-cell">
                          <span className="dept-main-name">{dept.name}</span>
                        </td>
                        <td className="dept-bar-cell">
                          <div className="dept-progress-container">
                            <div
                              className={`dept-progress-bar ${dept.rank <= 3 ? `top-${dept.rank}` : ""}`}
                              style={{ width: dept.barWidth }}
                            />
                            <span className="dept-progress-percent">{dept.percentage}%</span>
                          </div>
                        </td>
                        <td className="dept-days-cell">
                          <span className="dept-days-bold">{dept.days}</span>
                          <span className="dept-days-unit">วัน</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
};

export default Reports;
