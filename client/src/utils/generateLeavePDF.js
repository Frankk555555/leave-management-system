import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import config from "../config";

// ชื่อประเภทการลา
const LEAVE_TYPE_NAMES = {
  sick: "ลาป่วย",
  personal: "ลากิจส่วนตัว",
  vacation: "ลาพักผ่อน",
  maternity: "ลาคลอดบุตร",
  paternity: "ลาไปช่วยเหลือภริยาที่คลอดบุตร",
  childcare: "ลาเลี้ยงดูบุตร",
  ordination: "ลาอุปสมบท",
  military: "ลาตรวจเลือก/เตรียมพล",
};

// Mapping ประเภทลา -> ชื่อไฟล์ template
const TEMPLATE_FILES = {
  sick: "แบบฟอร์มขอลาป่วย-ลากิจ-ลาคลอดบุตร.pdf",
  personal: "แบบฟอร์มขอลาป่วย-ลากิจ-ลาคลอดบุตร.pdf",
  maternity: "แบบฟอร์มขอลาป่วย-ลากิจ-ลาคลอดบุตร.pdf",
  vacation: "แบบฟอร์มลาพักผ่อน.pdf",
  paternity: "แบบฟอร์มใบลาไปช่วยเหลือภริยาที่คลอดบุตร.pdf",
  ordination: "แบบใบลาอุปสมบท.pdf",
};

/**
 * แปลงวันที่เป็นรูปแบบไทย
 */
const formatThaiDate = (dateString) => {
  const date = new Date(dateString);
  const thaiMonths = [
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
  const day = date.getDate();
  const month = thaiMonths[date.getMonth()];
  const year = date.getFullYear() + 543;
  return { day, month, year, fullDate: `${day} ${month} ${year}` };
};

/**
 * Helper function
 */
const getDepartmentName = (department) => {
  if (!department) return "";
  if (typeof department === "object") return department.name || "";
  return department;
};

const getFacultyName = (department) => {
  if (!department) return "";
  if (typeof department === "object" && department.faculty) {
    return department.faculty.name || "";
  }
  return "";
};

/**
 * โหลด Thai font
 */
const loadThaiFont = async (pdfDoc) => {
  pdfDoc.registerFontkit(fontkit);

  // รายการ fonts ที่จะลองโหลด (THSarabun ก่อน)
  const fontUrls = ["/fonts/THSarabun.ttf", "/fonts/Mitr-Regular.ttf"];

  for (const fontUrl of fontUrls) {
    try {
      console.log("Trying to load font:", fontUrl);
      const fontResponse = await fetch(fontUrl);

      if (fontResponse.ok) {
        const fontBytes = await fontResponse.arrayBuffer();
        console.log(`Font ${fontUrl} size:`, fontBytes.byteLength);
        // ตรวจสอบขนาดไฟล์
        if (fontBytes.byteLength > 10000) {
          const font = await pdfDoc.embedFont(fontBytes);
          console.log("Thai font loaded successfully:", fontUrl);
          return font;
        }
      }
    } catch (error) {
      console.warn(`Could not load ${fontUrl}:`, error.message);
    }
  }

  console.error("No Thai font available!");
  throw new Error(
    "ไม่สามารถโหลด Thai font ได้ กรุณา copy ไฟล์ font จาก server/fonts/ ไปไว้ที่ client/public/fonts/",
  );
};

/**
 * วาดข้อความลงบน PDF page
 * หมายเหตุ: พิกัด y นับจากด้านล่างของหน้า
 */
const drawText = (page, text, x, y, font, size = 14, color = rgb(0, 0, 0)) => {
  if (!text) return;
  page.drawText(String(text), {
    x,
    y,
    size,
    font,
    color,
  });
};

/**
 * วาด calibration grid เพื่อหาพิกัดที่ถูกต้อง
 * เปิดใช้งานโดยเปลี่ยน CALIBRATION_MODE = true
 */
const CALIBRATION_MODE = false; // เปลี่ยนเป็น true เพื่อเปิด calibration grid

const drawCalibrationGrid = (page, font) => {
  if (!CALIBRATION_MODE) return;

  const { width, height } = page.getSize();
  const gridColor = rgb(1, 0, 0); // สีแดง
  const textColor = rgb(0, 0, 1); // สีน้ำเงิน

  // วาดเส้น grid ทุก 50 pixels
  for (let x = 0; x <= width; x += 50) {
    page.drawLine({
      start: { x, y: 0 },
      end: { x, y: height },
      thickness: 0.5,
      color: gridColor,
      opacity: 0.3,
    });
    // เขียนตัวเลข x
    page.drawText(String(x), {
      x: x + 2,
      y: height - 15,
      size: 8,
      font,
      color: textColor,
    });
  }

  for (let y = 0; y <= height; y += 50) {
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: 0.5,
      color: gridColor,
      opacity: 0.3,
    });
    // เขียนตัวเลข y (height - y เพื่อแสดงระยะจากด้านบน)
    page.drawText(String(Math.round(height - y)), {
      x: 2,
      y: y + 2,
      size: 8,
      font,
      color: textColor,
    });
  }

  console.log(`Page size: ${width} x ${height}`);
  console.log(
    "Grid drawn. Red lines every 50px. Blue numbers show coordinates.",
  );
  console.log("Y values shown are 'height - y' (distance from top)");
};

