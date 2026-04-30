// ============================================
// utils/teamsNotifier.js  ─ Microsoft Teams 알림 (Power Automate Workflow Webhook)
// ============================================
// Adaptive Card + @멘션 — "채널에 웹후크 알림 보내기" 템플릿용
// .env 에 TEAMS_WEBHOOK_URL 설정 필요. 미설정 시 조용히 skip.
const { logActivity } = require('./logger');

const COLOR = {
    REQUEST:  'Accent',     // 파랑 — 결재요청
    APPROVED: 'Good',       // 초록 — 최종승인
    REJECTED: 'Attention',  // 빨강 — 반려
};

// REQUEST 헤더는 라인 타입(APPROVAL/AGREEMENT/REFERENCE)에 따라 분기
const HEADER = {
    REQUEST: {
        APPROVAL:  '결재 요청',
        AGREEMENT: '합의 요청',
        REFERENCE: '참조 요청',
    },
    APPROVED: '결재 완료',
    REJECTED: '결재 반려',
};
const TITLE_PREFIX = {
    APPROVAL:  '[결재요청]',
    AGREEMENT: '[합의요청]',
    REFERENCE: '[참조요청]',
};

// M365 멘션 가능한 회사 도메인
const MENTION_DOMAIN = '@amphenol-sensors.com';
const COMPANY_SUFFIX = 'Amphenol-AS';
const isMentionable = (email) => typeof email === 'string' && email.toLowerCase().endsWith(MENTION_DOMAIN);

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

// 영어 이름 여부 판별 — 해당 시 하이픈 분리 생략
// 판별 기준: 영어 전용 알파벳(f, q, v, x, z), 영어 digraph(th, sh, ph, ch, wh),
// 또는 흔한 영어 이름 목록 매칭
const ENGLISH_DIGRAPHS = ['th', 'sh', 'ph', 'ch', 'wh'];
const ENGLISH_NAMES = new Set([
    'michael', 'david', 'daniel', 'james', 'robert', 'william', 'joseph', 'charles',
    'thomas', 'richard', 'christopher', 'matthew', 'andrew', 'joshua', 'kevin',
    'brian', 'steven', 'edward', 'jason', 'jeffrey', 'ryan', 'jacob', 'nicholas',
    'eric', 'mark', 'peter', 'donald', 'paul', 'george', 'kenneth',
    'sarah', 'jessica', 'ashley', 'emily', 'rachel', 'samantha', 'amanda',
    'stephanie', 'jennifer', 'elizabeth', 'laura', 'helen', 'karen', 'diana',
    'john', 'scott', 'frank', 'phillip', 'phillip', 'phillip',
    'victor', 'vincent', 'felix', 'alex', 'max', 'xavier',
]);
function isEnglishName(name) {
    const lower = name.toLowerCase();
    if (ENGLISH_NAMES.has(lower)) return true;
    if (/[fqvxz]/.test(lower)) return true;
    if (ENGLISH_DIGRAPHS.some(d => lower.includes(d))) return true;
    return false;
}

// 한국어 로마자 이름을 두 음절로 분리해 하이픈 표기.
// 예: songgyun → Song-Gyun, minjun → Min-Jun, jiyoung → Ji-Young
// 영어 이름으로 판별되면 하이픈 없이 Cap만 적용.
function hyphenateKoreanName(name) {
    if (!name) return '';
    if (isEnglishName(name)) return cap(name);

    const lower = name.toLowerCase();
    const isVowel = (c) => 'aeiou'.includes(c);

    // 모음 클러스터(연속된 모음들) 위치 수집
    const clusters = [];
    let i = 0;
    while (i < lower.length) {
        if (isVowel(lower[i])) {
            const start = i;
            while (i < lower.length && isVowel(lower[i])) i++;
            clusters.push({ start, end: i - 1 });
        } else {
            i++;
        }
    }
    if (clusters.length < 2) return cap(name); // 한 음절 — 분리 불가

    // 첫·둘째 모음 클러스터 사이 자음 개수만큼 절반 지점에서 분리
    const firstEnd = clusters[0].end;
    const secondStart = clusters[1].start;
    const consCount = secondStart - firstEnd - 1;
    const splitAt = firstEnd + 1 + Math.floor(consCount / 2);
    if (splitAt <= 0 || splitAt >= name.length) return cap(name);
    return cap(name.substring(0, splitAt)) + '-' + cap(name.substring(splitAt));
}

// 사내 이메일 → M365 표시명 자동 생성
// songgyun.noh@amphenol-sensors.com → "Noh, Song-Gyun (Amphenol-AS)"
function emailToM365DisplayName(email) {
    if (!isMentionable(email)) return null;
    const prefix = email.toLowerCase().split('@')[0];
    const parts = prefix.split('.');
    if (parts.length < 2) return null;
    const [given, family] = parts;
    if (!given || !family) return null;
    return `${cap(family)}, ${hyphenateKoreanName(given)} (${COMPANY_SUFFIX})`;
}

