const express  = require('express');
const router   = express.Router();
const { authMiddleware } = require('../middleware/auth');
const multer   = require('multer');
const path     = require('path');
const { createCanvas, Image } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

if (typeof global.Image === 'undefined') global.Image = Image;
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');

const CMAP_URL = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'cmaps/');

router.use(authMiddleware);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 30 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
        ok ? cb(null, true) : cb(new Error('이미지 또는 PDF 파일만 지원합니다.'));
    }
});

// PDF → 페이지별 텍스트 추출 (이미지 렌더링 없이)
async function pdfToTextPages(buffer) {
    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        cMapUrl: CMAP_URL,
        cMapPacked: true,
        useSystemFonts: true,
        disableFontFace: true,
    }).promise;

    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        const text    = content.items.map(item => item.str).join(' ').trim();
        if (text) pages.push(text);
    }
    return pages;
}

// PDF → 페이지별 이미지 (텍스트 추출 실패 시 폴백)
class NodeCanvasFactory {
    create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
    reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
    destroy(cc)     { cc.canvas.width = 0; cc.canvas.height = 0; }
}

async function pdfToBase64Images(buffer) {
    const factory = new NodeCanvasFactory();
    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        canvasFactory: factory,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
        useSystemFonts: true,
        disableFontFace: false,
    }).promise;

    const sharp = require('sharp');
    const images = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page     = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const cc       = factory.create(viewport.width, viewport.height);
        await page.render({ canvasContext: cc.context, viewport }).promise;

        const rawBuf  = cc.canvas.toBuffer('image/jpeg', { quality: 0.95 });
        const jpegBuf = await sharp(rawBuf)
            .resize({ width: 1400, withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        images.push(jpegBuf.toString('base64'));
        factory.destroy(cc);
    }
    return images;
}

const TEXT_PROMPT = (text) => `당신은 한국 세금계산서·영수증·거래명세서 전문 데이터 추출 AI입니다.
아래 PDF 텍스트에서 전표 데이터를 추출하세요.

규칙:
1. 반드시 JSON 배열만 출력. 마크다운 코드블록·설명 텍스트 절대 금지.
2. 데이터가 일부만 있어도 보이는 것으로 항목을 만드세요.
3. 읽기 어려운 값은 빈 문자열("")로 처리하세요.

각 항목 필드:
- date: 작성일자 (YYYY-MM-DD)
- vendor: 공급자·판매처 상호명
- account: 계정과목 (매입비용/복리후생비/접대비/소모품비/운반비/수수료/광고비 등 내용으로 판단)
- quantity: 수량 (숫자만, 없으면 "")
- unit_price: 단가 (숫자만, 쉼표 없이, 없으면 "")
- supply_amount: 공급가액 (숫자만, 쉼표 없이)
- tax_amount: 세액 (숫자만, 쉼표 없이)
- total_amount: 합계금액 (숫자만, 쉼표 없이)
- doc_type: "세금계산서" 또는 "영수증" 또는 "거래명세서"
- confidence: "높음" / "중간" / "낮음"
- note: 특이사항 (없으면 "")

PDF 텍스트:
${text}

JSON 배열만 출력하세요:`;

const IMAGE_PROMPT = `당신은 한국 세금계산서·영수증·거래명세서 전문 OCR AI입니다.
이미지에서 전표 데이터를 추출하세요.

규칙:
1. 반드시 JSON 배열만 출력. 마크다운 코드블록·설명 텍스트 절대 금지.
2. 데이터가 일부만 보여도 보이는 것으로 항목을 만드세요.
3. 읽기 어려운 값은 빈 문자열("")로 처리하세요.

각 항목 필드:
- date: 작성일자 (YYYY-MM-DD)
- vendor: 공급자·판매처 상호명
- account: 계정과목 (매입비용/복리후생비/접대비/소모품비/운반비/수수료/광고비 등 내용으로 판단)
- quantity: 수량 (숫자만, 없으면 "")
- unit_price: 단가 (숫자만, 쉼표 없이, 없으면 "")
- supply_amount: 공급가액 (숫자만, 쉼표 없이)
- tax_amount: 세액 (숫자만, 쉼표 없이)
- total_amount: 합계금액 (숫자만, 쉼표 없이)
- doc_type: "세금계산서" 또는 "영수증" 또는 "거래명세서"
- confidence: "높음" / "중간" / "낮음"
- note: 특이사항 (없으면 "")

JSON 배열만 출력하세요:`;