/**
 * วาด checkbox (ติ๊กถูก)
 */
const drawCheckmark = (page, x, y, isChecked, font, size = 12) => {
  if (isChecked) {
    page.drawText("✓", { x: x + 2, y: y - 2, size, font, color: rgb(0, 0, 0) });
  }
};

/**
 * เติมข้อมูลลงใน PDF - ฟอร์มลาป่วย/ลากิจ/ลาคลอด
 * พิกัดเหล่านี้ต้องปรับตามตำแหน่งจริงในฟอร์ม
 */
const fillSickPersonalMaternityForm = async (
  page,
  font,
  leaveData,
  userData,
  signatureInfo,
) => {
  const { height } = page.getSize();
  const startDate = formatThaiDate(leaveData.startDate);
  const endDate = formatThaiDate(leaveData.endDate);
  const requestDate = leaveData.createdAt ? new Date(leaveData.createdAt).toISOString() : new Date().toISOString();
  const today = formatThaiDate(requestDate);

  const departmentName = getDepartmentName(userData.department);
  const facultyName = getFacultyName(userData.department);
  const fullName = `${userData.title || ""} ${userData.firstName || ""} ${
    userData.lastName || ""
  }`.trim();

  // === พิกัดสำหรับเติมข้อมูล (จาก Calibration) ===
  // หมายเหตุ: y นับจากล่างขึ้นบน, x นับจากซ้ายไปขวา
  // Page size: 595.32 x 841.92 (A4)

  const fontSize = 15; // ปรับให้เล็กลงให้พอดีกับแบบฟอร์ม
  const smallFont = 15;

  // ส่วนราชการ x=145, y=132
  drawText(page, departmentName, 140, height - 122, font, fontSize);

  // ที่ (เลขหนังสือ) x=90, y=142
  drawText(
    page,
    userData.documentNumber || "",
    90,
    height - 144,
    font,
    fontSize,
  );

  // วันที่ x=225, y=142
  drawText(page, String(today.day), 265, height - 144, font, fontSize);

  // เดือน x=320, y=142
  drawText(page, today.month, 320, height - 144, font, fontSize);

  // พ.ศ. x=400, y=142
  drawText(page, String(today.year), 400, height - 144, font, fontSize);

  // ข้าพเจ้า x=190, y=230
  drawText(page, fullName, 185, height - 220, font, fontSize);

  // ตำแหน่ง x=395, y=230
  drawText(
    page,
    userData.position || "อาจารย์",
    395,
    height - 223,
    font,
    fontSize,
  );

  // สังกัดสาขาวิชา/หน่วยงาน x=185, y=240
  drawText(page, departmentName, 180, height - 240, font, fontSize);

  // คณะ/สำนัก/สถาบัน x=400, y=240
  drawText(page, facultyName, 400, height - 240, font, fontSize);

  // Checkbox ประเภทการลา - วาดเครื่องหมายถูกด้วยเส้น
  const drawCheckmark = (x, y) => {
    const checkColor = rgb(0, 0, 0);
    // วาดเส้นเครื่องหมายถูก
    page.drawLine({
      start: { x: x, y: y + 3 },
      end: { x: x + 3, y: y },
      thickness: 1.5,
      color: checkColor,
    });
    page.drawLine({
      start: { x: x + 3, y: y },
      end: { x: x + 8, y: y + 8 },
      thickness: 1.5,
      color: checkColor,
    });
  };

  if (leaveData.leaveType === "sick") {
    drawCheckmark(270, height - 275);
  }
  if (leaveData.leaveType === "personal") {
    drawCheckmark(335, height - 275);
  }
  if (leaveData.leaveType === "maternity") {
    drawCheckmark(423, height - 275);
  }

  // เนื่องจาก (เหตุผล) x=155, y=292
  drawText(page, leaveData.reason || "", 155, height - 295, font, fontSize);

  // ตั้งแต่วันที่: วัน x=133, y=312
  drawText(page, String(startDate.day), 133, height - 312, font, fontSize);
  // เดือน x=155, y=312
  drawText(page, startDate.month, 155, height - 312, font, fontSize);
  // ปี x=215, y=312
  drawText(page, String(startDate.year), 215, height - 312, font, fontSize);

  // ถึงวันที่: วัน x=243, y=312
  drawText(page, String(endDate.day), 285, height - 312, font, fontSize);
  // เดือน x=315, y=312
  drawText(page, endDate.month, 315, height - 312, font, fontSize);
  // ปี x=390, y=312
  drawText(page, String(endDate.year), 390, height - 312, font, fontSize);

  // มีกำหนด x=480, y=312
  drawText(
    page,
    String(leaveData.totalDays),
    480,
    height - 312,
    font,
    fontSize,
  );

  const contactInfoArr = [];
  if (leaveData.contactAddress) contactInfoArr.push(leaveData.contactAddress);
  if (leaveData.contactPhone) contactInfoArr.push(`โทร. ${leaveData.contactPhone}`);
  else if (userData.phone) contactInfoArr.push(`โทร. ${userData.phone}`);
  const contactInfoStr = contactInfoArr.join(" ");

  // ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ (เบอร์โทรศัพท์) x=80, y=364
  drawText(
    page,
    contactInfoStr,
    80,
    height - 367,
    font,
    fontSize,
  );

  // สถิติการลา (ในตาราง)
  // จากภาพ: ป่วย y≈492, กิจส่วนตัว y≈542
  const getUsed = (type) => parseFloat(leaveData.leaveStats?.[type]?.used) || 0;
  const getCurrent = (type) =>
    type === leaveData.leaveType ? (parseFloat(leaveData.totalDays) || 0) : 0;

  const formatStat = (val) => {
    if (val === undefined || val === null || Number.isNaN(Number(val)))
      return "-";
    const num = Number(val);
    if (num === 0) return "-";
    return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, "");
  };

  // พิกัด X ของแต่ละคอลัมน์ (ลามาแล้ว, ลาครั้งนี้, รวมเป็น)
  const col1X = 150; // ลามาแล้ว
  const col2X = 200; // ลาครั้งนี้
  const col3X = 265; // รวมเป็น
  const rowSpacing = 32; // ระยะห่างระหว่างแถว

  // ป่วย (แถวแรก) y=500
  const row1Y = height - 510;
  drawText(page, formatStat(getUsed("sick")), col1X, row1Y, font, smallFont);
  drawText(
    page,
    formatStat(getCurrent("sick")),
    col2X,
    row1Y,
    font,
    smallFont,
  );
  drawText(
    page,
    formatStat(getUsed("sick") + getCurrent("sick")),
    col3X,
    row1Y,
    font,
    smallFont,
  );

  // กิจส่วนตัว (แถวที่ 2) y=530
  const row2Y = row1Y - rowSpacing;
  drawText(
    page,
    formatStat(getUsed("personal")),
    col1X,
    row2Y,
    font,
    smallFont,
  );
  drawText(
    page,
    formatStat(getCurrent("personal")),
    col2X,
    row2Y,
    font,
    smallFont,
  );
  drawText(
    page,
    formatStat(getUsed("personal") + getCurrent("personal")),
    col3X,
    row2Y,
    font,
    smallFont,
  );

  // คลอดบุตร (แถวที่ 3) y=560
  const row3Y = row2Y - rowSpacing;
  drawText(
    page,
    formatStat(getUsed("maternity")),
    col1X,
    row3Y,
    font,
    smallFont,
  );
  drawText(
    page,
    formatStat(getCurrent("maternity")),
    col2X,
    row3Y,
    font,
    smallFont,
  );
  drawText(
    page,
    formatStat(getUsed("maternity") + getCurrent("maternity")),
    col3X,
    row3Y,
    font,
    smallFont,
  );

  // ผู้ขอลา (ลายเซ็นและชื่อ)
  // จุดกึ่งกลางของช่องว่างคือ x ≈ 440 (สำหรับ Sick/Personal)
  const centerX = 435; // The user desired X position 
  if (signatureInfo && signatureInfo.ref) {
    page.drawImage(signatureInfo.ref, {
      x: centerX - (signatureInfo.dims.width / 2),
      y: height - 433, // Place signature right above the text
      width: signatureInfo.dims.width,
      height: signatureInfo.dims.height,
    });
  }
  
  // คำนวณความกว้างของชื่อเพื่อให้อยู่ตรงกลาง (..............)
  const nameWidth = font.widthOfTextAtSize(fullName, fontSize);
  drawText(page, fullName, centerX - (nameWidth / 2), height - 430 - 20, font, fontSize);
};

