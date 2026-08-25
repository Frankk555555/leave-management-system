import React, { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { holidaysAPI } from "../services/api";
import { useHolidays } from "../hooks/queries/useHolidays";
import { useToast } from "../components/common/Toast";
import Loading from "../components/common/Loading";
import {
  FaCalendarAlt,
  FaCalendarPlus,
  FaPlus,
  FaEdit,
  FaTrash,
  FaClock,
  FaInfoCircle,
  FaTimes,
  FaCalendarDay,
  FaSearch,
} from "react-icons/fa";
import SEO, { SEOConfig } from "../components/common/SEO";
import "./HolidayManagement.css";

const MONTH_NAMES_TH = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const HolidayManagement = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const { data: holidays = [], isLoading: loading } = useHolidays(selectedYear);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    date: "",
    description: "",
    isHalfDay: false,
  });

  const handleInitialize = async () => {
    const confirmed = await toast.confirm(
      `ต้องการดึงข้อมูลวันหยุดราชการและวันสำคัญมาตรฐานประจำปี พ.ศ. ${selectedYear + 543} หรือไม่?`,
      "นำเข้าวันหยุดมาตรฐาน"
    );
    if (!confirmed) return;
    try {
      await holidaysAPI.initialize(selectedYear);
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success(`ดึงวันหยุดราชการประจำปี พ.ศ. ${selectedYear + 543} เรียบร้อยแล้ว`);
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการนำเข้า");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toDateInputString = (dateVal) => {
    if (!dateVal) return "";
    if (typeof dateVal === "string") {
      return dateVal.split("T")[0];
    }
    const d = new Date(dateVal);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseLocalDate = (date) => {
    if (!date) return new Date();
    if (typeof date === "string" && date.includes("-")) {
      const [y, m, d] = date.split("T")[0].split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(date);
  };

  const formatDateFull = (date) => {
    if (!date) return "";
    const localDate = parseLocalDate(date);
    return localDate.toLocaleDateString("th-TH", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getWeekdayName = (date) => {
    if (!date) return "";
    const localDate = parseLocalDate(date);
    return localDate.toLocaleDateString("th-TH", { weekday: "long" });
  };

  const getHolidayDay = (date) => {
    if (!date) return "";
    const localDate = parseLocalDate(date);
    return localDate.getDate();
  };

  const getHolidayMonthShort = (date) => {
    if (!date) return "";
    const localDate = parseLocalDate(date);
    return localDate.toLocaleDateString("th-TH", { month: "short" });
  };

  const openModal = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        name: holiday.name,
        date: toDateInputString(holiday.date),
        description: holiday.description || "",
        isHalfDay: Boolean(holiday.isHalfDay),
      });
    } else {
      setEditingHoliday(null);
      // Default to selectedYear-01-01
      const defaultDate = `${selectedYear}-01-01`;
      setFormData({
        name: "",
        date: defaultDate,
        description: "",
        isHalfDay: false,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.date) {
      toast.error("กรุณากรอกชื่อวันหยุดและวันที่ให้ครบถ้วน");
      return;
    }
    setSaving(true);
    try {
      if (editingHoliday) {
        await holidaysAPI.update(
          editingHoliday.id || editingHoliday._id,
          formData
        );
        toast.success("แก้ไขวันหยุดเรียบร้อยแล้ว");
      } else {
        await holidaysAPI.create(formData);
        toast.success("เพิ่มวันหยุดใหม่เรียบร้อยแล้ว");
      }
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const confirmed = await toast.confirm(
      `คุณต้องการลบวันหยุด "${name}" หรือไม่?`,
      "ยืนยันการลบวันหยุด"
    );
    if (!confirmed) return;
    try {
      await holidaysAPI.delete(id);
      await queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("ลบวันหยุดเรียบร้อยแล้ว");
    } catch (error) {
      toast.error(error.response?.data?.message || "เกิดข้อผิดพลาดในการลบ");
    }
  };

  // Filter & Grouping by Month
  const filteredHolidays = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return holidays;
    return holidays.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.description && h.description.toLowerCase().includes(q)) ||
        formatDateFull(h.date).toLowerCase().includes(q)
    );
  }, [holidays, searchQuery]);

  // Group holidays chronologically by Month (0 to 11)
  const monthlyGroups = useMemo(() => {
    const groups = {};
    filteredHolidays.forEach((h) => {
      const d = parseLocalDate(h.date);
      const m = d.getMonth();
      if (!groups[m]) groups[m] = [];
      groups[m].push(h);
    });

    // Sort months ascending
    return Object.keys(groups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((monthIndex) => ({
        monthIndex,
        monthName: MONTH_NAMES_TH[monthIndex],
        items: groups[monthIndex].sort(
          (a, b) => parseLocalDate(a.date) - parseLocalDate(b.date)
        ),
      }));
  }, [filteredHolidays]);

  // Next Upcoming Holiday Spotlight
  const upcomingHoliday = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const upcoming = holidays
      .map((h) => ({ ...h, parsedDate: parseLocalDate(h.date) }))
      .filter((h) => h.parsedDate >= now)
      .sort((a, b) => a.parsedDate - b.parsedDate);

    if (upcoming.length === 0) return null;

    const next = upcoming[0];
    const diffTime = next.parsedDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let countdownLabel = "";
    if (diffDays === 0) {
      countdownLabel = "วันนี้!";
    } else if (diffDays === 1) {
      countdownLabel = "พรุ่งนี้";
    } else {
      countdownLabel = `อีก ${diffDays} วัน`;
    }

    return {
      ...next,
      diffDays,
      countdownLabel,
    };
  }, [holidays]);

  // Stats calculation
  const totalHolidays = holidays.length;
  const halfDaysCount = holidays.filter((h) => h.isHalfDay).length;
  const fullDaysCount = totalHolidays - halfDaysCount;

  if (loading) {
    return (
      <>
        <SEO {...SEOConfig.holidays} />
        <Loading size="fullpage" text="กำลังโหลดรายการวันหยุด..." />
      </>
    );
  }

  return (
    <>
      <SEO {...SEOConfig.holidays} />
      <div className="holiday-page-container">
        {/* Executive Header */}
        <header className="holiday-header">
          <div className="holiday-header-text">
            <h1 className="holiday-title">จัดการวันหยุดราชการและวันสำคัญ</h1>
            <p className="holiday-subtitle">
              กำหนดปฏิทินวันหยุดประจำปีสำหรับคำนวณวันทำการ สิทธิ์วันลา และการแจ้งเตือนในระบบ
            </p>
          </div>

          <div className="holiday-toolbar">
            {/* Year Selector Dropdown */}
            <div className="year-select-pill">
              <span className="year-label">ปี พ.ศ.</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="year-dropdown"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y + 543} ({y})
                  </option>
                ))}
              </select>
            </div>

            <button
              className="toolbar-btn btn-secondary"
              onClick={handleInitialize}
              title="ดึงรายการวันหยุดราชการมาตรฐานประจำปี"
            >
              <FaCalendarPlus className="btn-icon" />
              <span>ดึงวันหยุดมาตรฐาน</span>
            </button>

            <button
              className="toolbar-btn btn-primary"
              onClick={() => openModal(null)}
            >
              <FaPlus className="btn-icon" />
              <span>เพิ่มวันหยุด</span>
            </button>
          </div>
        </header>

        {/* Next Upcoming Holiday Spotlight Banner */}
        {upcomingHoliday && (
          <section className="holiday-spotlight-card">
            <div className="spotlight-badge-row">
              <span className="spotlight-tag">
                <FaCalendarDay className="tag-icon" /> วันหยุดถัดไป
              </span>
              <span className="countdown-pill">{upcomingHoliday.countdownLabel}</span>
            </div>
            <div className="spotlight-content-row">
              <div className="spotlight-main">
                <h3 className="spotlight-holiday-name">{upcomingHoliday.name}</h3>
                <p className="spotlight-date-text">
                  {formatDateFull(upcomingHoliday.date)}
                  {upcomingHoliday.isHalfDay && (
                    <span className="spotlight-half-badge">
                      <FaClock className="icon-tiny" /> ครึ่งวัน
                    </span>
                  )}
                </p>
                {upcomingHoliday.description && (
                  <span className="spotlight-desc">
                    {upcomingHoliday.description}
                  </span>
                )}
              </div>

              <div className="spotlight-stats-group">
                <div className="mini-stat-item">
                  <span className="stat-num">{totalHolidays}</span>
                  <span className="stat-lbl">วันหยุดรวม (พ.ศ. {selectedYear + 543})</span>
                </div>
                <div className="mini-stat-divider" />
                <div className="mini-stat-item">
                  <span className="stat-num">{fullDaysCount}</span>
                  <span className="stat-lbl">เต็มวัน</span>
                </div>
                {halfDaysCount > 0 && (
                  <>
                    <div className="mini-stat-divider" />
                    <div className="mini-stat-item">
                      <span className="stat-num">{halfDaysCount}</span>
                      <span className="stat-lbl">ครึ่งวัน</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Search Bar */}
        <section className="holiday-search-section">
          <div className="search-bar-wrapper">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="ค้นหาชื่อวันหยุด หรือวันที่..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
                aria-label="ล้างคำค้นหา"
              >
                <FaTimes />
              </button>
            )}
          </div>
          <div className="holiday-count-badge">
            แสดง {filteredHolidays.length} จาก {holidays.length} วัน
          </div>
        </section>

        {/* Empty State */}
        {monthlyGroups.length === 0 ? (
          <div className="holiday-empty-state">
            <div className="empty-state-icon">
              <FaCalendarAlt />
            </div>
            <h3>ไม่พบข้อมูลวันหยุด</h3>
            <p>
              {searchQuery
                ? "ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง"
                : `ยังไม่มีข้อมูลวันหยุดสำหรับปี พ.ศ. ${selectedYear + 543} คลิกปุ่มด้านล่างเพื่อนำเข้าข้อมูลมาตรฐาน`}
            </p>
            {!searchQuery && (
              <button className="empty-action-btn" onClick={handleInitialize}>
                <FaCalendarPlus /> ดึงวันหยุดมาตรฐาน พ.ศ. {selectedYear + 543}
              </button>
            )}
          </div>
        ) : (
          /* Monthly Chronological Groups */
          <div className="monthly-timeline-container">
            {monthlyGroups.map((group) => (
              <div key={group.monthIndex} className="month-group-card">
                <div className="month-header-marker">
                  <div className="month-title-row">
                    <span className="month-name-text">
                      {group.monthName} {selectedYear + 543}
                    </span>
                    <span className="month-count-pill">{group.items.length} วัน</span>
                  </div>
                </div>

                <div className="holiday-items-grid">
                  {group.items.map((holiday) => {
                    const isPast =
                      parseLocalDate(holiday.date).getTime() <
                      new Date().setHours(0, 0, 0, 0);

                    return (
                      <div
                        key={holiday.id || holiday._id}
                        className={`holiday-item-card ${isPast ? "is-past" : ""}`}
                      >
                        {/* Calendar Tear-sheet Date Block */}
                        <div className="date-block">
                          <span className="date-month-abbr">
                            {getHolidayMonthShort(holiday.date)}
                          </span>
                          <span className="date-number">
                            {getHolidayDay(holiday.date)}
                          </span>
                        </div>

                        {/* Holiday Details */}
                        <div className="holiday-detail-body">
                          <div className="holiday-title-row">
                            <h4 className="holiday-name">{holiday.name}</h4>
                            <div className="holiday-badges">
                              <span className="weekday-pill">
                                {getWeekdayName(holiday.date)}
                              </span>
                              {holiday.isHalfDay && (
                                <span className="half-day-pill" title="วันหยุดครึ่งวัน">
                                  <FaClock className="icon-xs" /> ครึ่งวัน
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="holiday-date-subtext">
                            {formatDateFull(holiday.date)}
                          </div>

                          {holiday.description && (
                            <p className="holiday-desc-text">
                              {holiday.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="holiday-card-actions">
                          <button
                            className="card-icon-btn edit-btn"
                            onClick={() => openModal(holiday)}
                            title="แก้ไขข้อมูลวันหยุดนี้"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="card-icon-btn delete-btn"
                            onClick={() =>
                              handleDelete(holiday.id || holiday._id, holiday.name)
                            }
                            title="ลบวันหยุดนี้"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add/Edit Holiday */}
        {modalOpen && (
          <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
            <div
              className="holiday-modal-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <div className="modal-title-group">
                  <div className="modal-icon-pill">
                    {editingHoliday ? <FaEdit /> : <FaPlus />}
                  </div>
                  <div>
                    <h3 className="modal-title">
                      {editingHoliday ? "แก้ไขวันหยุด" : "เพิ่มวันหยุดใหม่"}
                    </h3>
                    <p className="modal-desc">
                      {editingHoliday
                        ? `ปรับปรุงรายละเอียดของ ${editingHoliday.name}`
                        : "กำหนดวันหยุดราชการหรือวันสำคัญเพิ่มเติมในระบบ"}
                    </p>
                  </div>
                </div>
                <button
                  className="modal-close-btn"
                  onClick={() => setModalOpen(false)}
                  aria-label="ปิดหน้าต่าง"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="modal-form">
                <div className="form-group">
                  <label className="form-label">
                    ชื่อวันหยุด <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="เช่น วันสงกรานต์, วันจักรี, วันหยุดพิเศษ"
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    วันที่ <span className="req-star">*</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="form-control"
                    required
                  />
                  {formData.date && (
                    <span className="field-date-preview">
                      📅 {formatDateFull(formData.date)}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">คำอธิบายรายละเอียด (ถ้ามี)</label>
                  <input
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="เช่น Songkran Festival / ชดเชยวันหยุด..."
                    className="form-control"
                  />
                </div>

                <div className="form-checkbox-card">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      name="isHalfDay"
                      checked={formData.isHalfDay}
                      onChange={handleChange}
                      className="toggle-input"
                    />
                    <span className="toggle-switch" />
                    <span className="toggle-text-block">
                      <strong>เป็นวันหยุดครึ่งวัน (Half-Day Holiday)</strong>
                      <small>ระบบจะนับจำนวนวันทำงาน 0.5 วันในวันดังกล่าว</small>
                    </span>
                  </label>
                </div>

                <div className="modal-footer-actions">
                  <button
                    type="button"
                    className="modal-btn btn-ghost"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="modal-btn btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "กำลังบันทึก..."
                      : editingHoliday
                      ? "บันทึกการแก้ไข"
                      : "เพิ่มวันหยุด"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default HolidayManagement;
