-- --------------------------------------------------------
-- 호스트:                          127.0.0.1
-- 서버 버전:                        12.1.2-MariaDB - MariaDB Server
-- 서버 OS:                        Win64
-- HeidiSQL 버전:                  12.15.0.7171
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- groupware 데이터베이스 구조 내보내기
CREATE DATABASE IF NOT EXISTS `groupware` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `groupware`;

-- 테이블 groupware.attachments 구조 내보내기
CREATE TABLE IF NOT EXISTS `attachments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `original_filename` varchar(255) NOT NULL,
  `filepath` varchar(500) NOT NULL,
  `filesize` bigint(20) NOT NULL,
  `mimetype` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_post` (`post_id`),
  CONSTRAINT `1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.attachments:~0 rows (대략적) 내보내기

-- 테이블 groupware.attendance 구조 내보내기
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `check_in` time DEFAULT NULL,
  `check_out` time DEFAULT NULL,
  `work_hours` decimal(4,2) DEFAULT NULL,
  `status` enum('PRESENT','ABSENT','LATE','EARLY_LEAVE','HALF_DAY') DEFAULT 'PRESENT',
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attendance` (`employee_id`,`date`),
  KEY `idx_date` (`date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.attendance:~0 rows (대략적) 내보내기

-- 테이블 groupware.audit_logs 구조 내보내기
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `table_name` varchar(50) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_table` (`table_name`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.audit_logs:~0 rows (대략적) 내보내기

-- 테이블 groupware.boards 구조 내보내기
CREATE TABLE IF NOT EXISTS `boards` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `board_type` enum('NOTICE','DEPARTMENT','FREE','ARCHIVE','FAQ') DEFAULT 'FREE',
  `department_id` int(11) DEFAULT NULL,
  `is_public` tinyint(1) DEFAULT 1,
  `order_no` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `department_id` (`department_id`),
  KEY `idx_type` (`board_type`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.boards:~4 rows (대략적) 내보내기
INSERT INTO `boards` (`id`, `name`, `description`, `board_type`, `department_id`, `is_public`, `order_no`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, '공지사항', '전사 공지사항', 'NOTICE', NULL, 1, 1, 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(2, '자료실', '업무 관련 자료 공유', 'ARCHIVE', NULL, 1, 2, 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(3, '자유게시판', '자유로운 소통 공간', 'FREE', NULL, 1, 3, 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(4, 'FAQ', '자주 묻는 질문', 'FAQ', NULL, 1, 4, 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27');

-- 테이블 groupware.comments 구조 내보내기
CREATE TABLE IF NOT EXISTS `comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `content` text NOT NULL,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_post` (`post_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_parent` (`parent_id`),
  CONSTRAINT `1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `3` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.comments:~0 rows (대략적) 내보내기

-- 테이블 groupware.departments 구조 내보내기
CREATE TABLE IF NOT EXISTS `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `parent_id` int(11) DEFAULT NULL,
  `depth` int(11) DEFAULT 0,
  `order_no` int(11) DEFAULT 0,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_parent` (`parent_id`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `1` FOREIGN KEY (`parent_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.departments:~11 rows (대략적) 내보내기
INSERT INTO `departments` (`id`, `name`, `parent_id`, `depth`, `order_no`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
	(1, '대표이사', NULL, 0, 1, '대표이사', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(2, '경영지원본부', NULL, 0, 2, '경영지원본부', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(3, '인사팀', 2, 1, 1, '인사 관리', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(4, '총무팀', 2, 1, 2, '총무 및 자산 관리', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(5, 'IT팀', 2, 1, 3, 'IT 인프라 및 시스템 관리', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(6, '개발본부', NULL, 0, 3, '개발본부', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(7, '프론트엔드팀', 6, 1, 1, '프론트엔드 개발', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(8, '백엔드팀', 6, 1, 2, '백엔드 개발', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(9, '영업본부', NULL, 0, 4, '영업본부', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(10, '영업1팀', 9, 1, 1, '국내 영업', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27'),
	(11, '영업2팀', 9, 1, 2, '해외 영업', 1, '2026-02-10 10:30:27', '2026-02-10 10:30:27');

-- 테이블 groupware.employees 구조 내보내기
CREATE TABLE IF NOT EXISTS `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `employee_number` varchar(20) NOT NULL,
  `department_id` int(11) DEFAULT NULL,
  `position` varchar(50) DEFAULT NULL,
  `job_title` varchar(50) DEFAULT NULL,
  `extension` varchar(20) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `resignation_date` date DEFAULT NULL,
  `status` enum('ACTIVE','ON_LEAVE','RESIGNED') DEFAULT 'ACTIVE',
  `seat_location` varchar(100) DEFAULT NULL,
  `profile_image` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `employee_number` (`employee_number`),
  KEY `idx_employee_number` (`employee_number`),
  KEY `idx_department` (`department_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.employees:~0 rows (대략적) 내보내기
INSERT INTO `employees` (`id`, `user_id`, `employee_number`, `department_id`, `position`, `job_title`, `extension`, `mobile`, `birth_date`, `hire_date`, `resignation_date`, `status`, `seat_location`, `profile_image`, `created_at`, `updated_at`) VALUES
	(1, 1, 'EMP001', 5, '이사', 'IT본부장', NULL, NULL, NULL, '2020-01-01', NULL, 'ACTIVE', NULL, NULL, '2026-02-10 10:30:27', '2026-02-10 10:30:27');

-- 테이블 groupware.leaves 구조 내보내기
CREATE TABLE IF NOT EXISTS `leaves` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `leave_type` enum('ANNUAL','SICK','SPECIAL','UNPAID') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `days` decimal(3,1) NOT NULL,
  `reason` text DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','CANCELLED') DEFAULT 'PENDING',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_dates` (`start_date`,`end_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.leaves:~0 rows (대략적) 내보내기

-- 테이블 groupware.notifications 구조 내보내기
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('COMMENT','REPLY','LIKE','MENTION','SYSTEM') NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `link` varchar(500) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_read` (`is_read`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.notifications:~0 rows (대략적) 내보내기

-- 테이블 groupware.onboarding_checklist 구조 내보내기
CREATE TABLE IF NOT EXISTS `onboarding_checklist` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `checklist_type` enum('ONBOARDING','OFFBOARDING') NOT NULL,
  `item_type` enum('IT_ASSET','ACCOUNT','TRAINING','DOCUMENT','OTHER') NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `is_completed` tinyint(1) DEFAULT 0,
  `completed_by` int(11) DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `completed_by` (`completed_by`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_type` (`checklist_type`),
  KEY `idx_completed` (`is_completed`),
  CONSTRAINT `1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.onboarding_checklist:~0 rows (대략적) 내보내기

-- 테이블 groupware.personal_contacts 구조 내보내기
CREATE TABLE IF NOT EXISTS `personal_contacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `company` varchar(100) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `position` varchar(50) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `memo` text DEFAULT NULL,
  `is_favorite` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_favorite` (`is_favorite`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.personal_contacts:~0 rows (대략적) 내보내기

-- 테이블 groupware.personnel_changes 구조 내보내기
CREATE TABLE IF NOT EXISTS `personnel_changes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `change_type` enum('HIRE','PROMOTION','TRANSFER','RESIGNATION') NOT NULL,
  `from_dept_id` int(11) DEFAULT NULL,
  `to_dept_id` int(11) DEFAULT NULL,
  `from_position` varchar(50) DEFAULT NULL,
  `to_position` varchar(50) DEFAULT NULL,
  `effective_date` date NOT NULL,
  `reason` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `from_dept_id` (`from_dept_id`),
  KEY `to_dept_id` (`to_dept_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_employee` (`employee_id`),
  KEY `idx_date` (`effective_date`),
  CONSTRAINT `1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`from_dept_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `3` FOREIGN KEY (`to_dept_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.personnel_changes:~0 rows (대략적) 내보내기

-- 테이블 groupware.post_likes 구조 내보내기
CREATE TABLE IF NOT EXISTS `post_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `post_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_like` (`post_id`,`user_id`),
  KEY `idx_post` (`post_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.post_likes:~0 rows (대략적) 내보내기

-- 테이블 groupware.posts 구조 내보내기
CREATE TABLE IF NOT EXISTS `posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `board_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `is_pinned` tinyint(1) DEFAULT 0,
  `is_notice` tinyint(1) DEFAULT 0,
  `view_count` int(11) DEFAULT 0,
  `like_count` int(11) DEFAULT 0,
  `is_deleted` tinyint(1) DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_board` (`board_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_pinned` (`is_pinned`),
  KEY `idx_created` (`created_at`),
  FULLTEXT KEY `idx_search` (`title`,`content`),
  CONSTRAINT `1` FOREIGN KEY (`board_id`) REFERENCES `boards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.posts:~9 rows (대략적) 내보내기
INSERT INTO `posts` (`id`, `board_id`, `user_id`, `category`, `title`, `content`, `is_pinned`, `is_notice`, `view_count`, `like_count`, `is_deleted`, `created_at`, `updated_at`) VALUES
	(1, 1, 1, NULL, 'tset', 'stst', 0, 0, 15, 0, 0, '2026-02-10 11:43:22', '2026-02-12 16:08:08'),
	(2, 1, 1, NULL, 'Test', 'Test', 0, 0, 4, 0, 1, '2026-02-10 12:01:25', '2026-02-10 12:01:37'),
	(3, 1, 1, NULL, '[공지] 2025년 하반기 사내 정보보안 교육 실시 안내', 'ABC기업 임직원 여러분께,\n\n안전한 업무 환경 조성 및 정보 자산 보호를 위해 \'2025년 하반기 사내 정보보안 교육\'을 아래와 같이 실시합니다.\n\n최근 고도화되는 사이버 위협으로부터 회사와 개인의 정보를 보호하기 위해 전 직원의 적극적인 참여와 이수가 필수적이오니, 기한 내 교육을 완료하여 주시기 바랍니다.\n\n\n\n✅ 교육 개요\n교육 목적: 최신 정보보안 동향 공유 및 임직원 보안 의식 강화\n\n교육 내용: 개인정보 보호, 랜섬웨어 등 사이버 공격 대응, 안전한 비밀번호 관리 및 업무 시스템 사용 수칙 등\n\n교육 방식: 온라인 그룹웨어 교육 시스템 (LMS)을 통한 비대면 시청\n\n교육 시간: 약 40분 (개인별 진도율 체크)\n\n🗓️ 교육 기간 및 이수 방법\n교육 기간: 2025년 11월 15일 (금) ~ 11월 29일 (금) (2주간)\n\n이수 방법: 네이버웍스 메일 참고\n\n\n\n지정된 교육 기간 내에 이수하지 않을 경우, 개인별 사유 소명 및 별도 교육을 실시할 수 있습니다.\n\n교육 이수 여부는 연말 인사평가에 반영될 수 있습니다.\n\n\n\n\n임직원 여러분의 적극적인 참여를 부탁드립니다. 감사합니다.\n\nABC기업 경영지원팀 드림', 0, 0, 10, 0, 1, '2026-02-10 15:52:21', '2026-02-11 11:02:24'),
	(4, 1, 1, NULL, 'ㅇㄴ', '<p><a href="ㅇㄴㅇㄴㅇㄴㅇㄴ" rel="noopener noreferrer" target="_blank">ㅇㄴㅇㄴㅇㄴㅇㄴ</a></p>', 0, 0, 4, 0, 1, '2026-02-10 16:04:09', '2026-02-10 16:04:17'),
	(5, 1, 1, NULL, 'test', '<p><a href="https://www.naver.com" rel="noopener noreferrer" target="_blank">https://www.naver.com</a></p>', 0, 0, 2, 0, 1, '2026-02-10 16:04:38', '2026-02-10 16:04:44'),
	(6, 1, 1, NULL, 'T', '<p><strong>ABC기업 임직원 여러분께,</strong></p><p>안전한 업무 환경 조성 및 정보 자산 보호를 위해&nbsp;<strong>\'2025년 하반기 사내 정보보안 교육\'</strong>을 아래와 같이 실시합니다.</p><p>최근 고도화되는 사이버 위협으로부터 회사와 개인의 정보를 보호하기 위해 전 직원의 적극적인 참여와 이수가 필수적이오니, 기한 내 교육을 완료하여 주시기 바랍니다.</p><p><br></p><p><br></p><p><strong>✅ 교육 개요</strong></p><ul><li><strong>교육 목적:</strong>&nbsp;최신 정보보안 동향 공유 및 임직원 보안 의식 강화</li><li><strong>교육 내용:</strong>&nbsp;개인정보 보호, 랜섬웨어 등 사이버 공격 대응, 안전한 비밀번호 관리 및 업무 시스템 사용 수칙 등</li><li><strong>교육 방식:</strong>&nbsp;온라인 그룹웨어 교육 시스템 (LMS)을 통한&nbsp;<strong>비대면 시청</strong></li><li><strong>교육 시간:</strong>&nbsp;약 40분 (개인별 진도율 체크)</li></ul><p><strong>🗓️ 교육 기간 및 이수 방법</strong></p><p><br></p><ul><li><strong>교육 기간:</strong>&nbsp;<strong>2025년 11월 15일 (금) ~ 11월 29일 (금) (2주간)</strong></li><li><strong>이수 방법:&nbsp;</strong>네이버웍스 메일 참고</li></ul><p><br></p><p><span style="color: rgb(102, 102, 102);">지정된 교육 기간 내에 이수하지 않을 경우,&nbsp;</span><strong style="color: rgb(102, 102, 102);">개인별 사유 소명</strong><span style="color: rgb(102, 102, 102);">&nbsp;및&nbsp;</span><strong style="color: rgb(102, 102, 102);">별도 교육</strong><span style="color: rgb(102, 102, 102);">을 실시할 수 있습니다.</span></p><p><span style="color: rgb(102, 102, 102);">교육 이수 여부는 연말 인사평가에 반영될 수 있습니다.</span></p><p><br></p><p><br></p><p>임직원 여러분의 적극적인 참여를 부탁드립니다. 감사합니다.</p><p><strong>ABC기업 경영지원팀 드림</strong></p>', 0, 0, 37, 0, 0, '2026-02-11 11:02:11', '2026-02-12 15:53:14'),
	(7, 2, 1, '공지', 'Test', '<p>test</p>', 0, 0, 4, 0, 1, '2026-02-11 17:49:54', '2026-02-11 17:50:10'),
	(8, 2, 1, NULL, 'test', '<p>st</p>', 0, 0, 3, 0, 0, '2026-02-11 17:50:15', '2026-02-12 16:01:29'),
	(9, 1, 1, NULL, 'ds', '<p>ds</p>', 0, 0, 3, 0, 0, '2026-02-12 15:24:46', '2026-02-12 16:16:22'),
	(10, 1, 1, NULL, 'ds', '<p>ds</p>', 0, 0, 3, 0, 0, '2026-02-12 15:26:36', '2026-02-12 16:16:24'),
	(11, 1, 1, NULL, 'ds', '<p>123</p>', 0, 0, 3, 0, 0, '2026-02-12 15:27:23', '2026-02-12 16:16:26');

-- 테이블 groupware.system_logs 구조 내보내기
CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `log_type` enum('info','warning','error','success') NOT NULL DEFAULT 'info',
  `message` text NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_log_type` (`log_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.system_logs:~4 rows (대략적) 내보내기
INSERT INTO `system_logs` (`id`, `log_type`, `message`, `user_id`, `ip_address`, `user_agent`, `created_at`) VALUES
	(1, 'info', '시스템이 시작되었습니다', NULL, NULL, NULL, '2026-02-12 05:49:38'),
	(2, 'info', '사용자 로그인: admin', 1, NULL, NULL, '2026-02-12 05:49:38'),
	(3, 'warning', '파일 업로드 크기 제한 초과', 1, NULL, NULL, '2026-02-12 05:49:38'),
	(4, 'success', '시스템 설정이 업데이트되었습니다', 1, NULL, NULL, '2026-02-12 05:49:38');

-- 테이블 groupware.system_settings 구조 내보내기
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `site_name` varchar(100) NOT NULL DEFAULT '그룹웨어',
  `site_description` text DEFAULT NULL,
  `max_upload_size` int(11) NOT NULL DEFAULT 10 COMMENT '최대 업로드 크기 (MB)',
  `session_timeout` int(11) NOT NULL DEFAULT 60 COMMENT '세션 타임아웃 (분)',
  `allow_registration` tinyint(1) NOT NULL DEFAULT 0 COMMENT '회원 가입 허용',
  `require_email_verification` tinyint(1) NOT NULL DEFAULT 1 COMMENT '이메일 인증 필수',
  `maintenance_mode` tinyint(1) NOT NULL DEFAULT 0 COMMENT '유지보수 모드',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.system_settings:~0 rows (대략적) 내보내기
INSERT INTO `system_settings` (`id`, `site_name`, `site_description`, `max_upload_size`, `session_timeout`, `allow_registration`, `require_email_verification`, `maintenance_mode`, `created_at`, `updated_at`) VALUES
	(2, '암페놀센싱코리아', '우리 회사 그룹웨어 시스템', 10, 60, 0, 1, 0, '2026-02-12 05:56:23', '2026-02-12 06:04:08');

-- 테이블 groupware.users 구조 내보내기
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `role` enum('SUPER_ADMIN','HR_ADMIN','DEPT_ADMIN','USER') DEFAULT 'USER',
  `is_active` tinyint(1) DEFAULT 1,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 테이블 데이터 groupware.users:~0 rows (대략적) 내보내기
INSERT INTO `users` (`id`, `username`, `password`, `name`, `email`, `role`, `is_active`, `last_login`, `created_at`, `updated_at`) VALUES
	(1, 'admin', '$2b$10$nS9KdwGbtECocWwMuXDjz..chuicy/xitS9w/FNWS51i4dmdWfTMq', '시스템관리자', 'admin@company.com', 'SUPER_ADMIN', 1, '2026-02-12 14:22:57', '2026-02-10 10:30:27', '2026-02-12 14:22:57');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
