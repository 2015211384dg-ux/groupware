import * as XLSX from 'xlsx';

export const CURRENCIES   = { KRW: '₩', USD: '$', EUR: '€', JPY: '¥', CNY: '¥' };
export const CATEGORIES   = ['인건비', '장비/소모품', '출장비', '외주비', '기타'];
export const STATUS_LABEL = { active: '진행중', closed: '완료', on_hold: '보류' };
export const STATUS_CLS   = { active: 'active', closed: 'closed', on_hold: 'hold' };

export function fmt(amount, currency = 'KRW') {
    return `${CURRENCIES[currency] || '₩'} ${Number(amount).toLocaleString()}`;
}

export function fmtDate(d) {
    if (!d) return '-';
    const [y, m, day] = String(d).slice(0, 10).split('-');
    return `${y}. ${m}. ${day}.`;
}

/**
 * AR 프로젝트 Excel 내보내기
 * @param {object} project
 * @param {array}  expenses
 * @param {array}  monthly
 * @param {array}  byCategory
 * @param {object} opts - { includeDept: boolean } ARAdmin은 true, AR은 false(기본)
 */
export function exportXLSX(project, expenses, monthly = [], byCategory = [], opts = {}) {
    const { includeDept = false } = opts;
    const sym    = CURRENCIES[project.currency] || '₩';
    const budget = Number(project.budget_amount);
    const spent  = Number(project.spent_amount);
    const remain = budget - spent;
    const pct    = budget > 0 ? Math.round(spent / budget * 100) : 0;
    const today  = new Date().toISOString().slice(0, 10);

    const burnRate   = monthly.length > 0 ? spent / monthly.length : 0;
    const monthsLeft = burnRate > 0 ? remain / burnRate : null;
    const depletion  = monthsLeft != null ? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + Math.ceil(monthsLeft));
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    })() : '-';

    const byPerson = {};
    expenses.forEach(e => {
        if (!byPerson[e.user_name])
            byPerson[e.user_name] = { name: e.user_name, dept: e.department_name || '', total: 0, count: 0 };
        byPerson[e.user_name].total += Number(e.amount);
        byPerson[e.user_name].count++;
    });

    const wb = XLSX.utils.book_new();

    // Sheet 1: 요약
    const ws1 = XLSX.utils.aoa_to_sheet([
        [`AR 예산 집행 보고서`], [`출력일: ${today}`], [],
        [`[ 프로젝트 정보 ]`],
        [`AR 코드`, project.ar_code, `PM`, project.creator_name],
        [`프로젝트명`, project.title, `상태`, STATUS_LABEL[project.status] || project.status],
        [`통화`, project.currency, `생성일`, project.created_at?.slice(0, 10) || ''],
        [],
        [`[ 예산 현황 ]`],
        [`총 예산 (${sym})`, budget, `집행률`, `${pct}%`],
        [`총 지출 (${sym})`, spent, `잔여 예산 (${sym})`, remain],
        [],
        [`[ 집행 분석 ]`],
        [`월 평균 지출 (Burn Rate)`, burnRate > 0 ? Math.round(burnRate) : '-', `(${sym})`],
        [`잔여 예산 가용 기간`, monthsLeft != null ? `약 ${monthsLeft.toFixed(1)}개월` : '-'],
        [`예산 소진 예상 시점`, depletion],
        [`총 지출 건수`, expenses.length, `건`],
        [],
        [`[ 카테고리별 요약 ]`],
        [`카테고리`, `금액 (${sym})`, `비율`, `건수`],
        ...byCategory.map(b => {
            const cnt = expenses.filter(e => (e.category || '기타') === b.category).length;
            return [b.category, Number(b.total), spent > 0 ? `${Math.round(Number(b.total) / spent * 100)}%` : '0%', cnt];
        }),
    ]);
    ws1['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws1, '요약');

    // Sheet 2: 지출 내역
    let cum = 0;
    const expHeader = includeDept
        ? [`날짜`, `내용`, `카테고리`, `등록자`, `부서`, `금액 (${sym})`, `누적 집행액 (${sym})`]
        : [`날짜`, `내용`, `카테고리`, `등록자`, `금액 (${sym})`, `누적 집행액 (${sym})`];
    const expRows = expenses.map(e => {
        cum += Number(e.amount);
        return includeDept
            ? [e.spent_at?.slice(0, 10) || '', e.description, e.category || '기타', e.user_name, e.department_name || '', Number(e.amount), cum]
            : [e.spent_at?.slice(0, 10) || '', e.description, e.category || '기타', e.user_name, Number(e.amount), cum];
    });
    const expFooter = includeDept
        ? [``, ``, ``, ``, `합계`, spent, ``]
        : [``, ``, ``, `합계`, spent, ``];
    const ws2 = XLSX.utils.aoa_to_sheet([expHeader, ...expRows, [], expFooter]);
    ws2['!cols'] = includeDept
        ? [{ wch: 12 }, { wch: 34 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 18 }, { wch: 20 }]
        : [{ wch: 12 }, { wch: 34 }, { wch: 13 }, { wch: 12 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, '지출 내역');

    // Sheet 3: 카테고리 분석
    let cumMon = 0;
    const ws3 = XLSX.utils.aoa_to_sheet([
        [`카테고리`, `금액 (${sym})`, `비율`, `건수`],
        ...byCategory.map(b => {
            const cnt = expenses.filter(e => (e.category || '기타') === b.category).length;
            return [b.category, Number(b.total), spent > 0 ? `${Math.round(Number(b.total) / spent * 100)}%` : '0%', cnt];
        }),
        [], [`합계`, spent, `100%`, expenses.length],
    ]);
    ws3['!cols'] = [{ wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws3, '카테고리 분석');

    // Sheet 4: 월별 추이
    const ws4 = XLSX.utils.aoa_to_sheet([
        [`월`, `지출액 (${sym})`, `누적 집행액 (${sym})`, `예산 대비 누적 %`],
        ...monthly.map(m => {
            cumMon += Number(m.total);
            return [m.month, Number(m.total), cumMon, budget > 0 ? `${Math.round(cumMon / budget * 100)}%` : '0%'];
        }),
        [],
        [`월 평균 (Burn Rate)`, burnRate > 0 ? Math.round(burnRate) : '-', ``, ``],
        [`잔여 가용 기간`, monthsLeft != null ? `${monthsLeft.toFixed(1)}개월` : '-', ``, ``],
        [`소진 예상 시점`, depletion, ``, ``],
    ]);
    ws4['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws4, '월별 추이');

    // Sheet 5: 팀원별 현황
    const personRows = Object.values(byPerson).sort((a, b) => b.total - a.total);
    const ws5 = XLSX.utils.aoa_to_sheet([
        [`이름`, `부서`, `지출액 (${sym})`, `비율`, `건수`],
        ...personRows.map(p => [p.name, p.dept, p.total, spent > 0 ? `${Math.round(p.total / spent * 100)}%` : '0%', p.count]),
        [], [`합계`, ``, spent, `100%`, expenses.length],
    ]);
    ws5['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws5, '팀원별 현황');

    XLSX.writeFile(wb, `AR_${project.ar_code}_${today}.xlsx`);
}
