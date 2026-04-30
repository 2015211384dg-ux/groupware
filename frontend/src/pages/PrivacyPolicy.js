import React from 'react';
import { Link } from 'react-router-dom';
import './PrivacyPolicy.css';

function PrivacyPolicy() {
    return (
        <div className="privacy-policy-container">
            <div className="privacy-policy-content">
                <header className="privacy-header">
                    <h1>개인정보 처리방침</h1>
                    <div className="privacy-meta">
                        <span>버전 1.0</span>
                        <span>·</span>
                        <span>시행일 2026-04-29</span>
                    </div>
                </header>

                <section className="privacy-intro">
                    <p>
                        <strong>암페놀센싱코리아</strong>(이하 "회사")는 임직원의 자유와 권리 보호를 위해
                        「개인정보 보호법」 및 관계 법령이 정한 바를 준수하여, 적법하게 개인정보를 처리하고
                        안전하게 관리하고 있습니다. 이에 「개인정보 보호법」 제30조에 따라 정보주체에게
                        개인정보의 처리와 보호에 관한 절차 및 기준을 안내하고, 이와 관련한 고충을 신속하고
                        원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.
                    </p>
                    <div className="privacy-notice">
                        본 처리방침은 사내 그룹웨어 시스템에 한하여 적용되며, 회사 전반의 임직원 개인정보
                        처리정책과는 별도로 운영됩니다.
                    </div>
                </section>

                <nav className="privacy-toc">
                    <h2>목차</h2>
                    <ol>
                        <li><a href="#sec-1">개인정보의 처리 목적</a></li>
                        <li><a href="#sec-2">처리하는 개인정보의 항목</a></li>
                        <li><a href="#sec-3">개인정보의 처리 및 보유 기간</a></li>
                        <li><a href="#sec-4">개인정보의 파기 절차 및 방법</a></li>
                        <li><a href="#sec-5">개인정보의 제3자 제공</a></li>
                        <li><a href="#sec-6">개인정보 처리업무의 위탁</a></li>
                        <li><a href="#sec-7">개인정보의 국외 이전</a></li>
                        <li><a href="#sec-8">개인정보의 안전성 확보조치</a></li>
                        <li><a href="#sec-9">자동 수집 장치의 설치·운영 및 거부</a></li>
                        <li><a href="#sec-10">정보주체의 권리·의무 및 행사방법</a></li>
                        <li><a href="#sec-11">자동화된 결정에 관한 사항</a></li>
                        <li><a href="#sec-12">개인정보 보호책임자</a></li>
                        <li><a href="#sec-13">권익침해 구제방법</a></li>
                        <li><a href="#sec-14">처리방침의 변경</a></li>
                    </ol>
                </nav>

                <section id="sec-1" className="privacy-section">
                    <h2>1. 개인정보의 처리 목적</h2>
                    <p>
                        회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의
                        목적 외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」
                        제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.
                    </p>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>구분</th><th>처리 목적</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>계정 관리</td><td>회원가입 의사 확인, 본인 식별·인증, 회원자격 유지·관리, 부정이용 방지</td></tr>
                            <tr><td>인사·근태</td><td>직원 정보 조회·관리, 부서 배치, 조직도 운영</td></tr>
                            <tr><td>협업 도구</td><td>게시판, 캘린더, 주소록, 프로젝트 관리 서비스 제공</td></tr>
                            <tr><td>전자결재</td><td>결재 문서 작성·승인·반려, 결재선 관리, 진행 상황 알림</td></tr>
                            <tr><td>예산관리(AR)</td><td>프로젝트 예산 집행, 지출 등록·승인, 활동 이력 관리</td></tr>
                            <tr><td>AI 서비스</td><td>사내 규정 챗봇 응답 생성, 전표 자동화 인식 보조</td></tr>
                            <tr><td>알림</td><td>결재·게시글·댓글·피드백·예산 경고 등 인앱·이메일·데스크탑 앱 알림</td></tr>
                            <tr><td>보안 관리</td><td>접근 통제, 로그인 이상 탐지, 감사 로그, 비밀번호 이력 관리</td></tr>
                            <tr><td>시스템 운영</td><td>장애 대응, 성능 분석, 서비스 개선</td></tr>
                        </tbody>
                    </table>
                </section>

                <section id="sec-2" className="privacy-section">
                    <h2>2. 처리하는 개인정보의 항목</h2>

                    <h3>2.1 동의 없이 처리하는 항목 (계약 이행·법령상 의무·정당한 이익)</h3>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>처리 목적</th><th>법적 근거</th><th>처리 항목</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>계정 관리·인증</td><td>제15조제1항제4호 (계약 이행)</td><td>아이디, 비밀번호(해시), 이름, 이메일, 사번, 권한, 활성화 상태</td></tr>
                            <tr><td>인사·근태</td><td>제15조제1항제2호 (법령상 의무)</td><td>사번, 이름, 부서, 직급, 입사일, 내선번호, 휴대전화, 프로필 이미지</td></tr>
                            <tr><td>전자결재·예산</td><td>제15조제1항제4호 (계약 이행)</td><td>결재자/기안자 정보, 부서, 직급, 결재 내역, 지출 내역</td></tr>
                            <tr><td>협업·게시판</td><td>제15조제1항제4호 (계약 이행)</td><td>작성자명, 부서, 작성·수정 일시, 댓글, 첨부파일</td></tr>
                            <tr><td>보안·감사</td><td>제15조제1항제6호 (정당한 이익)</td><td>로그인 IP, User-Agent, 접속 일시, 로그인 실패 횟수, 비밀번호 이력</td></tr>
                            <tr><td>시스템 로그</td><td>제15조제1항제6호 (정당한 이익)</td><td>사용자 ID, IP, 요청 URL, 오류 메시지, 발생 일시</td></tr>
                        </tbody>
                    </table>

                    <h3>2.2 동의를 받아 처리하는 항목</h3>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>처리 목적</th><th>법적 근거</th><th>처리 항목</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>개인 주소록</td><td>제15조제1항제1호 (동의)</td><td>외부 연락처(이름, 회사, 부서, 직급, 전화, 이메일, 메모)</td></tr>
                            <tr><td>프로필 이미지</td><td>제15조제1항제1호 (동의)</td><td>사용자 업로드 이미지</td></tr>
                        </tbody>
                    </table>

                    <h3>2.3 자동 생성·수집 정보</h3>
                    <ul>
                        <li>세션 쿠키 (accessToken, refreshToken): 인증 유지</li>
                        <li>접속 로그: 보안 감사, 장애 분석</li>
                        <li>클라이언트 오류 정보: 서비스 안정성 개선</li>
                        <li>게시글 열람 기록: 미확인 공지 표시</li>
                    </ul>

                    <h3>2.4 민감정보 및 고유식별정보</h3>
                    <p className="privacy-callout">
                        회사는 그룹웨어 시스템에서 <strong>주민등록번호·여권번호 등 고유식별정보를 처리하지 않으며,
                        사상·신념·건강 등 민감정보를 처리하지 않습니다.</strong>
                    </p>
                </section>

                <section id="sec-3" className="privacy-section">
                    <h2>3. 개인정보의 처리 및 보유 기간</h2>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>구분</th><th>보유 기간</th><th>근거</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>임직원 계정 정보</td><td>재직 기간 + 퇴직 후 3년</td><td>근로기준법 제42조 (3년 보존), 임금채권 소멸시효 3년 준용</td></tr>
                            <tr><td>전자결재 문서</td><td>10년</td><td>상법 제33조, 국세기본법 제85조의3</td></tr>
                            <tr><td>예산관리(AR) 지출 내역</td><td>5년</td><td>국세기본법 제85조의3</td></tr>
                            <tr><td>게시판·캘린더·프로젝트</td><td>시스템 운영 종료 시까지 (퇴직자 계정 비활성화, 데이터는 회사 자산으로 보관)</td><td>회사 업무 규정 (업무 연속성·인수인계 목적)</td></tr>
                            <tr><td>시스템 로그</td><td>1년 (자동 삭제)</td><td>개인정보의 안전성 확보조치 기준 제8조 (접속기록 1년 이상 보관 의무)</td></tr>
                            <tr><td>감사 로그</td><td>3년</td><td>정보통신망법 시행령 제15조 준용</td></tr>
                            <tr><td>비밀번호 이력</td><td>최근 10개 보관</td><td>안전성 확보조치 기준</td></tr>
                            <tr><td>Refresh Token</td><td>발급 후 7일</td><td>인증 정책</td></tr>
                            <tr><td>개인 주소록</td><td>동의 철회 또는 회원 탈퇴 시까지</td><td>정보주체 동의</td></tr>
                        </tbody>
                    </table>
                </section>

                <section id="sec-4" className="privacy-section">
                    <h2>4. 개인정보의 파기 절차 및 방법</h2>
                    <h3>4.1 파기 절차</h3>
                    <ul>
                        <li>보유 기간 경과·처리 목적 달성 시 <strong>지체 없이</strong> 파기</li>
                        <li>법령상 보존이 필요한 경우 별도 DB로 분리하여 법정 기간 동안만 보관</li>
                        <li>개인정보 보호책임자 승인 후 파기</li>
                    </ul>
                    <h3>4.2 파기 방법</h3>
                    <ul>
                        <li>전자적 파일: DELETE 쿼리 + 트랜잭션 로그 정리, 백업본도 보존기간 경과 후 폐기</li>
                        <li>첨부파일: 운영체제 단계 영구 삭제(unlink), 백업 매체에서도 동일 처리</li>
                        <li>종이 출력물: 분쇄기로 분쇄 또는 소각</li>
                    </ul>
                    <h3>4.3 자동 파기 작업</h3>
                    <ul>
                        <li>refresh_tokens 만료 항목: 1시간마다 자동 삭제</li>
                        <li>system_logs 1년(365일) 이상: 매일 새벽 3시 자동 삭제</li>
                    </ul>
                </section>

                <section id="sec-5" className="privacy-section">
                    <h2>5. 개인정보의 제3자 제공</h2>
                    <p>
                        회사는 정보주체의 개인정보를 본 처리방침에서 명시한 처리 목적 범위 내에서만 처리하며,
                        <strong> 외부 제3자에게 개인정보를 제공하지 않습니다.</strong>
                    </p>
                    <p>다만, 다음의 경우에는 예외적으로 제공할 수 있습니다:</p>
                    <ul>
                        <li>정보주체로부터 별도의 동의를 받은 경우</li>
                        <li>법령에 특별한 규정이 있는 경우 (수사·재판 영장, 세무조사 등)</li>
                        <li>정보주체 또는 제3자의 급박한 생명·신체·재산상 이익을 위해 필요한 경우</li>
                    </ul>
                </section>

                <section id="sec-6" className="privacy-section">
                    <h2>6. 개인정보 처리업무의 위탁</h2>
                    <p>회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.</p>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>수탁자</th><th>위탁 업무</th><th>위탁 항목</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>Microsoft Corporation (Office 365 SMTP)</td><td>결재·시스템 알림 메일 발송</td><td>수신자 이메일, 메일 본문, 발송 시각</td></tr>
                            <tr><td>사내 RAG 서비스 (Python FastAPI)</td><td>AI 챗봇 응답 생성</td><td>사용자 질문 텍스트, 사용자 ID</td></tr>
                            <tr><td>사내 Ollama 서버</td><td>AI 전표 자동화 (PDF 텍스트 추출)</td><td>업로드된 전표 PDF 본문 텍스트</td></tr>
                        </tbody>
                    </table>
                    <p className="privacy-note">
                        위탁 계약 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행 목적 외 처리 금지,
                        기술적·관리적 보호조치, 재위탁 제한, 관리·감독, 손해배상 책임 등을 문서로 규정합니다.
                    </p>
                </section>

                <section id="sec-7" className="privacy-section">
                    <h2>7. 개인정보의 국외 이전</h2>
                    <table className="privacy-table privacy-table-vertical">
                        <tbody>
                            <tr><th>이전 근거</th><td>「개인정보 보호법」 제28조의8제1항제3호 (계약 이행을 위한 처리위탁)</td></tr>
                            <tr><th>이전받는 자</th><td>Microsoft Corporation (Office 365)</td></tr>
                            <tr><th>이전 국가</th><td>미국, EU, 아시아·태평양 (Microsoft 지정 데이터 센터)</td></tr>
                            <tr><th>이전 항목</th><td>메일 수신자 주소, 메일 본문, 발송 시각</td></tr>
                            <tr><th>이전 시기·방법</th><td>알림 발생 시 TLS 암호화 SMTP 전송</td></tr>
                            <tr><th>보유·이용 기간</th><td>Microsoft 보존 정책에 따름</td></tr>
                            <tr><th>거부 방법</th><td>그룹웨어 사용 중단 또는 시스템 관리자에게 메일 알림 비활성화 요청</td></tr>
                        </tbody>
                    </table>
                    <p className="privacy-note">
                        그룹웨어의 자체 데이터(직원 정보, 결재 문서 등)는 <strong>국내 사내 서버에만 저장</strong>되며
                        국외로 이전되지 않습니다.
                    </p>
                </section>

                <section id="sec-8" className="privacy-section">
                    <h2>8. 개인정보의 안전성 확보조치</h2>
                    <h3>관리적 조치</h3>
                    <ul>
                        <li>내부 관리계획 수립·시행 (정보보안 정책서)</li>
                        <li>개인정보 취급자 최소화 및 권한 등급 분리</li>
                        <li>정기적 직원 보안 교육 및 비밀번호 변경 안내</li>
                        <li>반기별 접근권한 검토</li>
                        <li>보안 인시던트 대응 절차</li>
                    </ul>
                    <h3>기술적 조치</h3>
                    <ul>
                        <li>역할 기반 권한 통제, JWT 토큰 인증</li>
                        <li>비밀번호 단방향 암호화 (bcrypt)</li>
                        <li>비밀번호 이력 관리 (최근 3개 재사용 차단)</li>
                        <li>통신 구간 암호화 (HTTPS/TLS)</li>
                        <li>접속 기록 보관 및 점검</li>
                        <li>보안 헤더 적용 (Helmet, CSP)</li>
                        <li>로그인 실패 시 계정 잠금</li>
                        <li>세션 자동 로그아웃 (기본 60분)</li>
                        <li>Rate Limit, CSRF·XSS 방지</li>
                    </ul>
                    <h3>물리적 조치</h3>
                    <ul>
                        <li>서버실 출입 통제</li>
                        <li>백업 매체 잠금장치 보관</li>
                        <li>매일 자동 백업</li>
                    </ul>
                </section>

                <section id="sec-9" className="privacy-section">
                    <h2>9. 개인정보 자동 수집 장치의 설치·운영 및 거부</h2>
                    <h3>9.1 쿠키 사용</h3>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>쿠키명</th><th>목적</th><th>보유 기간</th><th>속성</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>accessToken</td><td>API 요청 인증</td><td>15분</td><td>httpOnly, SameSite=Lax</td></tr>
                            <tr><td>refreshToken</td><td>자동 인증 갱신</td><td>7일</td><td>httpOnly, SameSite=Lax</td></tr>
                        </tbody>
                    </table>
                    <h3>9.2 거부 방법</h3>
                    <p>브라우저 설정에서 쿠키를 차단할 수 있으나, 차단 시 그룹웨어 로그인이 불가능해지므로 서비스를 이용할 수 없습니다. 로그아웃 시 쿠키는 즉시 삭제됩니다.</p>
                    <h3>9.3 행태정보·맞춤형 광고</h3>
                    <p>회사는 사내 그룹웨어에서 <strong>행태정보를 수집하지 않으며, 맞춤형 광고를 제공하지 않습니다.</strong></p>
                </section>

                <section id="sec-10" className="privacy-section">
                    <h2>10. 정보주체의 권리·의무 및 행사방법</h2>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>권리</th><th>행사 방법</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>개인정보 열람</td><td><Link to="/hr/myinfo">내 정보</Link> 메뉴에서 직접 조회</td></tr>
                            <tr><td>개인정보 정정</td><td><Link to="/hr/myinfo">내 정보</Link>에서 직접 수정 (사번·부서는 인사 담당자 통해 요청)</td></tr>
                            <tr><td>개인정보 삭제</td><td>퇴직 시 자동 비활성화 후 보유 기간 경과 시 삭제, 그 외는 보호책임자에게 요청</td></tr>
                            <tr><td>처리정지</td><td>보호책임자에게 서면·이메일 요청</td></tr>
                            <tr><td>전송 요구</td><td>보호책임자에게 요청 시 표준 형식으로 제공</td></tr>
                            <tr><td>동의 철회</td><td>개인 주소록 등 동의 기반 항목은 해당 화면에서 즉시 삭제 가능</td></tr>
                        </tbody>
                    </table>
                    <h3>권리 행사 절차</h3>
                    <ol>
                        <li>정보주체가 보호책임자에게 요청 (방문·서면·이메일·전화 모두 가능)</li>
                        <li>본인 확인 후 <strong>10일 이내</strong> 처리 결과 회신</li>
                        <li>거절 시 사유 명시</li>
                    </ol>
                    <p className="privacy-note">
                        다른 법령에서 개인정보가 수집 대상으로 명시되어 있는 경우(결재 문서, 회계 기록 등), 해당 정보의 삭제를 요구할 수 없습니다.
                    </p>
                </section>

                <section id="sec-11" className="privacy-section">
                    <h2>11. 자동화된 결정에 관한 사항</h2>
                    <p>회사의 그룹웨어는 다음의 자동화된 처리를 수행합니다.</p>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>기능</th><th>자동화 처리</th><th>영향</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>로그인 실패 잠금</td><td>5회 연속 실패 시 자동 잠금</td><td>일시 이용 제한 (관리자 해제 필요)</td></tr>
                            <tr><td>AI 챗봇 응답</td><td>사용자 질문 → RAG 모델 → 응답 생성</td><td>정보 제공 (의사결정 보조)</td></tr>
                            <tr><td>AI 전표 자동화</td><td>PDF → LLM 추출 → 전표 양식 채움</td><td>사용자가 최종 확인·수정</td></tr>
                            <tr><td>결재 자동 라우팅</td><td>결재선 규칙에 따라 다음 결재자 지정</td><td>결재 절차 안내 (실제 승인은 사람)</td></tr>
                        </tbody>
                    </table>
                    <p>
                        위 처리는 모두 <strong>사람이 최종 의사결정을 하는 보조 도구</strong>이며,
                        「개인정보 보호법」 제37조의2의 "정보주체의 권리·의무에 중대한 영향을 미치는
                        자동화된 결정"에 해당하지 않습니다.
                    </p>
                    <p>거부·설명 요구 시 보호책임자에게 요청하여 30일 이내 처리 결과를 받을 수 있습니다.</p>
                </section>

                <section id="sec-12" className="privacy-section">
                    <h2>12. 개인정보 보호책임자</h2>
                    <div className="privacy-officer">
                        <h3>개인정보 보호책임자</h3>
                        <ul>
                            <li>성명: 노송균</li>
                            <li>직위: 선임</li>
                            <li>이메일: songgyun.noh@amphenol-sensors.com</li>
                            <li>전화: 내선 776</li>
                        </ul>
                        <h3>개인정보 담당부서</h3>
                        <ul>
                            <li>부서명: IT팀</li>
                            <li>담당자: 노송균</li>
                            <li>이메일: songgyun.noh@amphenol-sensors.com</li>
                            <li>전화: 내선 776</li>
                        </ul>
                    </div>
                </section>

                <section id="sec-13" className="privacy-section">
                    <h2>13. 정보주체의 권익침해에 대한 구제방법</h2>
                    <p>정보주체는 개인정보침해로 인한 분쟁 해결, 상담 등 피해 구제를 받고자 하는 경우 아래의 기관에 신고·상담 등을 신청하실 수 있습니다.</p>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>기관</th><th>연락처</th><th>누리집</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>개인정보 분쟁조정위원회</td><td>(국번없이) 1833-6972</td><td>www.kopico.go.kr</td></tr>
                            <tr><td>개인정보침해 신고센터</td><td>(국번없이) 118</td><td>privacy.kisa.or.kr</td></tr>
                            <tr><td>대검찰청 사이버범죄수사단</td><td>(국번없이) 1301</td><td>spo.go.kr</td></tr>
                            <tr><td>경찰청 사이버수사국</td><td>(국번없이) 182</td><td>ecrm.police.go.kr</td></tr>
                        </tbody>
                    </table>
                </section>

                <section id="sec-14" className="privacy-section">
                    <h2>14. 개인정보 처리방침의 변경</h2>
                    <p>본 처리방침은 시행일자(2026-04-29)로부터 적용됩니다. 법령 및 방침에 따른 변경 내용의 추가, 삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 그룹웨어 공지사항을 통해 고지합니다.</p>
                    <h3>변경 이력</h3>
                    <table className="privacy-table">
                        <thead>
                            <tr><th>버전</th><th>시행일</th><th>변경 내용</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>1.0</td><td>2026-04-29</td><td>최초 제정</td></tr>
                        </tbody>
                    </table>
                </section>

                <footer className="privacy-footer">
                    <Link to="/" className="privacy-back-btn">← 돌아가기</Link>
                </footer>
            </div>
        </div>
    );
}

export default PrivacyPolicy;