/**
 * เติมข้อมูลลงใน PDF - ฟอร์มลาพักผ่อน
 */
const fillVacationForm = async (page, font, leaveData, userData, signatureInfo) => {
  const { height } = page.getSize();
  const startDate = formatThaiDate(leaveData.startDate);
  const endDate = formatThaiDate(leaveData.endDate);
  const requestDate = leaveData.createdAt ? new Date(leaveData.createdAt).toISOString() : new Date().toISOString();
  const today = formatThaiDate(requestDate);

  const departmentName = getDepartmentName(userData.department);
  const facultyName = getFacultyName(userData.department);
  const fullName = `${userData.firstName || ""} ${
    userData.lastName || ""
  }`.trim();

  const fontSize = 14;

  // ส่วนราชการ
  drawText(page, departmentName, 160, height - 96, font, fontSize);

  // ที่
  drawText(
    page,
    userData.documentNumber || "",
    110,
    height - 117,
    font,
    fontSize,
  );

  // วันที่
  drawText(page, String(today.day), 285, height - 117, font, fontSize);
  drawText(page, today.month, 335, height - 117, font, fontSize);
  drawText(page, String(today.year), 420, height - 117, font, fontSize);

  // ชื่อ
  drawText(page, fullName, 200, height - 195, font, fontSize);

  // ตำแหน่ง
  drawText(
    page,
    userData.position || "อาจารย์",
    420,
    height - 195,
    font,
    fontSize,
  );

  // สังกัด
  drawText(page, departmentName, 200, height - 213, font, fontSize);

  // คณะ
  drawText(page, facultyName, 420, height - 213, font, fontSize);

  // วันที่ลา
  drawText(
    page,
    `${startDate.day} ${startDate.month} ${startDate.year}`,
    195,
    height - 250,
    font,
    fontSize,
  );
  drawText(
    page,
    `${endDate.day} ${endDate.month} ${endDate.year}`,
    345,
    height - 250,
    font,
    fontSize,
  );
  drawText(
    page,
    String(leaveData.totalDays),
    505,
    height - 250,
    font,
    fontSize,
  );

  // === ส่วนที่เพิ่มเติม ===

  // คำนวณวันลาพักผ่อน
  const vacationStats = leaveData.leaveStats?.vacation || {};
  const accumulated = vacationStats.accumulated || 0; // วันสะสม
  const maxDays = vacationStats.maxDays || 10; // สิทธิประจำปี
  const totalAvailable = accumulated + maxDays; // รวมเป็น

  // วันลาพักผ่อนสะสม (ใส่พิกัดตามที่ต้องการ)
  drawText(page, String(accumulated), 185, height - 232, font, fontSize);

  // รวมเป็น (สะสม + ประจำปี)
  drawText(page, String(totalAvailable), 480, height - 232, font, fontSize);

  const contactInfoArr = [];
  if (leaveData.contactAddress) contactInfoArr.push(leaveData.contactAddress);
  if (leaveData.contactPhone) contactInfoArr.push(`โทร. ${leaveData.contactPhone}`);
  else if (userData.phone) contactInfoArr.push(`โทร. ${userData.phone}`);
  const contactInfoStr = contactInfoArr.join(" ");

  // ในระหว่างลา จะติดต่อข้าพเจ้าได้ที่ (เบอร์โทรศัพท์)
  drawText(
    page,
    contactInfoStr,
    250,
    height - 267,
    font,
    fontSize,
  );

  // === สถิติการลาพักผ่อน (ในตาราง) ===
  // คอลัมน์: ลามาแล้ว, ลาครั้งนี้, รวมเป็น, คงเหลือสะสม
  const smallFont = 12;
  const used = parseFloat(vacationStats.used) || 0;
  const currentLeave = parseFloat(leaveData.totalDays) || 0;
  const totalUsed = used + currentLeave;
  const remaining = totalAvailable - totalUsed;

  // พิกัดคอลัมน์ (ปรับตามตำแหน่งจริงในตาราง)
  const col1X = 120; // ลามาแล้ว
  const col2X = 175; // ลาครั้งนี้
  const col3X = 225; // รวมเป็น
  const col4X = 287; // คงเหลือสะสม
  const tableY = height - 408; // แถวข้อมูล (ปรับตามตำแหน่งจริง)

  const formatStat = (val) => {
    if (val === undefined || val === null || Number.isNaN(Number(val)))
      return "-";
    const num = Number(val);
    if (num === 0) return "-";
    return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, "");
  };

  drawText(page, formatStat(used), col1X, tableY, font, smallFont);
  drawText(page, formatStat(currentLeave), col2X, tableY, font, smallFont);
  drawText(page, formatStat(totalUsed), col3X, tableY, font, smallFont);
  drawText(
    page,
    formatStat(remaining >= 0 ? remaining : 0),
    col4X,
    tableY,
    font,
    smallFont,
  );

  // ผู้ขอลา (ลายเซ็นและชื่อ) — ช่อง (ลงชื่อ) ทางขวาของฟอร์ม
  // x ≈ 430 = กึ่งกลางของช่องด้านขวา, ลายเซ็นอยู่เหนือเส้น ........... ประมาณ y=330-360 จากด้านบน
  const signatureCenterX = 450;
  const signatureLineY = height - 348.5; // เส้น (ลงชื่อ) ........

  if (signatureInfo && signatureInfo.ref) {
    // วางลายเซ็นเหนือเส้น — ลายเซ็นสูง dims.height, ล่างสุดของลายเซ็นชิดเส้น
    page.drawImage(signatureInfo.ref, {
      x: signatureCenterX - signatureInfo.dims.width / 2,
      y: signatureLineY + 4, // เริ่มจากเส้นขึ้นไป
      width: signatureInfo.dims.width,
      height: signatureInfo.dims.height,
    });
  }

  // ชื่อเต็มใต้วงเล็บ (....ชื่อ....) ≈ y=375 จากด้านบน
  const nameWidth = font.widthOfTextAtSize(fullName, fontSize);
  drawText(page, fullName, signatureCenterX - nameWidth / 2, height - 365, font, fontSize);
};

