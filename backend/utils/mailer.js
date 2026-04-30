const nodemailer = require('nodemailer');

const b64 = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const ICON_REQUEST = b64(`<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#3182f6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`);
const ICON_APPROVED = b64(`<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2cb967" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>`);
const ICON_REJECTED = b64(`<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#f04452" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`);

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
});

const REQUEST_LABEL = {
    APPROVAL:  { subject: '결재요청', body: '결재 요청이 도착했습니다.', btn: '결재하러 가기' },
    AGREEMENT: { subject: '합의요청', body: '합의 요청이 도착했습니다.', btn: '합의하러 가기' },
    REFERENCE: { subject: '참조요청', body: '참조 문서가 도착했습니다.', btn: '문서 확인하기' },
};

// ── 결재 요청 이메일 (결재자에게) ──────────────────
async function sendApprovalRequest({ to, approverName, drafterName, docTitle, docNumber, docUrl, lineType }) {
    const lbl = REQUEST_LABEL[lineType] || REQUEST_LABEL.APPROVAL;
    await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || '그룹웨어'}" <${process.env.SMTP_USER}>`,
        to,
        subject: `[${lbl.subject}] ${docTitle}`,
        html: `
        <div style="font-family:'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e8eb;border-radius:12px">
          <img src="${ICON_REQUEST}" width="44" height="44" alt="" style="display:block;margin-bottom:14px"/>
          <p style="font-size:18px;font-weight:700;color:#191f28;margin:0 0 8px">${docTitle}</p>
          <p style="font-size:13px;color:#8b95a1;margin:0 0 24px">문서번호 ${docNumber || '-'}</p>

          <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#4e5968;line-height:1.8">
            <b>${approverName}</b>님께 ${lbl.body}<br>
            기안자: <b>${drafterName}</b>
          </div>

          <a href="${docUrl}" style="display:inline-block;background:#3182f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">${lbl.btn}</a>

          <p style="font-size:11px;color:#8b95a1;margin-top:28px">본 메일은 그룹웨어 결재 시스템에서 자동 발송되었습니다.</p>
        </div>`,
    });
}

// ── 최종 승인 이메일 (기안자에게) ──────────────────
async function sendApprovalComplete({ to, drafterName, docTitle, docNumber, docUrl }) {
    await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || '그룹웨어'}" <${process.env.SMTP_USER}>`,
        to,
        subject: `[결재완료] ${docTitle}`,
        html: `
        <div style="font-family:'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e8eb;border-radius:12px">
          <img src="${ICON_APPROVED}" width="44" height="44" alt="" style="display:block;margin-bottom:14px"/>
          <p style="font-size:18px;font-weight:700;color:#191f28;margin:0 0 8px">${docTitle}</p>
          <p style="font-size:13px;color:#8b95a1;margin:0 0 24px">문서번호 ${docNumber || '-'}</p>

          <div style="background:#e8faf0;border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#1a7a40;line-height:1.8">
            <b>${drafterName}</b>님이 기안하신 문서가 <b>최종 승인</b>되었습니다.
          </div>

          <a href="${docUrl}" style="display:inline-block;background:#2cb967;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">문서 확인하기</a>

          <p style="font-size:11px;color:#8b95a1;margin-top:28px">본 메일은 그룹웨어 결재 시스템에서 자동 발송되었습니다.</p>
        </div>`,
    });
}

// ── 반려 이메일 (기안자에게) ───────────────────────
async function sendApprovalRejected({ to, drafterName, docTitle, docNumber, rejectorName, comment, docUrl }) {
    await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || '그룹웨어'}" <${process.env.SMTP_USER}>`,
        to,
        subject: `[결재반려] ${docTitle}`,
        html: `
        <div style="font-family:'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e8eb;border-radius:12px">
          <img src="${ICON_REJECTED}" width="44" height="44" alt="" style="display:block;margin-bottom:14px"/>
          <p style="font-size:18px;font-weight:700;color:#191f28;margin:0 0 8px">${docTitle}</p>
          <p style="font-size:13px;color:#8b95a1;margin:0 0 24px">문서번호 ${docNumber || '-'}</p>

          <div style="background:#fff0f0;border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#c41c1c;line-height:1.8">
            <b>${drafterName}</b>님이 기안하신 문서가 <b>반려</b>되었습니다.<br>
            반려자: <b>${rejectorName}</b>
            ${comment ? `<br>사유: ${comment}` : ''}
          </div>

          <a href="${docUrl}" style="display:inline-block;background:#f04452;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">문서 확인하기</a>

          <p style="font-size:11px;color:#8b95a1;margin-top:28px">본 메일은 그룹웨어 결재 시스템에서 자동 발송되었습니다.</p>
        </div>`,
    });
}

// ── SMTP 연결 테스트 ──────────────────────────────
async function verifyConnection() {
    try {
        await transporter.verify();
        console.log('✅ 메일 서버 연결 성공 (Office365)');
    } catch (err) {
        console.error('❌ 메일 서버 연결 실패:', err.message);
    }
}

module.exports = { sendApprovalRequest, sendApprovalComplete, sendApprovalRejected, verifyConnection };