/**
 * Teams 채널에 Adaptive Card 발송 (fire-and-forget)
 * @param {Object} opts
 * @param {'REQUEST'|'APPROVED'|'REJECTED'} opts.kind
 * @param {'APPROVAL'|'AGREEMENT'|'REFERENCE'} [opts.lineType]  결재선 라인 타입 (REQUEST일 때만 의미)
 * @param {string} opts.title              본문 제목 (Prefix는 lineType에 따라 자동)
 * @param {string} [opts.drafterName]
 * @param {string} [opts.approverName]
 * @param {string} [opts.rejectorName]
 * @param {string} [opts.docNumber]
 * @param {string} [opts.docUrl]
 * @param {string} [opts.comment]
 * @param {string} [opts.mentionEmail]      @멘션 대상 이메일 (M365)
 * @param {string} [opts.mentionDisplayName] 표시명 override (관리자 설정값) — 우선 사용. 없으면 이메일에서 자동 생성
 */
async function sendTeamsCard(opts) {
    const url = process.env.TEAMS_WEBHOOK_URL;
    if (!url) return;

    const { kind, lineType, title, drafterName, approverName, rejectorName, docNumber, docUrl, comment, mentionEmail, mentionDisplayName } = opts;

    // 헤더 텍스트 결정
    const lt = lineType || 'APPROVAL';
    const headerText = kind === 'REQUEST'
        ? (HEADER.REQUEST[lt] || HEADER.REQUEST.APPROVAL)
        : (HEADER[kind] || '📬 알림');
    // 제목 Prefix (REQUEST일 때만 라인타입 적용)
    const titlePrefix = kind === 'REQUEST' ? (TITLE_PREFIX[lt] || TITLE_PREFIX.APPROVAL) : '';
    const titleText = titlePrefix && !title.startsWith('[') ? `${titlePrefix} ${title}` : title;

    const facts = [];
    if (docNumber)    facts.push({ title: '문서번호', value: docNumber });
    if (drafterName)  facts.push({ title: '기안자',  value: drafterName });
    if (approverName) {
        const role = kind === 'REQUEST'
            ? (lt === 'AGREEMENT' ? '합의자' : lt === 'REFERENCE' ? '참조자' : '결재자')
            : '결재자';
        facts.push({ title: role, value: approverName });
    }
    if (rejectorName) facts.push({ title: '반려자',  value: rejectorName });
    if (comment)      facts.push({ title: '사유',    value: comment });

    // @멘션 처리: 관리자 override 우선 → 없으면 이메일 자동 변환
    const entities = [];
    let mentionLine = null;
    let displayName = null;
    if (isMentionable(mentionEmail)) {
        displayName = mentionDisplayName || emailToM365DisplayName(mentionEmail);
    }
    if (displayName) {
        const atTag = `<at>${displayName}</at>`;
        const verb = lt === 'REFERENCE' ? '확인 부탁드립니다.'
                   : lt === 'AGREEMENT' ? '의견 부탁드립니다.'
                   : '결재 부탁드립니다.';
        mentionLine = kind === 'REQUEST' ? `${atTag} 님, ${verb}` : `${atTag} 님, 확인 부탁드립니다.`;
        entities.push({
            type: 'mention',
            text: atTag,
            mentioned: { id: mentionEmail, name: displayName },
        });
    }

    const body = [
        {
            type: 'TextBlock',
            text: headerText,
            weight: 'Bolder',
            size: 'Medium',
            color: COLOR[kind] || 'Accent',
        },
        {
            type: 'TextBlock',
            text: titleText,
            weight: 'Bolder',
            size: 'Large',
            wrap: true,
            spacing: 'Small',
        },
    ];
    if (mentionLine) {
        body.push({
            type: 'TextBlock',
            text: mentionLine,
            wrap: true,
            spacing: 'Small',
            isSubtle: false,
        });
    }
    if (facts.length) {
        body.push({ type: 'FactSet', facts });
    }

    const actions = [];
    if (docUrl) {
        actions.push({ type: 'Action.OpenUrl', title: '문서 열기', url: docUrl });
    }

    const adaptiveCard = {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body,
        actions,
        msteams: {
            width: 'Full',
            ...(entities.length ? { entities } : {}),
        },
    };

    const payload = {
        type: 'message',
        attachments: [
            {
                contentType: 'application/vnd.microsoft.card.adaptive',
                contentUrl: null,
                content: adaptiveCard,
            },
        ],
    };

    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            logActivity('error', `Teams 알림 실패: ${res.status} ${text.slice(0, 200)}`);
        }
    } catch (err) {
        logActivity('error', `Teams 알림 예외: ${err.message}`);
    }
}

module.exports = { sendTeamsCard };