/**
 * เติมข้อมูลลงใน PDF - ฟอร์มลาช่วยเหลือภริยาที่คลอดบุตร
 * พิกัดต้องปรับตาม template จริง
 */
const fillPaternityForm = async (page, font, leaveData, userData, signatureInfo) => {
  const { height } = page.getSize();
  const startDate = formatThaiDate(leaveData.startDate);
  const endDate = formatThaiDate(leaveData.endDate);
  const requestDate = leaveData.createdAt ? new Date(leaveData.createdAt).toISOString() : new Date().toISOString();
  const today = formatThaiDate(requestDate);

  const departmentName = getDepartmentName(userData.department);
  const facultyName = getFacultyName(userData.department);
  const fullName = `${userData.title || ""} ${userData.firstName || ""} ${
    userData.lastName || ""
  }`.trim();

  const fontSize = 14;

  // ส่วนราชการ (ปรับพิกัดตาม template)
  drawText(page, departmentName, 145, height - 132, font, fontSize);

  // ที่ (เลขหนังสือ)
  drawText(
    page,
    userData.documentNumber || "",
    90,
    height - 154,
    font,
    fontSize,
  );

  // วันที่ เดือน พ.ศ.
  drawText(page, String(today.day), 269, height - 154, font, fontSize);
  drawText(page, today.month, 320, height - 154, font, fontSize);
  drawText(page, String(today.year), 400, height - 154, font, fontSize);

  // ข้าพเจ้า (ชื่อ)
  drawText(page, fullName, 190, height - 230, font, fontSize);

  // ตำแหน่ง
  drawText(
    page,
    userData.position || "อาจารย์",
    395,
    height - 230,
    font,
    fontSize,
  );

  // สังกัดสาขาวิชา/หน่วยงาน
  drawText(page, departmentName, 185, height - 250, font, fontSize);

  // คณะ/สำนัก/สถาบัน
  drawText(page, facultyName, 400, height - 250, font, fontSize);

  // ตั้งแต่วันที่ (แยก วัน/เดือน/ปี)
  drawText(page, String(startDate.day), 80, height - 342, font, fontSize);
  drawText(page, startDate.month, 120, height - 342, font, fontSize);
  drawText(page, String(startDate.year), 170, height - 342, font, fontSize);

  // ถึงวันที่ (แยก วัน/เดือน/ปี)
  drawText(page, String(endDate.day), 250, height - 342, font, fontSize);
  drawText(page, endDate.month, 280, height - 342, font, fontSize);
  drawText(page, String(endDate.year), 340, height - 342, font, fontSize);

  const contactInfoArr = [];
  if (leaveData.contactAddress) contactInfoArr.push(leaveData.contactAddress);
  if (leaveData.contactPhone) contactInfoArr.push(`โทร. ${leaveData.contactPhone}`);
  else if (userData.phone) contactInfoArr.push(`โทร. ${userData.phone}`);
  const contactInfoStr = contactInfoArr.join(" ");

  // ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ (เบอร์โทรศัพท์)
  drawText(
    page,
    contactInfoStr,
    240,
    height - 359,
    font,
    fontSize
  );

  // === สถิติการลา (ในตาราง) ===
  // คอลัมน์: ลามาแล้ว, ลาครั้งนี้, รวมเป็น
  const smallFont = 14;
  const paternityStats = leaveData.leaveStats?.paternity || {};
  const used = parseFloat(paternityStats.used) || 0;
  const currentLeave = parseFloat(leaveData.totalDays) || 0;
  const totalUsed = used + currentLeave;

  // พิกัดคอลัมน์ (ปรับตามตำแหน่งจริงในตาราง - ดูจากภาพ y≈492-542)
  const col1X = 150; // ลามาแล้ว
  const col2X = 205; // ลาครั้งนี้
  const col3X = 263; // รวมเป็น
  const tableY = height - 522; // แถวข้อมูล (ปรับตามตำแหน่งจริง)

  const formatStat = (val) => {
    if (val === undefined || val === null || Number.isNaN(Number(val)))
      return "-";
    const num = Number(val);
    if (num === 0) return "-";
    return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, "");
  };

  drawText(page, formatStat(used), col1X, tableY, font, smallFont);
  drawText(page, formatStat(currentLeave), col2X, tableY, font, smallFont);
  drawText(page, formatStat(totalUsed), col3X, tableY, font, smallFont);

  // ผู้ขอลา (ลายเซ็นและชื่อ)
  const centerX = 380;
  if (signatureInfo && signatureInfo.ref) {
    page.drawImage(signatureInfo.ref, {
      x: centerX - (signatureInfo.dims.width / 2),
      y: height - 580, // Adjust to be where signature goes in paternity form
      width: signatureInfo.dims.width,
      height: signatureInfo.dims.height,
    });
  }
  
  const nameWidth = font.widthOfTextAtSize(fullName, fontSize);
  drawText(page, fullName, centerX - (nameWidth / 2), height - 580 - 20, font, fontSize);
};

