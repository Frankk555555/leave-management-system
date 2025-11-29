// frontend/src/utils/translationHelper.js

export const translateStatus = (status) => {
    switch (status) {
        case 'pending':
            return 'รออนุมัติ';
        case 'approved':
            return 'อนุมัติ';
        case 'rejected':
            return 'ไม่อนุมัติ';
        default:
            return status;
    }
};

export const translateLeaveType = (type) => {
    switch (type) {
        case 'sick':
            return 'ลาป่วย';
        case 'personal':
            return 'ลากิจ';
        case 'vacation':
            return 'ลาพักผ่อน';
        default:
            return type;
    }
};

export const translateRole = (role) => {
    switch (role) {
        case 'admin':
            return 'ผู้ดูแลระบบ';
        case 'head':
            return 'หัวหน้าภาควิชา';
        case 'teacher':
            return 'อาจารย์';
        default:
            return role;
    }
};

export const translateDuration = (duration) => {
    switch (duration) {
        case 'full': return 'เต็มวัน';
        case 'morning': return 'ครึ่งวัน (เช้า)';
        case 'afternoon': return 'ครึ่งวัน (บ่าย)';
        default: return duration;
    }
};