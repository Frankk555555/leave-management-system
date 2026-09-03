const {
  LeaveRequest,
  User,
  Holiday,
  Department,
  LeaveType,
} = require("../models");
const { Op } = require("sequelize");

// @desc    Get weekly leave report for n8n
// @route   GET /api/webhooks/weekly-report
// @access  Public (secured by API key)
const getWeeklyReport = async (req, res) => {
  try {
    // Verify API key
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    // Get date range
    const now = new Date();
    let startDate, endDate;

    if (req.query.all === "true") {
      // Get all data (last 365 days)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 365);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default: Last 7 days (weekly report)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    }

    // Get leave requests for the period with LeaveType
    const leaveRequests = await LeaveRequest.findAll({
      where: {
        [Op.or]: [
          {
            startDate: {
              [Op.between]: [startDate, endDate],
            },
          },
          {
            endDate: {
              [Op.between]: [startDate, endDate],
            },
          },
          {
            [Op.and]: [
              { startDate: { [Op.lte]: startDate } },
              { endDate: { [Op.gte]: endDate } },
            ],
          },
        ],
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "lastName", "email", "personnelType"],
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["name"],
            },
          ],
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "firstName", "lastName"],
        },
        {
          model: LeaveType,
          as: "leaveType",
          attributes: ["id", "name", "code"],
        },
      ],
      order: [["startDate", "ASC"]],
    });

    // Get statistics
    const stats = {
      total: leaveRequests.length,
      totalRequests: leaveRequests.length,
      approved: leaveRequests.filter((r) => r.status === "approved" || r.status === "confirmed").length,
      pending: leaveRequests.filter((r) => r.status === "pending").length,
      rejected: leaveRequests.filter((r) => r.status === "rejected").length,
      confirmed: leaveRequests.filter((r) => r.status === "confirmed").length,
      cancelled: leaveRequests.filter((r) => r.status === "cancelled").length,
    };

    // 1. Count by leave type (using name for chart labels)
    const byType = {};
    leaveRequests.forEach((r) => {
      const typeName = r.leaveType?.name || r.leaveType?.code || "อื่นๆ";
      byType[typeName] = (byType[typeName] || 0) + 1;
    });

    // 2. Count by personnel type (5 types from Scope 1.4.2)
    const personnelTypeLabels = {
      civil_servant_academic: "ข้าราชการ (ผู้สอน)",
      civil_servant_support: "ข้าราชการ (สนับสนุน)",
      university_employee_academic: "พนักงาน มรภ. (ผู้สอน)",
      university_employee_support: "พนักงาน มรภ. (สนับสนุน)",
      contract_lecturer: "อาจารย์อัตราจ้าง",
      temporary_employee: "ลูกจ้างชั่วคราว",
    };
    const byPersonnelType = {};
    leaveRequests.forEach((r) => {
      const rawType = r.user?.personnelType || "university_employee_academic";
      const label = personnelTypeLabels[rawType] || rawType;
      byPersonnelType[label] = (byPersonnelType[label] || 0) + 1;
    });

    // 3. Count by department
    const byDepartment = {};
    leaveRequests.forEach((r) => {
      const dept = r.user?.department?.name || "ไม่ระบุ";
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    });

    // 4. Calculate leave trend (daily breakdown)
    const trendMap = {};
    leaveRequests.forEach((r) => {
      if (r.startDate) {
        const d = new Date(r.startDate);
        const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
        trendMap[dayLabel] = (trendMap[dayLabel] || 0) + 1;
      }
    });
    const trendLabels = Object.keys(trendMap);
    const trendValues = Object.values(trendMap);

    // Get holidays this week
    const holidays = await Holiday.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    // Total days on leave
    const totalLeaveDays = leaveRequests
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + parseFloat(r.totalDays), 0);

    // 5. Generate QuickChart URLs (Scope 1.4.5.4)
    const buildQuickChartUrl = (config, width = 600, height = 300) => {
      return `https://quickchart.io/chart?c=${encodeURIComponent(
        JSON.stringify(config)
      )}&w=${width}&h=${height}&bkg=white`;
    };

    // 5.1 Pie/Donut Chart: Leave Types (สัดส่วนประเภทการลา)
    const pieLabels = Object.keys(byType);
    const pieValues = Object.values(byType);
    const pieChartConfig = {
      type: "doughnut",
      data: {
        labels: pieLabels.length > 0 ? pieLabels : ["ไม่มีข้อมูลการลา"],
        datasets: [
          {
            data: pieValues.length > 0 ? pieValues : [1],
            backgroundColor:
              pieLabels.length > 0
                ? ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]
                : ["#cbd5e1"],
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: "สัดส่วนประเภทการลา (Leave Types)",
          fontSize: 14,
          fontColor: "#1e293b",
        },
        plugins: {
          legend: { position: "right" },
        },
      },
    };
    const pieChartUrl = buildQuickChartUrl(pieChartConfig);

    // 5.2 Line Chart: Leave Trend (กราฟแสดงแนวโน้มการลา ตามข้อ 1.4.5.4)
    const trendChartConfig = {
      type: "line",
      data: {
        labels: trendLabels.length > 0 ? trendLabels : ["ไม่มีข้อมูล"],
        datasets: [
          {
            label: "จำนวนคำขอลา (รายการ)",
            data: trendValues.length > 0 ? trendValues : [0],
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79, 70, 229, 0.15)",
            fill: true,
            tension: 0.3,
            pointBackgroundColor: "#4f46e5",
            pointRadius: 4,
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: "แนวโน้มการลา (Leave Trend)",
          fontSize: 14,
          fontColor: "#1e293b",
        },
        scales: {
          yAxes: [
            {
              ticks: {
                beginAtZero: true,
                stepSize: 1,
                precision: 0,
              },
            },
          ],
        },
      },
    };
    const trendChartUrl = buildQuickChartUrl(trendChartConfig);

    // 5.3 Bar Chart: Personnel Types (สถิติตามประเภทบุคลากร 5 ประเภท ตามข้อ 1.4.2)
    const pLabels = Object.keys(byPersonnelType);
    const pValues = Object.values(byPersonnelType);
    const personnelChartConfig = {
      type: "bar",
      data: {
        labels: pLabels.length > 0 ? pLabels : ["ไม่มีข้อมูล"],
        datasets: [
          {
            label: "จำนวนคำขอลา (รายการ)",
            data: pValues.length > 0 ? pValues : [0],
            backgroundColor: [
              "#1d4ed8",
              "#0369a1",
              "#15803d",
              "#047857",
              "#b45309",
              "#6d28d9",
            ],
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: "สถิติการลาแยกตามประเภทบุคลากร 5 ประเภท",
          fontSize: 14,
          fontColor: "#1e293b",
        },
        legend: { display: false },
        scales: {
          yAxes: [
            {
              ticks: {
                beginAtZero: true,
                stepSize: 1,
                precision: 0,
              },
            },
          ],
        },
      },
    };
    const personnelChartUrl = buildQuickChartUrl(personnelChartConfig);

    // 5.4 Bar Chart: Departments
    const deptLabels = Object.keys(byDepartment);
    const deptValues = Object.values(byDepartment);
    const barChartConfig = {
      type: "bar",
      data: {
        labels: deptLabels.length > 0 ? deptLabels : ["ไม่มีข้อมูล"],
        datasets: [
          {
            label: "คำขอลาตามสาขา/แผนก (รายการ)",
            data: deptValues.length > 0 ? deptValues : [0],
            backgroundColor: "#06b6d4",
          },
        ],
      },
      options: {
        title: {
          display: true,
          text: "สถิติการลาแยกตามสาขา/แผนก",
          fontSize: 14,
          fontColor: "#1e293b",
        },
        scales: {
          yAxes: [
            {
              ticks: {
                beginAtZero: true,
                stepSize: 1,
                precision: 0,
              },
            },
          ],
        },
      },
    };
    const barChartUrl = buildQuickChartUrl(barChartConfig);

    // Format for AI summary
    const summaryData = {
      weekRange: {
        start: startDate.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        end: endDate.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      },
      statistics: stats,
      byLeaveType: byType,
      byPersonnelType,
      byDepartment,
      trend: trendMap,
      totalLeaveDays,
      charts: {
        pieChartUrl,
        trendChartUrl,
        personnelChartUrl,
        barChartUrl,
      },
      pieChartUrl,
      trendChartUrl,
      personnelChartUrl,
      barChartUrl,
      holidays: holidays.map((h) => ({
        name: h.name,
        date: new Date(h.date).toLocaleDateString("th-TH"),
      })),
      leaveDetails: leaveRequests.map((r) => ({
        employee: `${r.user?.firstName || ""} ${r.user?.lastName || ""}`,
        personnelType:
          personnelTypeLabels[r.user?.personnelType] ||
          r.user?.personnelType ||
          "ไม่ระบุ",
        department: r.user?.department?.name || "ไม่ระบุ",
        type: r.leaveType?.name || "ไม่ระบุ",
        startDate: new Date(r.startDate).toLocaleDateString("th-TH"),
        endDate: new Date(r.endDate).toLocaleDateString("th-TH"),
        totalDays: r.totalDays,
        status:
          r.status === "approved"
            ? "อนุมัติ"
            : r.status === "pending"
            ? "รออนุมัติ"
            : r.status === "rejected"
            ? "ปฏิเสธ"
            : r.status === "confirmed"
            ? "ยืนยันแล้ว"
            : "ยกเลิก",
        reason: r.reason,
      })),
      textSummary: generateTextSummary(
        stats,
        byType,
        byPersonnelType,
        byDepartment,
        totalLeaveDays,
        leaveRequests.length
      ),
    };

    res.json(summaryData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
};

// Generate text summary for AI
const generateTextSummary = (stats, byType, byPersonnelType, byDepartment, totalDays, total) => {
  let summary = `รายงานสรุปการลาประจำสัปดาห์\n\n`;
  summary += `📊 สถิติภาพรวม:\n`;
  summary += `- คำขอลาทั้งหมด: ${total} รายการ\n`;
  summary += `- อนุมัติแล้ว: ${stats.approved} / รออนุมัติ: ${stats.pending} / ไม่อนุมัติ: ${stats.rejected}\n`;
  summary += `- รวมวันลา (อนุมัติ): ${totalDays} วัน\n\n`;

  summary += `🏥 แยกตามประเภทการลา:\n`;
  Object.entries(byType).forEach(([code, count]) => {
    summary += `- ${code}: ${count} รายการ\n`;
  });
  summary += `\n`;

  if (byPersonnelType && Object.keys(byPersonnelType).length > 0) {
    summary += `👥 แยกตามประเภทบุคลากร 5 ประเภท:\n`;
    Object.entries(byPersonnelType).forEach(([label, count]) => {
      summary += `- ${label}: ${count} รายการ\n`;
    });
    summary += `\n`;
  }

  summary += `🏢 แยกตามแผนก:\n`;
  Object.entries(byDepartment).forEach(([dept, count]) => {
    summary += `- ${dept}: ${count} รายการ\n`;
  });

  return summary;
};

// @desc    Webhook to receive n8n callbacks
// @route   POST /api/webhooks/n8n-callback
// @access  Public (secured by API key)
const n8nCallback = async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.N8N_API_KEY) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    const { action, data } = req.body;

    console.log("n8n callback received:", action, data);

    // Handle different actions from n8n
    switch (action) {
      case "report_sent":
        console.log("Weekly report was sent successfully");
        break;
      case "error":
        console.error("n8n reported an error:", data);
        break;
      default:
        console.log("Unknown action:", action);
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: process.env.NODE_ENV === "development" ? error.message : undefined });
  }
};

module.exports = {
  getWeeklyReport,
  n8nCallback,
};