/**
 * Processes signature image bytes to remove light backgrounds (like white or checkerboard grid)
 * and exports a clean transparent PNG image.
 */
const processSignatureBytes = async (imgBytes) => {
  return new Promise((resolve, reject) => {
    const blob = new Blob([imgBytes]);
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Brightness threshold: pixels with brightness >= threshold will be transparent.
        // 190 covers standard white and light gray checkerboard backgrounds (usually 204 or 224).
        const threshold = 190;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          // Calculate brightness using luminance formula
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

          if (brightness >= threshold) {
            data[i + 3] = 0; // Make background pixel transparent
          } else {
            // Smoothly interpolate alpha for edge anti-aliasing
            const alphaFactor = (threshold - brightness) / threshold;
            const newAlpha = Math.round(alphaFactor * 255);
            data[i + 3] = Math.min(a, newAlpha);

            // Darken the stroke to make it clean and crisp
            const darkFactor = 0.5;
            data[i] = Math.round(r * darkFactor);
            data[i + 1] = Math.round(g * darkFactor);
            data[i + 2] = Math.round(b * darkFactor);
          }
        }

        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((processedBlob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve(reader.result); // ArrayBuffer
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(processedBlob);
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(blobUrl);
      reject(err);
    };
    img.src = blobUrl;
  });
};

