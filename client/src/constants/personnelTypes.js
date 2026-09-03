/**
 * ประเภทบุคลากรในสถาบันอุดมศึกษา 5 ประเภทตามขอบเขตโครงงานข้อ 1.4.2
 * กรณีศึกษา: มหาวิทยาลัยราชภัฏบุรีรัมย์
 */

export const PERSONNEL_TYPES = [
  {
    id: "civil_servant_academic",
    label: "ข้าราชการในสถาบันอุดมศึกษา (สายผู้สอน)",
    shortLabel: "ข้าราชการ (ผู้สอน)",
    category: "ข้าราชการ",
    badgeClass: "badge-civil-academic",
    color: "#1d4ed8",
    bg: "#eff6ff",
  },
  {
    id: "civil_servant_support",
    label: "ข้าราชการในสถาบันอุดมศึกษา (สายสนับสนุน)",
    shortLabel: "ข้าราชการ (สนับสนุน)",
    category: "ข้าราชการ",
    badgeClass: "badge-civil-support",
    color: "#0369a1",
    bg: "#f0f9ff",
  },
  {
    id: "university_employee_academic",
    label: "พนักงานมหาวิทยาลัยสายผู้สอน",
    shortLabel: "พนง.มหาวิทยาลัย (ผู้สอน)",
    category: "พนักงานมหาวิทยาลัย",
    badgeClass: "badge-univ-academic",
    color: "#15803d",
    bg: "#f0fdf4",
  },
  {
    id: "university_employee_support",
    label: "พนักงานมหาวิทยาลัยสายสนับสนุน",
    shortLabel: "พนง.มหาวิทยาลัย (สนับสนุน)",
    category: "พนักงานมหาวิทยาลัย",
    badgeClass: "badge-univ-support",
    color: "#047857",
    bg: "#ecfdf5",
  },
  {
    id: "contract_lecturer",
    label: "อาจารย์อัตราจ้าง",
    shortLabel: "อาจารย์อัตราจ้าง",
    category: "อาจารย์อัตราจ้าง",
    badgeClass: "badge-contract-lecturer",
    color: "#b45309",
    bg: "#fffbeb",
  },
  {
    id: "temporary_employee",
    label: "ลูกจ้างชั่วคราวมหาวิทยาลัย",
    shortLabel: "ลูกจ้างชั่วคราว",
    category: "ลูกจ้างชั่วคราว",
    badgeClass: "badge-temp-employee",
    color: "#6d28d9",
    bg: "#f5f3ff",
  },
];

export const getPersonnelTypeInfo = (typeId) => {
  return (
    PERSONNEL_TYPES.find((t) => t.id === typeId) || {
      id: typeId || "unknown",
      label: typeId ? typeId : "พนักงานมหาวิทยาลัยสายผู้สอน",
      shortLabel: typeId ? typeId : "พนง.มหาวิทยาลัย (ผู้สอน)",
      category: "พนักงานมหาวิทยาลัย",
      badgeClass: "badge-univ-academic",
      color: "#15803d",
      bg: "#f0fdf4",
    }
  );
};

export const getPersonnelTypeLabel = (typeId) => {
  return getPersonnelTypeInfo(typeId).label;
};

export const getPersonnelTypeShortLabel = (typeId) => {
  return getPersonnelTypeInfo(typeId).shortLabel;
};

export const getPersonnelTypeBadge = (typeId) => {
  const info = getPersonnelTypeInfo(typeId);
  return {
    label: info.shortLabel,
    color: info.color,
    bg: info.bg,
    badgeClass: info.badgeClass,
  };
};
