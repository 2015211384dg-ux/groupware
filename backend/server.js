const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// 환경 변수 로드
dotenv.config();

const app = express();

// ============================================
// 미들웨어 설정
// ============================================

// 보안 헤더
app.use(helmet({
    hsts: false,                    // HTTP 내부망
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc:    ["'self'"],
            scriptSrc:     ["'self'"],
            // Pretendard 폰트 CDN + React 인라인 스타일
            styleSrc:      ["'self'", "https://cdn.jsdelivr.net", "'unsafe-inline'"],
            fontSrc:       ["'self'", "https://cdn.jsdelivr.net"],
            imgSrc:        ["'self'", "data:", "blob:"],
            connectSrc:    ["'self'"],
            mediaSrc:      ["'self'", "blob:"],
            workerSrc:     ["'self'", "blob:"],   // PDF.js 웹워커
            objectSrc:     ["'none'"],
            frameAncestors:["'none'"],            // 클릭재킹 방어
            baseUri:       ["'self'"],
        }
    }
}));

// Rate Limiting - 전체 API
// 내부망 IP(10.x.x.x, 192.168.x.x, 127.x.x.x) 여부 판별
function isInternalIp(ip) {
    if (!ip) return false;
    const clean = ip.replace(/^::ffff:/, '');
    return /^(10\.|192\.168\.|127\.|::1)/.test(clean);
}

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3000,                  // NAT 환경 — IP 공유 고려
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isInternalIp(req.ip || req.connection?.remoteAddress),
    message: { success: false, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
});

// 로그인 리밋 — 외부 접근 시에만 적용
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isInternalIp(req.ip || req.connection?.remoteAddress),
    message: { success: false, message: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' }
});

app.use('/api/', globalLimiter);
app.use('/api/v1/auth/login', loginLimiter);

// CORS 설정
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim());

// 내부망 IP 대역 허용 (10.x.x.x)
const isInternalOrigin = (origin) => {
    try {
        const { hostname } = new URL(origin);
        return /^10\.\d+\.\d+\.\d+$/.test(hostname);
    } catch {
        return false;
    }
};

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || isInternalOrigin(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS 정책에 의해 차단된 origin: ${origin}`));
        }
    },
    credentials: true
}));

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie Parser
app.use(cookieParser());

// 정적 파일 제공 (업로드된 파일) — 인증 필수
app.use('/uploads', (req, res, next) => {
    const token = req.cookies?.accessToken ||
        (req.headers.authorization?.startsWith('Bearer ')
            ? req.headers.authorization.substring(7)
            : null);
    if (!token) return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
}, express.static(path.join(__dirname, 'uploads')));

// 요청 로깅
app.use((req, res, next) => {
    const hasCookie = !!req.cookies?.accessToken;
    res.on('finish', () => {
        const mark = res.statusCode >= 400 ? '⚠️ ' : '';
        const cookieInfo = req.url.startsWith('/api/') ? ` [cookie:${hasCookie ? 'O' : 'X'}]` : '';
        console.log(`${mark}[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode}${cookieInfo}`);
    });
    next();
});

// ============================================
// DB 마이그레이션 (refresh_tokens 테이블)
// ============================================
const db = require('./config/database');

db.query(`
    CREATE TABLE IF NOT EXISTS \`refresh_tokens\` (
        \`id\`          INT(11) NOT NULL AUTO_INCREMENT,
        \`user_id\`     INT(11) NOT NULL,
        \`token_hash\`  VARCHAR(255) NOT NULL,
        \`expires_at\`  DATETIME NOT NULL,
        \`created_at\`  DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_user\` (\`user_id\`),
        KEY \`idx_token\` (\`token_hash\`),
        CONSTRAINT \`fk_rt_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('refresh_tokens 테이블 생성 실패:', err.message));

// system_settings 신규 컬럼 추가
const settingsCols = [
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_min_length INT NOT NULL DEFAULT 8 COMMENT '비밀번호 최소 길이'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS password_require_special TINYINT(1) NOT NULL DEFAULT 0 COMMENT '특수문자 필수'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS login_fail_lock_count INT NOT NULL DEFAULT 5 COMMENT '로그인 실패 잠금 횟수 (0=비활성)'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS log_retention_days INT NOT NULL DEFAULT 90 COMMENT '로그 보관 기간(일) (0=영구보관)'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS popup_notice_enabled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '팝업 공지 활성화'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS popup_notice_title VARCHAR(200) DEFAULT NULL COMMENT '팝업 공지 제목'`,
    `ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS popup_notice_content TEXT DEFAULT NULL COMMENT '팝업 공지 내용'`,
];
settingsCols.forEach(sql => db.query(sql).catch(() => {}));