/**
 * สร้าง PDF ใบลาจาก Template
 */
export const generateLeavePDF = async (leaveData, userData) => {
  const leaveTypeName =
    LEAVE_TYPE_NAMES[leaveData.leaveType] || leaveData.leaveType;
  const templateFileName =
    TEMPLATE_FILES[leaveData.leaveType] || TEMPLATE_FILES.sick;

  try {
    // โหลด PDF template
    const templateUrl = `/forms/${encodeURIComponent(templateFileName)}`;
    console.log("Loading template:", templateUrl);

    const templateResponse = await fetch(templateUrl);

    if (!templateResponse.ok) {
      throw new Error(`Template not found: ${templateFileName}`);
    }

    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(templateBytes);

    // โหลด font
    const font = await loadThaiFont(pdfDoc);

    // โหลดลายเซ็นต์ดิจิทัลถ้ามี
    let signatureImageRef = null;
    let signatureImageDims = null;
    if (userData.signatureImage) {
      try {
        const imgUrl = userData.signatureImage.startsWith("http")
          ? userData.signatureImage
          : `${config.API_URL}${userData.signatureImage}`;
        const imgResponse = await fetch(imgUrl);
        if (imgResponse.ok) {
          const imgBytes = await imgResponse.arrayBuffer();
          
          // Process the signature bytes to remove checkerboard/light backgrounds
          let processedBytes = imgBytes;
          try {
            processedBytes = await processSignatureBytes(imgBytes);
          } catch (processError) {
            console.warn("Could not process signature background removal, using original bytes", processError);
          }

          // Try loading as PNG first, fallback to JPG if embedding fails
          try {
            signatureImageRef = await pdfDoc.embedPng(processedBytes);
          } catch (pngError) {
            try {
              signatureImageRef = await pdfDoc.embedJpg(processedBytes);
            } catch (jpgError) {
              console.warn("Could not embed signature as PNG or JPG", jpgError);
              alert("คำเตือน: รูปภาพลายเซ็นต์ไม่ถูกต้อง โปรดอัปโหลดใหม่เป็นไฟล์ .png หรือ .jpg");
            }
          }
          
          if (signatureImageRef) {
            signatureImageDims = signatureImageRef.scaleToFit(140, 50);
          }
        } else {
          console.warn("Signature fetch failed with status: ", imgResponse.status);
          alert("คำเตือน: ไม่สามารถดึงรูปลงนามจากเซิร์ฟเวอร์ได้ (" + imgResponse.status + ")");
        }
      } catch (e) {
        console.warn("Could not load signature image", e);
      }
    }
    const signatureInfo = { ref: signatureImageRef, dims: signatureImageDims };

    // รับหน้าแรก
    const pages = pdfDoc.getPages();
    const page = pages[0];

    console.log("Page size:", page.getSize());

    // วาด grid สำหรับ calibration (เปลี่ยน CALIBRATION_MODE = true เพื่อเปิดใช้งาน)
    drawCalibrationGrid(page, font);

    // เติมข้อมูลตามประเภทการลา
    switch (leaveData.leaveType) {
      case "sick":
      case "personal":
      case "maternity":
        await fillSickPersonalMaternityForm(page, font, leaveData, userData, signatureInfo);
        break;
      case "vacation":
        await fillVacationForm(page, font, leaveData, userData, signatureInfo);
        break;
      case "paternity":
        await fillPaternityForm(page, font, leaveData, userData, signatureInfo);
        break;
      default:
        await fillSickPersonalMaternityForm(page, font, leaveData, userData, signatureInfo);
    }

    // บันทึก PDF
    const pdfBytes = await pdfDoc.save();

    // สร้าง Blob และดาวน์โหลด
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `ใบลา_${leaveTypeName}_${userData.firstName}_${userData.lastName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log("PDF generated successfully!");
    return true;
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert(`เกิดข้อผิดพลาดในการสร้าง PDF: ${error.message}`);
    return false;
  }
};

/**
 * Preview Leave PDF - เปิด PDF ในแท็บใหม่ (สำหรับ Admin)
 */
export const previewLeavePDF = async (leaveData, userData) => {
  try {
    console.log("Preview Leave PDF:", { leaveData, userData });

    const leaveType = leaveData.leaveType;
    const templateFile = TEMPLATE_FILES[leaveType];

    if (!templateFile) {
      alert(
        `ยังไม่รองรับการแสดงตัวอย่างใบลาประเภท: ${LEAVE_TYPE_NAMES[leaveType] || leaveType}`,
      );
      return false;
    }

    // โหลด template PDF
    const templatePath = `/forms/${templateFile}`;
    const existingPdfBytes = await fetch(templatePath).then((res) => {
      if (!res.ok) throw new Error(`ไม่พบไฟล์ template: ${templatePath}`);
      return res.arrayBuffer();
    });

    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const font = await loadThaiFont(pdfDoc);

    // โหลดลายเซ็นต์ดิจิทัลถ้ามี
    let signatureImageRef = null;
    let signatureImageDims = null;
    if (userData.signatureImage) {
      try {
        const imgUrl = userData.signatureImage.startsWith("http")
          ? userData.signatureImage
          : `${config.API_URL}${userData.signatureImage}`;
        const imgResponse = await fetch(imgUrl);
        if (imgResponse.ok) {
          const imgBytes = await imgResponse.arrayBuffer();
          
          // Process the signature bytes to remove checkerboard/light backgrounds
          let processedBytes = imgBytes;
          try {
            processedBytes = await processSignatureBytes(imgBytes);
          } catch (processError) {
            console.warn("Could not process signature background removal, using original bytes", processError);
          }

          try {
            signatureImageRef = await pdfDoc.embedPng(processedBytes);
          } catch (pngError) {
            try {
              signatureImageRef = await pdfDoc.embedJpg(processedBytes);
            } catch (jpgError) {
              console.warn("Could not embed signature as PNG or JPG", jpgError);
              alert("คำเตือน: รูปภาพลายเซ็นต์ไม่ถูกต้อง โปรดอัปโหลดใหม่เป็นไฟล์ .png หรือ .jpg");
            }
          }

          if (signatureImageRef) {
            signatureImageDims = signatureImageRef.scaleToFit(140, 50);
          }
        } else {
          console.warn("Signature fetch failed with status:", imgResponse.status);
        }
      } catch (e) {
        console.warn("Could not load signature image", e);
      }
    }
    const signatureInfo = { ref: signatureImageRef, dims: signatureImageDims };

    const pages = pdfDoc.getPages();
    const page = pages[0];

    // เติมข้อมูลตามประเภทการลา
    switch (leaveData.leaveType) {
      case "sick":
      case "personal":
      case "maternity":
        await fillSickPersonalMaternityForm(page, font, leaveData, userData, signatureInfo);
        break;
      case "vacation":
        await fillVacationForm(page, font, leaveData, userData, signatureInfo);
        break;
      case "paternity":
        await fillPaternityForm(page, font, leaveData, userData, signatureInfo);
        break;
      default:
        await fillSickPersonalMaternityForm(page, font, leaveData, userData, signatureInfo);
    }

    // บันทึก PDF
    const pdfBytes = await pdfDoc.save();

    // สร้าง Blob และเปิดในแท็บใหม่
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // เปิดในแท็บใหม่
    window.open(url, "_blank");

    console.log("PDF preview opened successfully!");
    return true;
  } catch (error) {
    console.error("Error previewing PDF:", error);
    alert(`เกิดข้อผิดพลาดในการแสดงตัวอย่าง PDF: ${error.message}`);
    return false;
  }
};

export default generateLeavePDF;
