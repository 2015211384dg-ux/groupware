// 흰 배경 + 하늘색 A 아이콘 생성 (ICO: 16x16, 32x32, 48x48, 256x256)
const fs   = require('fs');
const zlib = require('zlib');

function crc32(buf) {
    if (!crc32.t) {
        crc32.t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            crc32.t[i] = c;
        }
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = crc32.t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return ((c ^ 0xFFFFFFFF) >>> 0);
}
function chunk(type, data) {
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const t = Buffer.from(type, 'ascii');
    const cv = crc32(Buffer.concat([t, data]));
    const cb = Buffer.alloc(4); cb.writeUInt32BE(cv);
    return Buffer.concat([l, t, data, cb]);
}

// RGBA PNG 생성
function makePNG(size, drawFn) {
    const buf = new Uint8Array(size * size * 4); // RGBA

    function px(x, y, r, g, b, a = 255) {
        if (x < 0 || x >= size || y < 0 || y >= size) return;
        const i = (y * size + x) * 4;
        buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
    }
    function fillRect(x0, y0, x1, y1, r, g, b, a = 255) {
        for (let y = y0; y <= y1; y++)
            for (let x = x0; x <= x1; x++) px(x, y, r, g, b, a);
    }
    function disc(cx, cy, radius, r, g, b, a = 255) {
        for (let y = Math.ceil(cy - radius); y <= Math.floor(cy + radius); y++)
            for (let x = Math.ceil(cx - radius); x <= Math.floor(cx + radius); x++)
                if ((x-cx)**2 + (y-cy)**2 <= radius**2) px(x, y, r, g, b, a);
    }

    drawFn(size, px, fillRect, disc);

    const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; ihdr[9] = 6; // RGBA

    const raw = Buffer.alloc(size * (1 + size * 4));
    for (let y = 0; y < size; y++) {
        raw[y * (1 + size*4)] = 0;
        for (let x = 0; x < size; x++) {
            const s = (y*size + x) * 4;
            const d = y * (1 + size*4) + 1 + x*4;
            raw[d] = buf[s]; raw[d+1] = buf[s+1]; raw[d+2] = buf[s+2]; raw[d+3] = buf[s+3];
        }
    }
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// 아이콘 그리기: 흰 배경 + 하늘색 A
function drawIcon(S, px, fillRect, disc) {
    const SKY = [100, 199, 255]; // 하늘색 #64C7FF

    // 흰 배경 (둥근 사각형)
    const cr = Math.round(S * 0.18); // 코너 반경
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const dx = Math.max(0, cr - x, x - (S - 1 - cr));
            const dy = Math.max(0, cr - y, y - (S - 1 - cr));
            if (dx*dx + dy*dy <= cr*cr) {
                px(x, y, 255, 255, 255, 255); // 흰색
            }
        }
    }

    // 하늘색 "A" 그리기 (비율 기반)
    const [r, g, b] = SKY;
    const pad  = Math.round(S * 0.12);
    const top  = Math.round(S * 0.10);
    const bot  = Math.round(S * 0.88);
    const left = pad;
    const right = S - pad;
    const midX = S / 2;
    const thick = Math.max(2, Math.round(S * 0.11)); // 획 두께

    // 왼쪽 사선
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const cx = left + (midX - left) * t;
        const cy = bot - (bot - top) * t;
        for (let tx = -thick; tx <= thick; tx++)
            for (let ty = -thick; ty <= thick; ty++)
                if (tx*tx + ty*ty <= thick*thick)
                    px(Math.round(cx + tx), Math.round(cy + ty), r, g, b);
    }
    // 오른쪽 사선
    for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const cx = right - (right - midX) * t;
        const cy = bot - (bot - top) * t;
        for (let tx = -thick; tx <= thick; tx++)
            for (let ty = -thick; ty <= thick; ty++)
                if (tx*tx + ty*ty <= thick*thick)
                    px(Math.round(cx + tx), Math.round(cy + ty), r, g, b);
    }
    // 가로 획 (중간)
    const crossY = Math.round(top + (bot - top) * 0.55);
    const crossL = Math.round(left + (midX - left) * 0.38);
    const crossR = Math.round(right - (right - midX) * 0.38);
    for (let x = crossL; x <= crossR; x++)
        for (let ty = -thick + 1; ty <= thick - 1; ty++)
            px(x, crossY + ty, r, g, b);
}

// 각 크기별 PNG 생성
const sizes = [16, 32, 48, 256];
const pngs  = sizes.map(s => makePNG(s, drawIcon));

// ICO 파일 포맷 (PNG-in-ICO)
const count  = sizes.length;
const dirSize = 6 + count * 16;
let offset = dirSize;

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type=icon
header.writeUInt16LE(count, 4);

const dirs = sizes.map((s, i) => {
    const d = Buffer.alloc(16);
    d[0] = s === 256 ? 0 : s; // width (0 = 256)
    d[1] = s === 256 ? 0 : s; // height
    d[2] = 0;  // color count
    d[3] = 0;  // reserved
    d.writeUInt16LE(1, 4);    // planes
    d.writeUInt16LE(32, 6);   // bit count
    d.writeUInt32LE(pngs[i].length, 8);
    d.writeUInt32LE(offset, 12);
    offset += pngs[i].length;
    return d;
});

const ico = Buffer.concat([header, ...dirs, ...pngs]);
fs.writeFileSync('build/icon.ico', ico);
console.log('build/icon.ico 생성 완료 (' + ico.length + ' bytes)');
