import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/authService';
import { useToast } from '../components/common/Toast';
import './VoucherAI.css';

function VoucherAI() {
    const toast = useToast();
    const fileInputRef = useRef(null);
    const [files,    setFiles]    = useState([]);
    const [rows,     setRows]     = useState([]);
    const [loading,  setLoading]  = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [drag,     setDrag]     = useState(false);

    /* ── 파일 추가 ── */
    const addFiles = (fl) => {
        const valid   = [...fl].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
        const invalid = [...fl].filter(f => !f.type.startsWith('image/') && f.type !== 'application/pdf');
        if (invalid.length) toast.warning('이미지 또는 PDF 파일만 지원합니다.');
        setFiles(prev => {
            const names = new Set(prev.map(x => x.name));
            return [...prev, ...valid.filter(f => !names.has(f.name))];
        });
    };

    const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

    /* ── 분석 ── */
    const analyze = async () => {
        if (!files.length) return;
        setLoading(true);
        setRows([]);
        setErrorMsg('');
        const collected = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                setLoadingMsg(`(${i + 1}/${files.length}) "${f.name}" 분석 중…`);

                const form = new FormData();
                form.append('file', f);

                const res = await api.post('/voucher/analyze', form, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    timeout: 310000,
                });

                if (res.data.success) {
                    collected.push(...res.data.data.map(r => ({ ...r, _file: f.name })));
                }
            }

            if (!collected.length) {
                toast.error('전표 데이터를 추출하지 못했습니다.');
            } else {
                setRows(collected);
                toast.success(`${collected.length}건 추출 완료`);
            }
        } catch (e) {
            const msg = e.response?.data?.message || e.message || '분석 실패';
            setErrorMsg(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
            setLoadingMsg('');
        }
    };

    /* ── 엑셀 다운로드 ── */
    const downloadXLSX = () => {
        if (!rows.length) return;
        const toNum = v => Number(String(v || '').replace(/,/g, '')) || '';
        const data = [
            ['일자', '거래처', '계정과목', '수량', '단가', '공급가액', '세액', '합계금액', '문서유형', '신뢰도', '특이사항', '원본파일'],
            ...rows.map(r => [
                r.date, r.vendor, r.account,
                toNum(r.quantity) || r.quantity || '',
                toNum(r.unit_price) || '',
                toNum(r.supply_amount), toNum(r.tax_amount), toNum(r.total_amount),
                r.doc_type, r.confidence, r.note, r._file
            ])
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [12, 20, 14, 14, 12, 14, 12, 8, 24, 22].map(w => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '전표데이터');
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        XLSX.utils.writeFile(wb, `전표_${today}.xlsx`);
    };

    const reset = () => { setFiles([]); setRows([]); };

    /* ── 숫자 포맷 ── */
    const fmt = v => {
        const n = Number(String(v || '').replace(/,/g, ''));
        return n ? n.toLocaleString('ko-KR') + '원' : '-';
    };

    const totalAmt  = rows.reduce((s, r) => s + (Number(String(r.total_amount  || '').replace(/,/g, '')) || 0), 0);
    const totalTax  = rows.reduce((s, r) => s + (Number(String(r.tax_amount    || '').replace(/,/g, '')) || 0), 0);
    const hiCount   = rows.filter(r => r.confidence === '높음').length;

    return (
        <div className="vai-page">
            <div className="vai-header">
                <h1 className="vai-title">AI 전표 자동화</h1>
                <p className="vai-desc">세금계산서·영수증 이미지를 업로드하면 AI가 전표 데이터를 자동 추출합니다.<br/>추출된 데이터는 엑셀로 다운로드해 ERP에 바로 활용하세요.</p>
            </div>

            <div className="vai-notice">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r=".6" fill="currentColor"/></svg>
                <span>JPG · PNG · PDF 업로드 가능합니다. PDF는 페이지별로 분석합니다. 분석에 30초~2분 소요될 수 있습니다.</span>
            </div>

            {/* 업로드 영역 */}
            <div className="vai-card">
                <div className="vai-card-title">파일 업로드</div>
                <div
                    className={`vai-dropzone ${drag ? 'drag' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                >
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p>클릭하거나 파일을 드래그하세요</p>
                    <span>JPG · PNG · PDF 지원 &nbsp;·&nbsp; 여러 파일 동시 업로드 가능</span>
                </div>

                {files.length > 0 && (
                    <div className="vai-file-list">
                        {files.map((f, i) => (
                            <div key={i} className="vai-file-item">
                                <div className={`vai-file-ext ${f.type === 'application/pdf' ? 'vai-file-ext-pdf' : ''}`}>{f.name.split('.').pop().toUpperCase()}</div>
                                <div className="vai-file-info">
                                    <div className="vai-file-name">{f.name}</div>
                                    <div className="vai-file-size">{(f.size / 1024).toFixed(1)} KB</div>
                                </div>
                                <button className="vai-file-rm" onClick={() => removeFile(i)}>×</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button
                className="vai-btn-primary"
                disabled={files.length === 0 || loading}
                onClick={analyze}
            >
                {loading
                    ? <><span className="vai-spinner"></span>{loadingMsg || '분석 중...'}</>
                    : 'AI 분석 시작'
                }
            </button>

            {errorMsg && (
                <div className="vai-error">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6.5"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r=".6" fill="currentColor"/></svg>
                    {errorMsg}
                </div>
            )}

            {/* 결과 */}
            {rows.length > 0 && (
                <div className="vai-result">
                    {/* 통계 */}
                    <div className="vai-stat-grid">
                        <div className="vai-stat"><div className="vai-stat-label">추출 건수</div><div className="vai-stat-value">{rows.length}건</div></div>
                        <div className="vai-stat"><div className="vai-stat-label">합계금액</div><div className="vai-stat-value vai-stat-sm">{totalAmt.toLocaleString('ko-KR')}원</div></div>
                        <div className="vai-stat"><div className="vai-stat-label">총 세액</div><div className="vai-stat-value vai-stat-sm">{totalTax.toLocaleString('ko-KR')}원</div></div>
                        <div className="vai-stat"><div className="vai-stat-label">높음 신뢰도</div><div className="vai-stat-value vai-stat-green">{hiCount}건</div></div>
                    </div>

                    {/* 테이블 */}
                    <div className="vai-tbl-card">
                        <div className="vai-tbl-wrap">
                            <table className="vai-table">
                                <thead>
                                    <tr>
                                        <th>일자</th><th>거래처</th><th>계정과목</th>
                                        <th>수량</th><th>단가</th>
                                        <th>공급가액</th><th>세액</th><th>합계금액</th>
                                        <th>문서유형</th><th>신뢰도</th><th>특이사항</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, i) => {
                                        const cls = r.confidence === '높음' ? 'badge-ok' : r.confidence === '중간' ? 'badge-warn' : 'badge-low';
                                        return (
                                            <tr key={i}>
                                                <td>{r.date || '-'}</td>
                                                <td className="vai-td-ellipsis" title={r.vendor}>{r.vendor || '-'}</td>
                                                <td>{r.account || '-'}</td>
                                                <td className="vai-td-num">{r.quantity || '-'}</td>
                                                <td className="vai-td-num">{r.unit_price ? Number(String(r.unit_price).replace(/,/g,'')).toLocaleString('ko-KR') + '원' : '-'}</td>
                                                <td className="vai-td-num">{fmt(r.supply_amount)}</td>
                                                <td className="vai-td-num">{fmt(r.tax_amount)}</td>
                                                <td className="vai-td-num">{fmt(r.total_amount)}</td>
                                                <td>{r.doc_type || '-'}</td>
                                                <td><span className={`vai-badge ${cls}`}>{r.confidence || '-'}</span></td>
                                                <td className="vai-td-ellipsis" title={r.note}>{r.note || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="vai-action-row">
                        <button className="vai-btn-dl" onClick={downloadXLSX}>
                            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2 11v2.5A1.5 1.5 0 003.5 15h9A1.5 1.5 0 0014 13.5V11"/><path d="M8 1v9"/><path d="M5 7l3 3 3-3"/></svg>
                            엑셀 다운로드 (.xlsx)
                        </button>
                        <button className="vai-btn-reset" onClick={reset}>초기화</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default VoucherAI;
