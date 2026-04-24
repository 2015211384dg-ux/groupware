const fs = require('fs');

// 파일 매직바이트 기반 실제 형식 검증
// Returns: error message string | null (통과)
async function validateMimeType(filePath, ext) {
    // 텍스트 기반 포맷은 매직바이트 없음 → 확장자 체크만으로 충분
    const skipExts = new Set(['.txt', '.csv', '.log', '.rtf']);
    if (skipExts.has(ext)) return null;

    let fd;
    try {
        fd = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(8);
        const { bytesRead } = await fd.read(buf, 0, 8, 0);
        if (bytesRead < 2) return null;
        const hex = buf.slice(0, bytesRead).toString('hex');

        if (['.jpg', '.jpeg'].includes(ext) && !hex.startsWith('ffd8ff'))
            return '이미지 파일 내용이 확장자와 일치하지 않습니다.';
        if (ext === '.png' && !hex.startsWith('89504e47'))
            return '이미지 파일 내용이 확장자와 일치하지 않습니다.';
        if (ext === '.gif' && !hex.startsWith('47494638'))
            return '이미지 파일 내용이 확장자와 일치하지 않습니다.';
        if (ext === '.webp' && !hex.startsWith('52494646'))
            return '이미지 파일 내용이 확장자와 일치하지 않습니다.';
        if (ext === '.bmp' && !hex.startsWith('424d'))
            return '이미지 파일 내용이 확장자와 일치하지 않습니다.';
        if (ext === '.pdf' && !hex.startsWith('25504446'))
            return 'PDF 파일 내용이 확장자와 일치하지 않습니다.';
        // OOXML (docx/xlsx/pptx) = ZIP 포맷
        if (['.docx', '.xlsx', '.pptx'].includes(ext) && !hex.startsWith('504b'))
            return '오피스 파일 내용이 확장자와 일치하지 않습니다.';
        // 구형 오피스 + HWP = OLE2 복합문서
        if (['.doc', '.xls', '.ppt', '.hwp'].includes(ext) && !hex.startsWith('d0cf11e0'))
            return '오피스 파일 내용이 확장자와 일치하지 않습니다.';
        if (ext === '.zip' && !hex.startsWith('504b'))
            return '압축 파일 내용이 확장자와 일치하지 않습니다.';

        return null;
    } finally {
        if (fd) await fd.close().catch(() => {});
    }
}

module.exports = { validateMimeType };
