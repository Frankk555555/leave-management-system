// frontend/src/components/LeaveRequestForm.js
import React, { useState } from 'react';
import api from '../services/api';
import DatePicker, { registerLocale } from 'react-datepicker';
import { th } from 'date-fns/locale/th';
import "react-datepicker/dist/react-datepicker.css";

registerLocale('th', th);

function LeaveRequestForm({ onFormSubmitSuccess }) {
    const [leaveType, setLeaveType] = useState('sick');
    // เพิ่ม State duration
    const [duration, setDuration] = useState('full'); 
    
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [reason, setReason] = useState('');
    const [attachment, setAttachment] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(''); setError('');

        if (!startDate || !endDate) { setError('กรุณาเลือกวันที่'); return; }

        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];

        const formData = new FormData();
        formData.append('leave_type', leaveType);
        formData.append('duration', duration); // ส่ง duration ไป
        formData.append('start_date', formattedStartDate);
        formData.append('end_date', formattedEndDate);
        formData.append('reason', reason);
        if (attachment) formData.append('attachment', attachment);

        try {
            await api.post('/leave/submit', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            setMessage('ยื่นใบลาสำเร็จ!');
            
            // Reset Form
            setLeaveType('sick'); setDuration('full'); // Reset duration
            setStartDate(null); setEndDate(null);
            setReason(''); setAttachment(null); e.target.reset(); 
            
            if (onFormSubmitSuccess) onFormSubmitSuccess();
        } catch (error) { setError('เกิดข้อผิดพลาด: ' + (error.response?.data?.message || error.message)); }
    };

    // Logic: เมื่อเลือกครึ่งวัน ให้วันสิ้นสุด = วันเริ่มต้นเสมอ
    const handleDurationChange = (e) => {
        const val = e.target.value;
        setDuration(val);
        if (val !== 'full' && startDate) {
            setEndDate(startDate);
        }
    };

    const handleStartDateChange = (date) => {
        setStartDate(date);
        // ถ้าเป็นครึ่งวัน หรือยังไม่ได้เลือกวันสิ้นสุด ให้ set วันสิ้นสุดเท่ากัน
        if (duration !== 'full' || !endDate) {
            setEndDate(date);
        }
    };

    const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
    const labelClass = "block text-gray-700 font-semibold mb-2";

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-6">ยื่นใบลาใหม่</h3>
            {message && <p className="text-green-600 mb-4">{message}</p>}
            {error && <p className="text-red-600 mb-4">{error}</p>}
            
            <div className="mb-4">
                <label className={labelClass}>ประเภทการลา</label>
                <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className={inputClass}>
                    <option value="sick">ลาป่วย</option>
                    <option value="personal">ลากิจ</option>
                    <option value="vacation">ลาพักผ่อน</option>
                </select>
            </div>

            {/* --- ส่วนเลือกช่วงเวลา (Radio Buttons) --- */}
            <div className="mb-4">
                <label className={labelClass}>ช่วงเวลา</label>
                <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                        <input type="radio" className="form-radio text-blue-600" name="duration" value="full" checked={duration === 'full'} onChange={handleDurationChange} />
                        <span className="ml-2">เต็มวัน</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input type="radio" className="form-radio text-blue-600" name="duration" value="morning" checked={duration === 'morning'} onChange={handleDurationChange} />
                        <span className="ml-2">ครึ่งเช้า</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input type="radio" className="form-radio text-blue-600" name="duration" value="afternoon" checked={duration === 'afternoon'} onChange={handleDurationChange} />
                        <span className="ml-2">ครึ่งบ่าย</span>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className={labelClass}>วันที่เริ่มต้น</label>
                    <DatePicker selected={startDate} onChange={handleStartDateChange} dateFormat="dd/MM/yyyy" locale="th" placeholderText="เลือกวันที่" required className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>วันที่สิ้นสุด</label>
                     <DatePicker 
                        selected={endDate} 
                        onChange={(date) => setEndDate(date)} 
                        dateFormat="dd/MM/yyyy" 
                        locale="th" 
                        placeholderText="เลือกวันที่" 
                        required 
                        className={`${inputClass} ${duration !== 'full' ? 'bg-gray-100 cursor-not-allowed' : ''}`} 
                        readOnly={duration !== 'full'} // ล็อกห้ามแก้ถ้าเป็นครึ่งวัน
                    />
                </div>
            </div>

            <div className="mb-4">
                <label className={labelClass}>เหตุผลการลา</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required className={`${inputClass} h-24`} />
            </div>
            <div className="mb-6">
                <label className={labelClass}>ไฟล์แนบ</label>
                <input type="file" onChange={(e) => setAttachment(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
            
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300">
                ยื่นใบลา
            </button>
        </form>
    );
}

export default LeaveRequestForm;