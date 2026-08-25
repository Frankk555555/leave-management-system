// ==========================================================
// Script: ล้างข้อมูลประวัติการลาทั้งหมด (Clear Leave Data)
// รันคำสั่ง: npm run clear:leaves หรือ node scripts/clear-leaves.js
// ==========================================================

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  LeaveRequest,
  LeaveHistory,
  LeaveAttachment,
  Notification,
  LeaveBalance,
} = require("../models");

async function clearAllLeaveData() {
  console.log("\n==========================================");
  console.log(" 🧹 เริ่มต้นกระบวนการล้างข้อมูลการลา...");
  console.log("==========================================\n");

  const t = await sequelize.transaction();

  try {
    // 1. นับจำนวนข้อมูลก่อนลบ
    const totalRequests = await LeaveRequest.count({ transaction: t });
    const totalHistories = await LeaveHistory.count({ transaction: t });
    const totalAttachments = await LeaveAttachment.count({ transaction: t });
    const totalLeaveNotifs = await Notification.count({
      where: {
        [Op.or]: [
          { relatedLeaveId: { [Op.ne]: null } },
          {
            type: {
              [Op.in]: [
                "leave_request",
                "approval",
                "rejection",
                "confirmation",
                "new_leave",
                "cancellation",
              ],
            },
          },
        ],
      },
      transaction: t,
    });

    console.log(`📊 ข้อมูลที่พบในระบบ:`);
    console.log(`   - ใบลา (Leave Requests): ${totalRequests} รายการ`);
    console.log(`   - ประวัติ/ไทม์ไลน์ (Leave Histories): ${totalHistories} รายการ`);
    console.log(`   - ข้อมูลไฟล์แนบ (Attachments Records): ${totalAttachments} รายการ`);
    console.log(`   - การแจ้งเตือนเกี่ยวกับการลา (Notifications): ${totalLeaveNotifs} รายการ`);
    console.log("------------------------------------------");

    // 2. ลบข้อมูลตามลำดับ Foreign Key (Child tables ก่อน Parent table)
    console.log("⏳ กำลังลบข้อมูลในฐานข้อมูล...");

    // ลบ Attachments
    await LeaveAttachment.destroy({ where: {}, transaction: t });

    // ลบ History
    await LeaveHistory.destroy({ where: {}, transaction: t });

    // ลบ Notifications ที่เกี่ยวกับการลา
    await Notification.destroy({
      where: {
        [Op.or]: [
          { relatedLeaveId: { [Op.ne]: null } },
          {
            type: {
              [Op.in]: [
                "leave_request",
                "approval",
                "rejection",
                "confirmation",
                "new_leave",
                "cancellation",
              ],
            },
          },
        ],
      },
      transaction: t,
    });

    // ลบ Leave Requests
    await LeaveRequest.destroy({ where: {}, transaction: t });

    // 3. รีเซ็ตวันลาที่ใช้ไป (usedDays) ของทุกคนให้กลับเป็น 0
    const [updatedBalances] = await LeaveBalance.update(
      { usedDays: 0 },
      { where: {}, transaction: t }
    );

    // ยืนยัน Transaction
    await t.commit();
    console.log("✅ ลบข้อมูลในฐานข้อมูลสำเร็จ!");
    console.log(`✅ รีเซ็ตโควตาวันลา (used_days = 0) ทั้งหมด ${updatedBalances} รายการ`);

    // 4. ลบไฟล์แนบจริงในโฟลเดอร์ uploads (เฉพาะไฟล์ attachments-*)
    const uploadsDir = path.join(__dirname, "..", "uploads");
    let deletedFilesCount = 0;

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file.startsWith("attachments-")) {
          const filePath = path.join(uploadsDir, file);
          try {
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              deletedFilesCount++;
            }
          } catch (err) {
            console.warn(`⚠️ ไม่สามารถลบไฟล์ ${file}:`, err.message);
          }
        }
      }
      console.log(`🗑️  ลบไฟล์แนบจริงใน uploads/ ไป ${deletedFilesCount} ไฟล์`);
    }

    console.log("\n==========================================");
    console.log(" 🎉 ล้างข้อมูลประวัติการลาทั้งหมดเรียบร้อยแล้ว!");
    console.log("==========================================\n");
    process.exit(0);
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("\n❌ เกิดข้อผิดพลาดในการล้างข้อมูล:", error);
    process.exit(1);
  }
}

clearAllLeaveData();
