const {
    app, BrowserWindow, Tray, Menu, shell,
    ipcMain, nativeImage, screen
} = require('electron');
const path = require('path');
const fs   = require('fs');
const zlib = require('zlib');
const axios = require('axios');

// ============================================
// 설정 저장소 (userData/config.json)
// ============================================
const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
    try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
    catch { return {}; }
}
function saveConfig(data) {
    const prev = loadConfig();
    fs.writeFileSync(configPath, JSON.stringify({ ...prev, ...data }, null, 2));
}

// ============================================
// PNG 생성 (트레이 아이콘용, 외부 파일 불필요)
// ============================================
function crc32(buf) {
    if (!crc32.table) {
        crc32.table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            crc32.table[i] = c;
        }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crc32.table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return ((c ^ 0xFFFFFFFF) >>> 0);
}

function pngChunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const crcVal = crc32(Buffer.concat([t, data]));
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crcVal);
    return Buffer.concat([len, t, data, crcBuf]);
}

// ============================================
// 벨 아이콘 PNG 생성 (RGBA, 32×32)
// ============================================
function makeIconPNG(alertMode = false) {
    const S = 32;
    const buf = new Uint8Array(S * S * 4); // RGBA, 기본 투명

    function px(x, y, r, g, b, a = 255) {
        if (x < 0 || x >= S || y < 0 || y >= S) return;
        const i = (y * S + x) * 4;
        buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
    }

    function disc(cx, cy, r, dr, dg, db, da = 255) {
        for (let y = Math.ceil(cy-r); y <= Math.floor(cy+r); y++)
            for (let x = Math.ceil(cx-r); x <= Math.floor(cx+r); x++)
                if ((x-cx)**2 + (y-cy)**2 <= r*r) px(x, y, dr, dg, db, da);
    }

    // ── 배경: 둥근 사각형 (파란-보라 그라디언트) ────────
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const cr = 7;
            const dx = Math.max(0, cr - x, x - (S - 1 - cr));
            const dy = Math.max(0, cr - y, y - (S - 1 - cr));
            if (dx*dx + dy*dy <= cr*cr) {
                const t = (S - y) / S;
                px(x, y,
                    Math.min(255, 102 + ((t * 30) | 0)),
                    Math.min(255, 126 + ((t * 18) | 0)),
                    Math.min(255, 234 + ((t *  8) | 0))
                );
            }
        }
    }

    // ── 흰색 벨 ──────────────────────────────────────
    // 손잡이 (꼭지)
    disc(16, 5, 2.5, 255, 255, 255);

    // 벨 돔: y=5에서 좁게 시작, y=19에서 최대폭 (sqrt 커브)
    for (let y = 5; y <= 19; y++) {
        const hw = 8.5 * Math.sqrt(Math.max(0, (y - 5) / 14));
        const lx = Math.round(16 - hw), rx = Math.round(16 + hw);
        for (let x = lx; x <= rx; x++) px(x, y, 255, 255, 255);
    }

    // 직선 몸통
    for (let y = 19; y <= 22; y++)
        for (let x = 7; x <= 25; x++) px(x, y, 255, 255, 255);

    // 아랫 테두리 (더 넓게)
    for (let y = 22; y <= 24; y++)
        for (let x = 4; x <= 28; x++) px(x, y, 255, 255, 255);

    // 추 (클래퍼)
    disc(16, 27.5, 2.5, 255, 255, 255);

    // ── 알림 뱃지: 빨간 점 (우상단) ─────────────────
    if (alertMode) {
        disc(25.5, 6.5, 6.5, 255, 255, 255); // 흰 테두리
        disc(25.5, 6.5, 5.0, 220,  38,  38); // 빨간 채움
    }

    // ── RGBA PNG 인코딩 ──────────────────────────────
    const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
    ihdr[8] = 8; ihdr[9] = 6; // bit depth=8, color type=RGBA

    const raw = Buffer.alloc(S * (1 + S * 4));
    for (let y = 0; y < S; y++) {
        raw[y * (1 + S*4)] = 0;
        for (let x = 0; x < S; x++) {
            const s = (y*S + x) * 4;
            const d = y * (1 + S*4) + 1 + x*4;
            raw[d] = buf[s]; raw[d+1] = buf[s+1]; raw[d+2] = buf[s+2]; raw[d+3] = buf[s+3];
        }
    }

    return Buffer.concat([
        sig,
        pngChunk('IHDR', ihdr),
        pngChunk('IDAT', zlib.deflateSync(raw)),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

function createTrayIcon(hasNotification = false) {
    const key = hasNotification ? 'alert' : 'normal';
    if (!iconCache[key]) {
        iconCache[key] = nativeImage.createFromBuffer(makeIconPNG(hasNotification));
    }
    return iconCache[key];
}

// ============================================
// 상태 변수
// ============================================
let tray             = null;
let loginWin         = null;
let inboxWin         = null;
let notifWin         = null;
let pollTimer        = null;
let isPollRunning    = false;   // 폴링 중복 실행 방지
let accessToken      = null;
let refreshToken     = null;
let lastPollTime     = null;
let unreadCount      = 0;
let unreadNotifications = [];  // 알림함용 메모리 저장 (최대 50개)
let notifQueue       = [];     // 팝업 큐
let notifShowing     = false;
let currentUser      = null;   // 로그인된 사용자 정보

// 트레이 아이콘 캐시 (매번 PNG 재생성 방지)
const iconCache = { normal: null, alert: null };

const config = loadConfig();
// FRONTEND_URL 저장값에서 /api/v1 제거 (구버전 호환)
let API_BASE     = config.apiUrl     || 'http://10.18.10.78:3000/api/v1';
let FRONTEND_URL = (config.frontendUrl || 'http://10.18.10.78:3000').replace(/\/api\/v1\/?$/, '');

function safeUrl(url) {
    return url.startsWith('http') ? url : `http://${url}`;
}

// 매직 링크로 브라우저 열기 (자동 로그인)
async function openInBrowser(relativeUrl) {
    const base = safeUrl(FRONTEND_URL);
    try {
        const res   = await api.post('/auth/desktop/magic-link');
        const token = res.data.data.token;
        const redirect = relativeUrl || '/';
        shell.openExternal(`${base}/auth/magic?token=${token}&redirect=${encodeURIComponent(redirect)}`);
    } catch {
        // 매직 링크 실패 시 일반 URL로 열기
        shell.openExternal(relativeUrl ? `${base}${relativeUrl}` : base);
    }
}

// ============================================
// Axios 클라이언트
// ============================================
const api = axios.create({ timeout: 10000 });

api.interceptors.request.use(cfg => {
    cfg.baseURL = API_BASE;
    if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
    return cfg;
});

api.interceptors.response.use(
    res => res,
    async err => {
        if (err.response?.status === 401 && refreshToken && !err.config._retry) {
            err.config._retry = true;
            try {
                const res = await axios.post(`${API_BASE}/auth/desktop/refresh`, { refreshToken });
                accessToken = res.data.data.accessToken;
                saveConfig({ accessToken });
                err.config.headers.Authorization = `Bearer ${accessToken}`;
                return api(err.config);
            } catch {
                handleLogout();
            }
        }
        return Promise.reject(err);
    }
);

// ============================================
// 단일 인스턴스 보장
// ============================================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (loginWin) loginWin.focus();
        else showInbox();
    });
}

