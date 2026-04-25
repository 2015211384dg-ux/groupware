const nodemailer = require('nodemailer');

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

// ── 결재 요청 이메일 (결재자에게) ──────────────────
async function sendApprovalRequest({ to, approverName, drafterName, docTitle, docNumber, docUrl }) {
    await transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME || '그룹웨어'}" <${process.env.SMTP_USER}>`,
        to,
        subject: `[결재요청] ${docTitle}`,
        html: `
        <div style="font-family:'Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e8eb;border-radius:12px">
          <p style="font-size:18px;font-weight:700;color:#191f28;margin:0 0 8px">${docTitle}</p>
          <p style="font-size:13px;color:#8b95a1;margin:0 0 24px">문서번호 ${docNumber || '-'}</p>

          <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:24px;font-size:13px;color:#4e5968;line-height:1.8">
            <b>${approverName}</b>님께 결재 요청이 도착했습니다.<br>
            기안자: <b>${drafterName}</b>
          </div>

          <a href="${docUrl}" style="display:inline-block;background:#3182f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">결재하러 가기</a>

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
