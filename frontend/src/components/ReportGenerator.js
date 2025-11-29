// frontend/src/components/ReportGenerator.js
import React, { useState } from 'react';
import api from '../services/api';
import { CSVLink } from 'react-csv';
import { translateLeaveType, translateStatus } from '../utils/translationHelper'; // (ใช้ตัวแปลเดิมของเรา)

function ReportGenerator() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isReady, setIsReady] = useState(false); // (สถานะว่าพร้อมดาวน์โหลดหรือยัง)

    // 1. หัวตารางสำหรับไฟล์ CSV
    const headers = [
        { label: "ID ใบลา", key: "request_id" },
        { label: "ชื่อ-นามสกุล", key: "full_name" },
        { label: "ภาควิชา", key: "department_name" },
        { label: "ประเภทการลา", key: "leave_type_th" },
        { label: "สถานะ", key: "status_th" },
        { label: "วันที่เริ่มต้น", key: "start_date" },
        { label: "วันที่สิ้นสุด", key: "end_date" },
        { label: "เหตุผล", key: "reason" },
        { label: "หมายเหตุหัวหน้า", key: "head_remarks" },
        { label: "วันที่ยื่นลา", key: "submitted_at" }
    ];

    // 2. ฟังก์ชันสำหรับดึงและจัดรูปแบบข้อมูล
    const fetchReportData = async () => {
        setLoading(true);
        setIsReady(false);
        try {
            const { data } = await api.get('/admin/reports/all-leave');
            
            // จัดรูปแบบข้อมูล (เช่น แปลไทย, จัดวันที่)
            const formattedData = data.map(row => ({
                ...row,
                leave_type_th: translateLeaveType(row.leave_type),
                status_th: translateStatus(row.status),
                // (จัดรูปแบบวันที่ให้ Excel อ่านง่าย)
                start_date: new Date(row.start_date).toLocaleDateString('th-TH'),
                end_date: new Date(row.end_date).toLocaleDateString('th-TH'),
                submitted_at: new Date(row.submitted_at).toLocaleString('th-TH'),
                department_name: row.department_name || 'N/A',
                head_remarks: row.head_remarks || ''
            }));

            setReportData(formattedData);
            setIsReady(true); // (เปิดปุ่มดาวน์โหลด)
            
        } catch (error) {
            console.error("Failed to fetch report data:", error);
            alert("ไม่สามารถดึงข้อมูลรายงานได้");
        } finally {
            setLoading(false);
        }
    };

    // 3. สร้างชื่อไฟล์
    const filename = `leave_report_${new Date().toISOString().split('T')[0]}.csv`;

    return (
        <div className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
            <h4 className="text-2xl font-bold text-gray-800 mb-6">สร้างรายงาน (Export to CSV)</h4>
            
            <p className="text-gray-600 mb-6">
                คลิกปุ่มด้านล่างเพื่อเตรียมข้อมูลการลาทั้งหมดในระบบ
                เมื่อข้อมูลพร้อม ลิงก์ดาวน์โหลดไฟล์ .CSV (เปิดใน Excel ได้) จะปรากฏขึ้น
            </p>

            {/* ปุ่มที่ 1: เตรียมข้อมูล */}
            <button
                onClick={fetchReportData}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition duration-300 disabled:bg-gray-400"
            >
                {loading ? 'กำลังเตรียมข้อมูล...' : '1. คลิกเพื่อเตรียมข้อมูลรายงาน'}
            </button>

            {/* ปุ่มที่ 2: ดาวน์โหลด (จะโชว์เมื่อ isReady) */}
            {isReady && (
                <div className="mt-6 p-4 bg-green-100 rounded-lg text-center">
                    <p className="text-green-800 font-semibold mb-4">
                        ข้อมูลพร้อมแล้ว! คลิกเพื่อดาวน์โหลด
                    </p>
                    <CSVLink
                        data={reportData}
                        headers={headers}
                        filename={filename}
                        className="w-full inline-block bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition duration-300"
                        target="_blank"
                    >
                        2. ดาวน์โหลดรายงาน (.CSV)
                    </CSVLink>
                </div>
            )}
        </div>
    );
}

export default ReportGenerator;