function parseJson(raw) {
    try { return JSON.parse(raw.replace(/```json\n?|```\n?/g, '').trim()); }
    catch {
        const m = raw.match(/\[[\s\S]*\]/);
        if (m) try { return JSON.parse(m[0]); } catch {}
    }
    return [];
}

async function analyzeText(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
        const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: 'gemma4:e4b',
                messages: [{ role: 'user', content: TEXT_PROMPT(text) }],
                stream: false,
                options: { num_ctx: 8192 }
            })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error('[voucher] Ollama error:', body.slice(0, 200));
            throw new Error(`Ollama 오류: ${res.status}`);
        }
        const raw = ((await res.json()).message?.content || '').trim();
        console.log('[voucher text raw]', raw.slice(0, 500));
        const parsed = parseJson(raw);
        return Array.isArray(parsed) ? parsed : [];
    } finally {
        clearTimeout(timer);
    }
}

async function analyzeImage(b64) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300000);
    try {
        const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: 'gemma4:e4b',
                messages: [{ role: 'user', content: IMAGE_PROMPT, images: [b64] }],
                stream: false,
                options: { num_ctx: 8192 }
            })
        });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error('[voucher] Ollama error:', body.slice(0, 200));
            throw new Error(`Ollama 오류: ${res.status}`);
        }
        const raw = ((await res.json()).message?.content || '').trim();
        console.log('[voucher image raw]', raw.slice(0, 500));
        const parsed = parseJson(raw);
        return Array.isArray(parsed) ? parsed : [];
    } finally {
        clearTimeout(timer);
    }
}

router.post('/analyze', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: '파일이 없습니다.' });

    const isPdf = req.file.mimetype === 'application/pdf';

    try {
        let allRows = [];

        if (isPdf) {
            // 1차: 텍스트 추출 시도
            const textPages = await pdfToTextPages(req.file.buffer);
            console.log('[voucher] PDF 텍스트 추출:', textPages.length, '페이지, 총', textPages.join(' ').length, '자');

            if (textPages.length && textPages.join('').length > 20) {
                // 텍스트가 충분히 있으면 텍스트 모드로 분석
                for (const text of textPages) {
                    allRows.push(...await analyzeText(text));
                }
            } else {
                // 텍스트 추출 실패 → 이미지 렌더링 폴백
                console.log('[voucher] 텍스트 추출 실패, 이미지 렌더링 폴백');
                const b64Images = await pdfToBase64Images(req.file.buffer);
                for (const b64 of b64Images) {
                    allRows.push(...await analyzeImage(b64));
                }
            }
        } else {
            // 이미지 파일
            allRows.push(...await analyzeImage(req.file.buffer.toString('base64')));
        }

        // 핵심 필드 없는 행 제거
        const rawValid = allRows.filter(r => r.vendor || r.total_amount || r.supply_amount || r.date);

        // 세금계산서 후처리: 모델이 놓친 세액/공급가액 보정
        const validRows = rawValid.map(r => {
            const n = v => Number(String(v || '').replace(/,/g, '')) || 0;
            let supply = n(r.supply_amount);
            let tax    = n(r.tax_amount);
            let total  = n(r.total_amount);

            if (r.doc_type === '세금계산서' || (!r.doc_type && total > 0)) {
                // 세액 누락 → 합계 - 공급가액으로 계산
                if (!tax && supply && total && total > supply) {
                    tax = total - supply;
                }
                // 세액 누락 & 공급가액=합계 → 합계가 실제로는 공급가액 (세액 10%)
                if (!tax && supply && total && supply === total) {
                    tax    = Math.round(supply * 0.1);
                    total  = supply + tax;
                }
                // 공급가액 누락 → 합계 - 세액
                if (!supply && tax && total) {
                    supply = total - tax;
                }
            }

            return {
                ...r,
                supply_amount: supply || r.supply_amount,
                tax_amount:    tax    || r.tax_amount,
                total_amount:  total  || r.total_amount,
            };
        });

        if (!validRows.length) {
            return res.status(422).json({
                success: false,
                message: '전표 데이터를 추출하지 못했습니다. 실제 거래 데이터가 기재된 세금계산서·영수증을 업로드해주세요.'
            });
        }

        res.json({ success: true, data: validRows, filename: req.file.originalname });
    } catch (err) {
        if (err.name === 'AbortError') return res.status(504).json({ success: false, message: 'AI 분석 시간이 초과됐습니다.' });
        console.error('[voucher]', err.message);
        res.status(500).json({ success: false, message: err.message || '분석 실패' });
    }
});

module.exports = router;
