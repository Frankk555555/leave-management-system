-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 25, 2025 at 11:12 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `leave_system_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `department_id` int(11) NOT NULL,
  `department_name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`department_id`, `department_name`) VALUES
(1, 'Computer Science'),
(3, 'Mathematics'),
(2, 'Physics');

-- --------------------------------------------------------

--
-- Table structure for table `leave_attachments`
--

CREATE TABLE `leave_attachments` (
  `attachment_id` int(11) NOT NULL,
  `request_id` int(11) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `uploaded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leave_quotas`
--

CREATE TABLE `leave_quotas` (
  `quota_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `leave_type` enum('sick','personal','vacation') NOT NULL,
  `total_days` float NOT NULL DEFAULT 10,
  `year` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_quotas`
--

INSERT INTO `leave_quotas` (`quota_id`, `user_id`, `leave_type`, `total_days`, `year`) VALUES
(1, 3, 'sick', 10, 2025),
(2, 3, 'personal', 10, 2025),
(3, 3, 'vacation', 10, 2025),
(4, 4, 'sick', 10, 2025),
(5, 4, 'personal', 5, 2025),
(6, 4, 'vacation', 10, 2025),
(7, 3, 'sick', 12, 2026),
(8, 3, 'personal', 6, 2026),
(9, 3, 'vacation', 10, 2026),
(10, 4, 'sick', 5, 2026),
(11, 4, 'personal', 2, 2026),
(12, 4, 'vacation', 3, 2026),
(16, 2, 'sick', 10, 2026),
(17, 2, 'personal', 5, 2026),
(18, 2, 'vacation', 10, 2026),
(19, 2, 'sick', 10, 2025),
(20, 2, 'personal', 10, 2025),
(21, 2, 'vacation', 10, 2025);

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `request_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `leave_type` enum('sick','personal','vacation') NOT NULL,
  `duration` enum('full','morning','afternoon') NOT NULL DEFAULT 'full',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` text NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `approver_id` int(11) DEFAULT NULL,
  `head_remarks` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `notification_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `message` varchar(255) NOT NULL,
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`notification_id`, `user_id`, `message`, `link`, `is_read`, `created_at`) VALUES
(1, 2, 'New leave request from Teacher A', '/dashboard/head', 1, '2025-11-08 13:03:08'),
(2, 3, 'Your leave request (ID: 2) has been APPROVED.', '/dashboard/teacher', 1, '2025-11-08 13:03:41'),
(3, 2, 'New leave request from Teacher A', '/dashboard/head', 1, '2025-11-08 13:06:42'),
(4, 3, 'Your leave request (ID: 3) has been APPROVED.', '/dashboard/teacher', 1, '2025-11-08 13:06:57'),
(5, 2, 'New leave request from Teacher A', '/dashboard/head', 1, '2025-11-09 08:26:45'),
(6, 3, 'Your leave request (ID: 4) has been APPROVED.', '/dashboard/teacher', 1, '2025-11-09 08:27:11'),
(7, 2, 'มีใบลาใหม่จาก: Teacher A', '/dashboard/head', 1, '2025-11-13 16:48:14'),
(8, 3, 'ใบลา (ID: 5) ได้รับการ \"อนุมัติ\" แล้ว', '/dashboard/teacher', 1, '2025-11-13 16:52:08'),
(9, 2, 'มีใบลาใหม่จาก: Teacher A', '/dashboard/head', 1, '2025-11-13 17:27:33'),
(10, 3, 'ใบลา (ID: 6) ได้รับการ \"อนุมัติ\" แล้ว', '/dashboard/teacher', 1, '2025-11-13 17:28:03'),
(11, 2, 'มีใบลาใหม่จาก: Teacher A', '/dashboard/head', 1, '2025-11-23 16:13:15'),
(12, 6, 'มีใบลาใหม่จาก: Teacher B', '/dashboard/head', 1, '2025-11-23 16:44:57'),
(13, 2, 'มีใบลาใหม่ (ครึ่งวัน) จาก: Teacher A', '/dashboard/head', 1, '2025-11-25 08:20:36'),
(14, 3, 'ใบลา (ID: 9) ได้รับการ \"อนุมัติ\" แล้ว', '/dashboard/teacher', 1, '2025-11-25 08:21:09'),
(15, 3, 'ใบลา (ID: 7) ถูก \"ไม่อนุมัติ\"', '/dashboard/teacher', 1, '2025-11-25 08:21:21');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('teacher','head','admin') NOT NULL,
  `department_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `password_reset_token` varchar(255) NOT NULL,
  `password_reset_expires` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `password_hash`, `full_name`, `email`, `role`, `department_id`, `created_at`, `password_reset_token`, `password_reset_expires`) VALUES
(1, 'admin', '$2b$10$pPEqYrVnUMGG.YeG3AVEau7C8e07JVNvqAdlcsjeMdsUpe0/alzqm', 'Admin User', 'admin@univ.edu', 'admin', NULL, '2025-11-08 11:41:08', '', NULL),
(2, 'head_cs', '$2b$10$xcqLkXlo0/qYLqWGqGIFRuMSh3lzZLiJhVErJVtZChOdnvLF6nnjK', 'Dr. Head CS', 'head.cs@univ.edu', 'head', 1, '2025-11-08 11:41:08', '', NULL),
(3, 'teacher_a', '$2b$10$QiupAObi3Sy9oTGLGFtpQOn4dde86XtIXdBN65mrjnFyhFq9rCbTO', 'Teacher A', 'teacher.a@univ.edu', 'teacher', 1, '2025-11-08 11:41:08', '', NULL),
(4, 'teacher_b', '$2b$10$ejnLrIIBhURQAzFZ5W4/tejTo5TdooGdD/5j3A0tMUOjB1rA0UyNi', 'Teacher B', 'teacher.b@univ.edu', 'teacher', 2, '2025-11-08 11:41:08', '', NULL),
(6, 'head_physics', '$2b$10$Yg.mI9U7rqu.vafQ4WLWH.i.mTDG.F008jKlPKUFzdv776kIIy4BC', 'สมคิด คิดมาก', 'somkid@teacher.ac.th', 'head', 2, '2025-11-23 16:44:17', '', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`department_id`),
  ADD UNIQUE KEY `department_name` (`department_name`);

--
-- Indexes for table `leave_attachments`
--
ALTER TABLE `leave_attachments`
  ADD PRIMARY KEY (`attachment_id`),
  ADD KEY `request_id` (`request_id`);

--
-- Indexes for table `leave_quotas`
--
ALTER TABLE `leave_quotas`
  ADD PRIMARY KEY (`quota_id`),
  ADD UNIQUE KEY `uk_user_type_year` (`user_id`,`leave_type`,`year`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`request_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `approver_id` (`approver_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`notification_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `department_id` (`department_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `department_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `leave_attachments`
--
ALTER TABLE `leave_attachments`
  MODIFY `attachment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leave_quotas`
--
ALTER TABLE `leave_quotas`
  MODIFY `quota_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `leave_requests`
--
ALTER TABLE `leave_requests`
  MODIFY `request_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `notification_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `leave_attachments`
--
ALTER TABLE `leave_attachments`
  ADD CONSTRAINT `leave_attachments_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `leave_requests` (`request_id`) ON DELETE CASCADE;

--
-- Constraints for table `leave_quotas`
--
ALTER TABLE `leave_quotas`
  ADD CONSTRAINT `leave_quotas_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`approver_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