// users 로그인 잠금 컬럼 추가
db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_fail_count INT NOT NULL DEFAULT 0`).catch(() => {});
db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until DATETIME DEFAULT NULL`).catch(() => {});
db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});

// 점검 메시지 컬럼 추가
db.query(`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS maintenance_message VARCHAR(500) DEFAULT NULL`).catch(() => {});

// 피드백 테이블 생성
db.query(`
    CREATE TABLE IF NOT EXISTS feedback (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        type        ENUM('bug','improvement','inconvenience','other') NOT NULL DEFAULT 'other',
        title       VARCHAR(200) NOT NULL,
        content     TEXT NOT NULL,
        status      ENUM('pending','reviewing','resolved','hold') NOT NULL DEFAULT 'pending',
        admin_note  TEXT DEFAULT NULL,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW(),
        CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feedback 테이블 생성 실패:', err.message));

// notifications 테이블 생성
db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        type        ENUM('post','comment','feedback','ar') NOT NULL,
        title       VARCHAR(255) NOT NULL,
        body        TEXT DEFAULT NULL,
        url         VARCHAR(500) DEFAULT NULL,
        message     TEXT DEFAULT NULL,
        link        VARCHAR(500) DEFAULT NULL,
        is_read     TINYINT(1) NOT NULL DEFAULT 0,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('notifications 테이블 생성 실패:', err.message));

// ─── AR 프로젝트 테이블 ────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS ar_projects (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        ar_code         VARCHAR(50)  NOT NULL,
        title           VARCHAR(255) NOT NULL,
        description     TEXT,
        budget_amount   DECIMAL(18,2) NOT NULL DEFAULT 0,
        currency        VARCHAR(10)  NOT NULL DEFAULT 'KRW',
        status          ENUM('active','closed','on_hold') NOT NULL DEFAULT 'active',
        created_by      INT NOT NULL,
        created_at      DATETIME DEFAULT NOW(),
        updated_at      DATETIME DEFAULT NOW() ON UPDATE NOW(),
        CONSTRAINT fk_ar_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_projects 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS ar_activity_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        user_id     INT NOT NULL,
        action      VARCHAR(50) NOT NULL,
        detail      TEXT,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_ar_log_proj FOREIGN KEY (project_id) REFERENCES ar_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ar_log_user FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_activity_logs 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS ar_project_teams (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        project_id    INT NOT NULL,
        department_id INT NOT NULL,
        UNIQUE KEY uq_ar_pt (project_id, department_id),
        CONSTRAINT fk_ar_pt_proj FOREIGN KEY (project_id) REFERENCES ar_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ar_pt_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_project_teams 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS ar_expenses (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        user_id     INT NOT NULL,
        amount      DECIMAL(18,2) NOT NULL,
        description TEXT NOT NULL,
        category    VARCHAR(100),
        spent_at    DATE NOT NULL,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_ar_exp_project FOREIGN KEY (project_id) REFERENCES ar_projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_ar_exp_user    FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('ar_expenses 테이블 생성 실패:', err.message));

// ar_projects ar_code 유니크 제약
db.query(`ALTER TABLE ar_projects ADD UNIQUE KEY uq_ar_code (ar_code)`).catch(() => {});

// notifications type ENUM에 'ar' 추가
db.query(`ALTER TABLE notifications MODIFY COLUMN type ENUM('post','comment','feedback','ar') NOT NULL`).catch(() => {});

// popup_notices 테이블 생성 (다중 팝업 공지)
db.query(`
    CREATE TABLE IF NOT EXISTS popup_notices (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        content     TEXT,
        is_active   TINYINT(1) NOT NULL DEFAULT 1,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW()
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('popup_notices 테이블 생성 실패:', err.message));

// ─── 프로젝트 관리 테이블 ───────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS projects (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        name             VARCHAR(100) NOT NULL,
        description      TEXT,
        color            VARCHAR(7)   DEFAULT '#667eea',
        emoji            VARCHAR(10)  DEFAULT NULL,
        is_public        TINYINT(1)   DEFAULT 0,
        require_approval TINYINT(1)   DEFAULT 0,
        home_tab         ENUM('feed','task','gantt','calendar','file') DEFAULT 'task',
        active_tabs      JSON,
        status           ENUM('active','archived') DEFAULT 'active',
        owner_id         INT NOT NULL,
        created_at       DATETIME DEFAULT NOW(),
        updated_at       DATETIME DEFAULT NOW() ON UPDATE NOW(),
        CONSTRAINT fk_proj_owner FOREIGN KEY (owner_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('projects 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS project_members (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        user_id     INT NOT NULL,
        role        ENUM('owner','manager','member','viewer') DEFAULT 'member',
        joined_at   DATETIME DEFAULT NOW(),
        invited_by  INT,
        UNIQUE KEY uq_proj_user (project_id, user_id),
        CONSTRAINT fk_pm_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_pm_user FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_members 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS task_groups (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        name        VARCHAR(100) NOT NULL,
        color       VARCHAR(7)   DEFAULT '#667eea',
        sort_order  INT          DEFAULT 0,
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_tg_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('task_groups 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        project_id     INT NOT NULL,
        group_id       INT DEFAULT NULL,
        parent_task_id INT DEFAULT NULL,
        title          VARCHAR(200) NOT NULL,
        description    TEXT,
        status         ENUM('todo','in_progress','done','on_hold') DEFAULT 'todo',
        priority       ENUM('urgent','high','normal','low') DEFAULT 'normal',
        progress       TINYINT UNSIGNED DEFAULT 0,
        start_date     DATE,
        due_date       DATE,
        sort_order     INT DEFAULT 0,
        created_by     INT NOT NULL,
        completed_at   DATETIME,
        created_at     DATETIME DEFAULT NOW(),
        updated_at     DATETIME DEFAULT NOW() ON UPDATE NOW(),
        INDEX idx_task_proj   (project_id),
        INDEX idx_task_status (status),
        INDEX idx_task_due    (due_date),
        INDEX idx_task_group  (group_id, sort_order),
        CONSTRAINT fk_task_proj  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_task_group FOREIGN KEY (group_id)   REFERENCES task_groups(id) ON DELETE SET NULL,
        CONSTRAINT fk_task_creator FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('tasks 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS task_assignees (
        task_id     INT NOT NULL,
        user_id     INT NOT NULL,
        assigned_at DATETIME DEFAULT NOW(),
        assigned_by INT,
        PRIMARY KEY (task_id, user_id),
        INDEX idx_ta_user (user_id),
        CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_ta_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('task_assignees 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        task_id    INT NOT NULL,
        user_id    INT NOT NULL,
        content    TEXT NOT NULL,
        mentions   JSON,
        is_deleted TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT NOW(),
        updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
        INDEX idx_tc_task (task_id),
        CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT fk_tc_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('task_comments 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS project_activity_logs (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        task_id    INT,
        user_id    INT NOT NULL,
        action     VARCHAR(60) NOT NULL,
        target     VARCHAR(60),
        old_value  JSON,
        new_value  JSON,
        ip_address VARCHAR(45),
        created_at DATETIME DEFAULT NOW(),
        INDEX idx_pal_proj (project_id),
        INDEX idx_pal_task (task_id),
        INDEX idx_pal_date (created_at),
        CONSTRAINT fk_pal_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_activity_logs 테이블 생성 실패:', err.message));

// ─── 프로젝트 피드 테이블 ────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS project_feeds (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        user_id     INT NOT NULL,
        content     TEXT NOT NULL,
        mentions    JSON,
        is_pinned   TINYINT(1) DEFAULT 0,
        is_deleted  TINYINT(1) DEFAULT 0,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW(),
        INDEX idx_pf_proj (project_id),
        INDEX idx_pf_created (created_at),
        CONSTRAINT fk_pf_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_pf_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_feeds 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS feed_attachments (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        feed_id     INT NOT NULL,
        file_name   VARCHAR(255) NOT NULL,
        file_path   VARCHAR(500) NOT NULL,
        file_size   INT UNSIGNED,
        mime_type   VARCHAR(100),
        created_at  DATETIME DEFAULT NOW(),
        CONSTRAINT fk_fa_feed FOREIGN KEY (feed_id) REFERENCES project_feeds(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feed_attachments 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS feed_comments (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        feed_id     INT NOT NULL,
        user_id     INT NOT NULL,
        content     TEXT NOT NULL,
        mentions    JSON,
        is_deleted  TINYINT(1) DEFAULT 0,
        created_at  DATETIME DEFAULT NOW(),
        updated_at  DATETIME DEFAULT NOW() ON UPDATE NOW(),
        INDEX idx_fc_feed (feed_id),
        CONSTRAINT fk_fc_feed FOREIGN KEY (feed_id) REFERENCES project_feeds(id) ON DELETE CASCADE,
        CONSTRAINT fk_fc_user FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feed_comments 테이블 생성 실패:', err.message));

// notifications type enum 확장
db.query(`ALTER TABLE notifications MODIFY COLUMN type ENUM('post','comment','feedback','ar','project','security') NOT NULL`).catch(() => {});

// magic_tokens — 데스크탑→브라우저 일회성 자동 로그인 토큰
db.query(`
    CREATE TABLE IF NOT EXISTS magic_tokens (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        token_hash VARCHAR(64)  NOT NULL,
        user_id    INT          NOT NULL,
        expires_at DATETIME     NOT NULL,
        used_at    DATETIME     DEFAULT NULL,
        created_at DATETIME     DEFAULT NOW(),
        UNIQUE KEY uq_mt_hash (token_hash),
        INDEX      idx_mt_user  (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('magic_tokens 테이블 생성 실패:', err.message));

// ─── 프로젝트 커스텀 컬럼 ─────────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS project_custom_columns (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        name        VARCHAR(100) NOT NULL,
        field_type  ENUM('text','number','date','checkbox','select') DEFAULT 'text',
        description VARCHAR(200),
        sort_order  INT DEFAULT 0,
        created_at  DATETIME DEFAULT NOW(),
        INDEX idx_pcc_proj (project_id),
        CONSTRAINT fk_pcc_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_custom_columns 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS task_custom_values (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        task_id   INT NOT NULL,
        column_id INT NOT NULL,
        value     TEXT,
        UNIQUE KEY uk_tcv (task_id, column_id),
        INDEX idx_tcv_task (task_id),
        INDEX idx_tcv_col  (column_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('task_custom_values 테이블 생성 실패:', err.message));

// project_feeds에 post_type, title, post_meta 컬럼 추가
db.query(`ALTER TABLE project_feeds ADD COLUMN IF NOT EXISTS post_type ENUM('text','todo','schedule','poll') NOT NULL DEFAULT 'text'`).catch(() => {});
db.query(`ALTER TABLE project_feeds ADD COLUMN IF NOT EXISTS title VARCHAR(200) DEFAULT NULL`).catch(() => {});
db.query(`ALTER TABLE project_feeds ADD COLUMN IF NOT EXISTS post_meta JSON DEFAULT NULL`).catch(() => {});
db.query(`ALTER TABLE project_feeds MODIFY COLUMN content TEXT`).catch(() => {});

// ─── 피드 할 일 항목 ─────────────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS feed_todo_items (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        feed_id    INT NOT NULL,
        item_text  VARCHAR(200) NOT NULL,
        is_done    TINYINT(1) DEFAULT 0,
        done_by    INT DEFAULT NULL,
        done_at    DATETIME DEFAULT NULL,
        sort_order TINYINT DEFAULT 0,
        INDEX idx_fti_feed (feed_id),
        CONSTRAINT fk_fti_feed FOREIGN KEY (feed_id) REFERENCES project_feeds(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feed_todo_items 테이블 생성 실패:', err.message));

// ─── 피드 투표 항목 / 투표 결과 ─────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS feed_poll_options (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        feed_id     INT NOT NULL,
        option_text VARCHAR(200) NOT NULL,
        sort_order  TINYINT DEFAULT 0,
        CONSTRAINT fk_fpo_feed FOREIGN KEY (feed_id) REFERENCES project_feeds(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feed_poll_options 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS feed_poll_votes (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        feed_id   INT NOT NULL,
        option_id INT NOT NULL,
        user_id   INT NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uk_fpv (option_id, user_id),
        INDEX idx_fpv_feed (feed_id),
        CONSTRAINT fk_fpv_feed   FOREIGN KEY (feed_id)   REFERENCES project_feeds(id)     ON DELETE CASCADE,
        CONSTRAINT fk_fpv_option FOREIGN KEY (option_id) REFERENCES feed_poll_options(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('feed_poll_votes 테이블 생성 실패:', err.message));

// ─── 프로젝트 참여 요청 테이블 ───────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS project_join_requests (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        user_id    INT NOT NULL,
        status     ENUM('pending','approved','rejected') DEFAULT 'pending',
        message    VARCHAR(300),
        reviewed_by INT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT NOW(),
        UNIQUE KEY uk_pjr (project_id, user_id),
        INDEX idx_pjr_proj (project_id),
        CONSTRAINT fk_pjr_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_pjr_user FOREIGN KEY (user_id)    REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_join_requests 테이블 생성 실패:', err.message));

// ─── 프로젝트 파일 관리 테이블 ────────────────────────────────
db.query(`
    CREATE TABLE IF NOT EXISTS project_file_folders (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        parent_id  INT DEFAULT NULL,
        name       VARCHAR(200) NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT NOW(),
        INDEX idx_pff_proj (project_id),
        CONSTRAINT fk_pff_proj   FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_pff_parent FOREIGN KEY (parent_id)  REFERENCES project_file_folders(id) ON DELETE CASCADE,
        CONSTRAINT fk_pff_user   FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_file_folders 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS project_files (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        project_id  INT NOT NULL,
        folder_id   INT DEFAULT NULL,
        uploaded_by INT NOT NULL,
        file_name   VARCHAR(500) NOT NULL,
        file_path   VARCHAR(1000) NOT NULL,
        file_size   BIGINT DEFAULT 0,
        mime_type   VARCHAR(200),
        created_at  DATETIME DEFAULT NOW(),
        INDEX idx_pfile_proj   (project_id),
        INDEX idx_pfile_folder (folder_id),
        CONSTRAINT fk_pfile_proj   FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_pfile_folder FOREIGN KEY (folder_id)  REFERENCES project_file_folders(id) ON DELETE SET NULL,
        CONSTRAINT fk_pfile_user   FOREIGN KEY (uploaded_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('project_files 테이블 생성 실패:', err.message));

// chatbot 세션/메시지 테이블 생성
db.query(`
    CREATE TABLE IF NOT EXISTS chatbot_sessions (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        session_id  VARCHAR(36) NOT NULL UNIQUE,
        title       VARCHAR(200) NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_cs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_cs_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('chatbot_sessions 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS chatbot_messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        session_id  VARCHAR(36) NOT NULL,
        role        ENUM('user','assistant') NOT NULL,
        content     TEXT NOT NULL,
        sources     JSON NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cm_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('chatbot_messages 테이블 생성 실패:', err.message));

db.query(`
    CREATE TABLE IF NOT EXISTS chatbot_feedback (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        message_id  INT NOT NULL,
        user_id     INT NOT NULL,
        rating      ENUM('up','down') NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_feedback (message_id, user_id),
        INDEX idx_cf_message (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`).catch(err => console.error('chatbot_feedback 테이블 생성 실패:', err.message));

// ============================================
// 점검 모드 미들웨어
// ============================================

let _maintCache = { mode: false, msg: '', ts: 0 };

// 캐시 강제 갱신 (settings 저장 시 호출)
function invalidateMaintenanceCache() { _maintCache.ts = 0; }
module.exports = { invalidateMaintenanceCache };

const MAINTENANCE_BYPASS = [
    '/api/v1/auth/',
    '/api/v1/settings/public',
    '/api/v1/settings/maintenance',
    '/api/v1/admin/settings',
];

app.use('/api/', async (req, res, next) => {
    if (MAINTENANCE_BYPASS.some(p => req.originalUrl.startsWith(p))) return next();
    const now = Date.now();
    if (now - _maintCache.ts > 15000) {
        try {
            const [rows] = await db.query('SELECT maintenance_mode, maintenance_message FROM system_settings LIMIT 1');
            _maintCache = {
                mode: !!rows[0]?.maintenance_mode,
                msg:  rows[0]?.maintenance_message || '',
                ts:   now,
            };
        } catch { _maintCache.ts = now; }
    }
    if (_maintCache.mode) {
        return res.status(503).json({
            success: false,
            maintenance: true,
            message: _maintCache.msg || '시스템 점검 중입니다. 잠시 후 다시 접속해주세요.',
        });
    }
    next();
});

// ============================================
// 라우트 설정
// ============================================

// 헬스 체크
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const authRoutes        = require('./routes/auth');
const userRoutes        = require('./routes/users');
const departmentRoutes  = require('./routes/departments');
const boardRoutes       = require('./routes/boards');
const postRoutes        = require('./routes/posts');
const commentRoutes     = require('./routes/comments');
const addressbookRoutes = require('./routes/addressbook');
const hrRoutes          = require('./routes/hr');
const attachmentRoutes  = require('./routes/attachments');
const searchRoutes      = require('./routes/search');
const settingsRoutes    = require('./routes/settings');
const dashboardRoutes   = require('./routes/dashboard');
const eventRoutes       = require('./routes/events');
const approvalRoutes      = require('./routes/approval');
const approvalAdminRoutes = require('./routes/approvalAdmin');
const feedbackRoutes        = require('./routes/feedback');
const notificationRoutes    = require('./routes/notifications');
const arRoutes              = require('./routes/ar');
const chatbotRoutes         = require('./routes/chatbot');
const voucherRoutes         = require('./routes/voucher');
const projectRoutes         = require('./routes/projects');

app.use('/api/v1/auth',            authRoutes);
app.use('/api/v1/users',           userRoutes);
app.use('/api/v1/departments',     departmentRoutes);
app.use('/api/v1/boards',          boardRoutes);
app.use('/api/v1/posts',           postRoutes);
app.use('/api/v1/comments',        commentRoutes);
app.use('/api/v1/addressbook',     addressbookRoutes);
app.use('/api/v1/hr',              hrRoutes);
app.use('/api/v1/attachments',     attachmentRoutes);
app.use('/api/v1/search',          searchRoutes);
app.use('/api/v1/settings',         settingsRoutes);
app.use('/api/v1/admin/settings',  settingsRoutes);
app.use('/api/v1/dashboard',       dashboardRoutes);
app.use('/api/v1/events',          eventRoutes);
app.use('/api/v1/approval/admin',  approvalAdminRoutes);
app.use('/api/v1/approval',        approvalRoutes);
app.use('/api/v1/feedback',        feedbackRoutes);
app.use('/api/v1/notifications',   notificationRoutes);
app.use('/api/v1/ar',              arRoutes);
app.use('/api/v1/chatbot',        chatbotRoutes);
app.use('/api/v1/voucher',        voucherRoutes);
app.use('/api/v1/projects',       projectRoutes);

// ============================================
// 에러 핸들링
// ============================================

// 프론트엔드 정적 파일 서빙 (SPA)
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || '서버 오류가 발생했습니다.',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// 주기적 정리 작업
// ============================================

// 만료된 토큰 매 1시간마다 삭제
setInterval(async () => {
    try {
        const [r1] = await db.query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
        if (r1.affectedRows > 0) console.log(`[cleanup] 만료된 refresh_tokens ${r1.affectedRows}개 삭제`);
        const [r2] = await db.query('DELETE FROM magic_tokens WHERE expires_at < NOW()');
        if (r2.affectedRows > 0) console.log(`[cleanup] 만료된 magic_tokens ${r2.affectedRows}개 삭제`);
    } catch (err) {
        console.error('[cleanup] 토큰 정리 실패:', err.message);
    }
}, 60 * 60 * 1000);

// 90일 이상된 system_logs 매일 새벽 3시 삭제
function scheduleDailyCleanup() {
    const now = new Date();
    const next3am = new Date();
    next3am.setHours(3, 0, 0, 0);
    if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
    const msUntil3am = next3am - now;

    setTimeout(async function tick() {
        try {
            const [result] = await db.query(
                'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
            );
            if (result.affectedRows > 0) {
                console.log(`[cleanup] 90일 이상 system_logs ${result.affectedRows}개 삭제`);
            }
        } catch (err) {
            console.error('[cleanup] system_logs 정리 실패:', err.message);
        }
        setTimeout(tick, 24 * 60 * 60 * 1000);
    }, msUntil3am);
}
scheduleDailyCleanup();

// ============================================
// 서버 시작
// ============================================

const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log(`🚀 그룹웨어 서버가 시작되었습니다.`);
    console.log(`📡 포트: ${PORT}`);
    console.log(`🌍 호스트: ${HOST}`);
    console.log(`🔗 로컬: http://localhost:${PORT}`);
    console.log(`🔗 네트워크: http://10.18.10.4:${PORT}`);
    console.log('='.repeat(50));
    // SMTP 연결 확인
    if (process.env.SMTP_USER && !process.env.SMTP_USER.includes('회사도메인')) {
        require('./utils/mailer').verifyConnection();
    }
});

module.exports = app;