// ============================================
// 로그인 창
// ============================================
function createLoginWindow() {
    if (loginWin) { loginWin.focus(); return; }

    loginWin = new BrowserWindow({
        width: 380,
        height: 520,
        resizable: false,
        center: true,
        frame: true,
        title: '그룹웨어 알림 - 로그인',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    loginWin.loadFile(path.join(__dirname, 'renderer', 'login.html'));
    loginWin.on('closed', () => { loginWin = null; });
}

// ============================================
// 커스텀 알림 팝업
// ============================================
function showCustomToast(notif) {
    notifQueue.push(notif);
    if (!notifShowing) processNotifQueue();
}

function processNotifQueue() {
    if (notifQueue.length === 0) { notifShowing = false; return; }
    notifShowing = true;
    const notif = notifQueue.shift();

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    const W = 368, H = 232, MARGIN = 12;

    if (notifWin && !notifWin.isDestroyed()) {
        notifWin.close();
    }

    notifWin = new BrowserWindow({
        width: W,
        height: H,
        x: width - W - MARGIN,
        y: height - H - MARGIN,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload-notification.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    notifWin.loadFile(path.join(__dirname, 'renderer', 'notification.html'));
    notifWin.once('ready-to-show', () => {
        notifWin.showInactive();
        notifWin.webContents.send('show-notif', {
            title:  notif.title  || '',
            body:   notif.body   || notif.message || '',
            type:   notif.type   || 'post',
            source: notif.source || 'general',
            id:     notif.id,
            url:    notif.url    || notif.link || null
        });
    });

    notifWin.on('closed', () => {
        notifWin = null;
        setTimeout(processNotifQueue, 400);
    });
}

// ============================================
// 알림함 창
// ============================================
function showInbox() {
    if (inboxWin && !inboxWin.isDestroyed()) {
        inboxWin.focus();
        inboxWin.webContents.send('inbox-data', { notifications: unreadNotifications });
        return;
    }

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.workAreaSize;
    const W = 360, H = 480, MARGIN = 12;

    inboxWin = new BrowserWindow({
        width: W,
        height: H,
        x: width - W - MARGIN,
        y: height - H - MARGIN,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload-inbox.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    inboxWin.loadFile(path.join(__dirname, 'renderer', 'inbox.html'));
    inboxWin.once('ready-to-show', () => {
        inboxWin.showInactive();
        inboxWin.webContents.send('inbox-data', { notifications: unreadNotifications });
    });

    inboxWin.on('blur', () => {
        if (inboxWin && !inboxWin.isDestroyed()) inboxWin.close();
    });
    inboxWin.on('closed', () => { inboxWin = null; });
}

// ============================================
// 트레이 설정
// ============================================
function buildTrayMenu() {
    const items = [];

    // ── 로그아웃 상태 메뉴 ──────────────────────
    if (!accessToken) {
        items.push({ label: '그룹웨어 알림', enabled: false });
        items.push({ type: 'separator' });
        items.push({ label: '로그인', click: () => createLoginWindow() });
        items.push({ type: 'separator' });
        items.push({ label: '종료', click: () => app.quit() });
        return Menu.buildFromTemplate(items);
    }

    // ── 로그인 상태 메뉴 ──────────────────────
    const autoLaunch = app.getLoginItemSettings().openAtLogin;

    // 로그인된 사용자 정보
    if (currentUser) {
        const dept = currentUser.department_name ? ` · ${currentUser.department_name}` : '';
        const pos  = currentUser.position        ? ` ${currentUser.position}`          : '';
        items.push({ label: `👤 ${currentUser.name}${pos}${dept}`, enabled: false });
        items.push({ type: 'separator' });
    }

    if (unreadCount > 0) {
        items.push({ label: `📬 새 알림 ${unreadCount}개`, enabled: false });
        items.push({ type: 'separator' });
    }

    items.push({
        label: '그룹웨어 열기',
        click: () => openInBrowser('/')
    });

    if (unreadCount > 0) {
        items.push({
            label: '알림함 보기',
            click: () => showInbox()
        });
        items.push({
            label: '모두 읽음 처리',
            click: async () => {
                try {
                    await api.patch('/notifications/read-all');
                    unreadCount = 0;
                    unreadNotifications = [];
                    tray.setImage(createTrayIcon(false));
                    tray.setToolTip('그룹웨어 알림');
                    buildAndSetTrayMenu();
                    if (inboxWin && !inboxWin.isDestroyed()) {
                        inboxWin.webContents.send('inbox-data', { notifications: [] });
                    }
                } catch {}
            }
        });
    }

    items.push({ type: 'separator' });
    items.push({
        label: `시작 시 자동 실행: ${autoLaunch ? '켜짐' : '꺼짐'}`,
        click: () => {
            app.setLoginItemSettings({ openAtLogin: !autoLaunch });
            buildAndSetTrayMenu();
        }
    });
    items.push({ type: 'separator' });
    items.push({ label: '로그아웃', click: handleLogout });
    items.push({ label: '종료',     click: () => app.quit() });

    return Menu.buildFromTemplate(items);
}

function buildAndSetTrayMenu() {
    if (tray) tray.setContextMenu(buildTrayMenu());
}

function setupTray() {
    if (tray) return;
    tray = new Tray(createTrayIcon(false));
    tray.setToolTip('그룹웨어 알림');
    tray.setContextMenu(buildTrayMenu());

    // 클릭: 로그인 상태면 알림함, 비로그인이면 로그인 창
    tray.on('click', () => {
        if (accessToken) showInbox();
        else createLoginWindow();
    });
}

// ============================================
// 알림 폴링
// ============================================
async function poll() {
    if (!accessToken || isPollRunning) return;
    isPollRunning = true;
    try {
        const since = lastPollTime
            ? lastPollTime.toISOString()
            : new Date(Date.now() - 60 * 1000).toISOString();

        const res = await api.get(`/notifications/unread?since=${since}`);
        const notifications = res.data.data || [];

        lastPollTime = new Date();

        if (notifications.length === 0) return;

        // 메모리에 추가 (중복 제거, 최대 50개 유지)
        for (const n of notifications) {
            const exists = unreadNotifications.some(u => u.source === n.source && u.id === n.id);
            if (!exists) unreadNotifications.unshift(n);
        }
        if (unreadNotifications.length > 50) unreadNotifications = unreadNotifications.slice(0, 50);

        unreadCount += notifications.length;
        tray.setImage(createTrayIcon(true));
        tray.setToolTip(`그룹웨어 알림 (새 알림 ${unreadCount}개)`);
        buildAndSetTrayMenu();

        // 커스텀 팝업 알림
        for (const notif of notifications) {
            showCustomToast(notif);
        }

        // 알림함이 열려 있으면 업데이트
        if (inboxWin && !inboxWin.isDestroyed()) {
            inboxWin.webContents.send('inbox-data', { notifications: unreadNotifications });
        }
    } catch (err) {
        if (err.response?.status === 401) {
            stopPolling();
            handleLogout();
        }
    } finally {
        isPollRunning = false;
    }
}

function startPolling() {
    if (pollTimer) return;
    poll();
    pollTimer = setInterval(poll, 15 * 1000);
}

function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

// ============================================
// 로그아웃
// ============================================
function handleLogout() {
    stopPolling();
    accessToken  = null;
    refreshToken = null;
    lastPollTime = null;
    unreadCount  = 0;
    unreadNotifications = [];
    currentUser  = null;
    saveConfig({ accessToken: null, refreshToken: null });

    if (inboxWin && !inboxWin.isDestroyed()) inboxWin.close();
    if (notifWin && !notifWin.isDestroyed()) notifWin.close();

    // 트레이는 유지 - 아이콘만 초기화하고 메뉴를 로그아웃 상태로 전환
    if (tray) {
        tray.setImage(createTrayIcon(false));
        tray.setToolTip('그룹웨어 알림');
        buildAndSetTrayMenu();
    }

    createLoginWindow();
}

// ============================================
// 현재 사용자 정보 조회
// ============================================
async function fetchCurrentUser() {
    try {
        const res = await api.get('/auth/me');
        currentUser = res.data.data || res.data.user || null;
    } catch {
        currentUser = null;
    }
}

// ============================================
// 자동 로그인
// ============================================
async function tryAutoLogin() {
    const saved = loadConfig();
    if (!saved.refreshToken || !saved.apiUrl) return false;

    API_BASE     = saved.apiUrl;
    FRONTEND_URL = (saved.frontendUrl || FRONTEND_URL).replace(/\/api\/v1\/?$/, '');

    try {
        const res = await axios.post(`${API_BASE}/auth/desktop/refresh`, {
            refreshToken: saved.refreshToken
        });
        accessToken  = res.data.data.accessToken;
        refreshToken = saved.refreshToken;
        saveConfig({ accessToken });
        await fetchCurrentUser();
        return true;
    } catch {
        return false;
    }
}

// ============================================
// IPC 핸들러
// ============================================
ipcMain.handle('login', async (_, username, password, serverUrl) => {
    if (serverUrl) {
        const base   = serverUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
        API_BASE     = base + '/api/v1';
        FRONTEND_URL = base;
        saveConfig({ apiUrl: API_BASE, frontendUrl: FRONTEND_URL });
    }

    try {
        const res = await axios.post(`${API_BASE}/auth/desktop/login`, { username, password });
        accessToken  = res.data.data.accessToken;
        refreshToken = res.data.data.refreshToken;
        saveConfig({ accessToken, refreshToken, apiUrl: API_BASE, frontendUrl: FRONTEND_URL });

        await fetchCurrentUser();
        buildAndSetTrayMenu(); // 로그인 상태 메뉴로 전환 (트레이는 이미 존재)
        startPolling();
        // 성공 피드백 표시 후 창 닫기 (1초 딜레이)
        setTimeout(() => {
            if (loginWin && !loginWin.isDestroyed()) { loginWin.close(); loginWin = null; }
        }, 1000);
        return { success: true };
    } catch (err) {
        return {
            success: false,
            message: err.response?.data?.message || '로그인에 실패했습니다.'
        };
    }
});

// 알림 팝업 닫기
ipcMain.on('notif-close', () => {
    if (notifWin && !notifWin.isDestroyed()) notifWin.close();
});

// 알림 팝업 URL 열기
ipcMain.on('notif-open-url', (_, url) => {
    openInBrowser(url || '/');
});

// 알림함 아이템 클릭
ipcMain.on('inbox-open-item', (_, { source, id, url }) => {
    openInBrowser(url || '/');

    // 해당 알림 메모리에서 제거
    unreadNotifications = unreadNotifications.filter(n => !(n.source === source && n.id === id));
    unreadCount = Math.max(0, unreadCount - 1);

    if (unreadCount === 0) {
        tray.setImage(createTrayIcon(false));
        tray.setToolTip('그룹웨어 알림');
    }
    buildAndSetTrayMenu();

    // 읽음 처리 API
    api.patch('/notifications/read', { source, id }).catch(() => {});

    // 알림함 업데이트
    if (inboxWin && !inboxWin.isDestroyed()) {
        inboxWin.webContents.send('inbox-data', { notifications: unreadNotifications });
    }
});

// 알림함 모두 읽음
ipcMain.on('inbox-read-all', async () => {
    try { await api.patch('/notifications/read-all'); } catch {}
    unreadCount = 0;
    unreadNotifications = [];
    tray.setImage(createTrayIcon(false));
    tray.setToolTip('그룹웨어 알림');
    buildAndSetTrayMenu();
    if (inboxWin && !inboxWin.isDestroyed()) {
        inboxWin.webContents.send('inbox-data', { notifications: [] });
    }
});

// 알림함 닫기
ipcMain.on('inbox-close', () => {
    if (inboxWin && !inboxWin.isDestroyed()) inboxWin.close();
});

// ============================================
// 앱 초기화
// ============================================
app.whenReady().then(async () => {
    app.setAppUserModelId('com.groupware.desktop');

    // 트레이는 항상 먼저 생성 (로그인 여부와 무관)
    setupTray();

    const autoLoggedIn = await tryAutoLogin();

    if (autoLoggedIn) {
        buildAndSetTrayMenu(); // 로그인 상태 메뉴 반영
        startPolling();
    } else {
        buildAndSetTrayMenu(); // 로그아웃 상태 메뉴 반영
        createLoginWindow();
    }
});

app.on('window-all-closed', (e) => {
    if (tray) e.preventDefault();
});

app.on('before-quit', () => {
    stopPolling();
});
