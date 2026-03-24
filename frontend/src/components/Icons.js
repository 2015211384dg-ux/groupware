import React from 'react';

const Icon = ({ d, size = 18, strokeWidth = 1.6, ...props }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
    >
        {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
    </svg>
);

// 네비게이션
export const IconHome        = (p) => <Icon {...p} d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />;
export const IconBoard       = (p) => <Icon {...p} d={["M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2","M9 5a2 2 0 002 2h2a2 2 0 002-2","M9 5a2 2 0 012-2h2a2 2 0 012 2","M9 12h6M9 16h4"]} />;
export const IconAddressBook = (p) => <Icon {...p} d={["M16 2H8a2 2 0 00-2 2v16a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z","M12 11a3 3 0 100-6 3 3 0 000 6z","M8 18c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5"]} />;
export const IconHR          = (p) => <Icon {...p} d={["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2","M9 11a4 4 0 100-8 4 4 0 000 8z","M23 21v-2a4 4 0 00-3-3.87","M16 3.13a4 4 0 010 7.75"]} />;
export const IconFolder      = (p) => <Icon {...p} d={["M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"]} />;
export const IconFolderOpen  = (p) => <Icon {...p} d={["M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"]} />;
export const IconCalendar    = (p) => <Icon {...p} d={["M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"]} />;
export const IconApproval    = (p) => <Icon {...p} d={["M9 11l3 3L22 4","M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"]} />;
export const IconAdmin       = (p) => <Icon {...p} d={["M12 15a3 3 0 100-6 3 3 0 000 6z","M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"]} />;
export const IconSearch      = (p) => <Icon {...p} d={["M21 21l-4.35-4.35","M17 11A6 6 0 105 11a6 6 0 0012 0z"]} />;

// 결재 관련
export const IconInbox       = (p) => <Icon {...p} d={["M22 12h-6l-2 3h-4l-2-3H2","M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"]} />;
export const IconSend        = (p) => <Icon {...p} d={["M22 2L11 13","M22 2l-7 20-4-9-9-4 20-7z"]} />;
export const IconDraft       = (p) => <Icon {...p} d={["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7","M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"]} />;
export const IconDone        = (p) => <Icon {...p} d={["M22 11.08V12a10 10 0 11-5.93-9.14","M22 4L12 14.01l-3-3"]} />;
export const IconEye         = (p) => <Icon {...p} d={["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z","M12 12m-3 0a3 3 0 106 0 3 3 0 00-6 0"]} />;

// 액션
export const IconEdit        = (p) => <Icon {...p} d={["M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7","M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"]} />;
export const IconTrash       = (p) => <Icon {...p} d={["M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"]} />;
export const IconPaperclip   = (p) => <Icon {...p} d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />;
export const IconFile        = (p) => <Icon {...p} d={["M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z","M13 2v7h7"]} />;
export const IconPlus        = (p) => <Icon {...p} d={["M12 5v14","M5 12h14"]} />;
export const IconCheck       = (p) => <Icon {...p} d="M20 6L9 17l-5-5" />;
export const IconX           = (p) => <Icon {...p} d={["M18 6L6 18","M6 6l12 12"]} />;
export const IconChevronDown = (p) => <Icon {...p} d="M6 9l6 6 6-6" />;
export const IconChevronRight= (p) => <Icon {...p} d="M9 18l6-6-6-6" />;
export const IconArrowLeft   = (p) => <Icon {...p} d={["M19 12H5","M12 19l-7-7 7-7"]} />;

// 알림/기타
export const IconBell        = (p) => <Icon {...p} d={["M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9","M13.73 21a2 2 0 01-3.46 0"]} />;
export const IconChat        = (p) => <Icon {...p} d={["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"]} />;
export const IconSettings    = (p) => <Icon {...p} d={["M12 15a3 3 0 100-6 3 3 0 000 6z","M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"]} />;
export const IconLogout      = (p) => <Icon {...p} d={["M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4","M16 17l5-5-5-5","M21 12H9"]} />;
export const IconUser        = (p) => <Icon {...p} d={["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2","M12 11a4 4 0 100-8 4 4 0 000 8z"]} />;
export const IconBuilding    = (p) => <Icon {...p} d={["M6 2h12v20H6z","M2 22h20","M10 6h1M13 6h1M10 10h1M13 10h1M10 14h1M13 14h1"]} />;
export const IconPen         = (p) => <Icon {...p} d={["M12 20h9","M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"]} />;
export const IconRefresh     = (p) => <Icon {...p} d={["M23 4v6h-6","M1 20v-6h6","M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"]} />;

// 공지/알림
export const IconMegaphone      = (p) => <Icon {...p} d={["M18 8a4 4 0 010 8","M3 8h2l6-3v14l-6-3H3a1 1 0 01-1-1v-6a1 1 0 011-1z","M9 17v3"]} />;

// 피드백
export const IconMessageSquare = (p) => <Icon {...p} d={["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"]} />;
export const IconBug            = (p) => <Icon {...p} d={["M8 2l1.88 1.88","M14.12 3.88L16 2","M9 7.13v-1a3.003 3.003 0 116 0v1","M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0112 0v3c0 3.3-2.7 6-6 6z","M12 20v2","M6.53 9C4.6 8.8 3 7.1 3 5","M6 13H2","M3 21c0-2.1 1.7-3.9 3.8-4","M20.97 5c0 2.1-1.6 3.8-3.5 4","M22 13h-4","M17.2 17c2.1.1 3.8 1.9 3.8 4"]} />;
export const IconLightbulb      = (p) => <Icon {...p} d={["M9 18h6","M10 22h4","M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 01-1 1H9a1 1 0 01-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"]} />;

// 답글
export const IconReply       = (p) => <Icon {...p} d={["M15 10l5 5-5 5","M4 4v7a4 4 0 004 4h12"]} />;

// 핀/고정
export const IconPin         = (p) => <Icon {...p} d={["M12 17v5","M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 000-4H8a2 2 0 000 4 1 1 0 011 1v3.76z"]} />;
export const IconPinOff      = (p) => <Icon {...p} d={["M12 17v5","M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V7a1 1 0 011-1 2 2 0 000-4H8a2 2 0 000 4 1 1 0 011 1v3.76z","M2 2l20 20"]} />;
export const IconHeart       = (p) => <Icon {...p} d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />;
export const IconDownload    = (p) => <Icon {...p} d={["M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4","M7 10l5 5 5-5","M12 15V3"]} />;

// 글로브 (언어)
export const IconGlobe      = (p) => <Icon {...p} d={["M12 2a10 10 0 1010 10A10 10 0 0012 2z","M2 12h20","M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"]} />;

// 저장
export const IconSave       = (p) => <Icon {...p} d={["M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z","M17 21v-8H7v8","M7 3v5h8"]} />;

// 잠금
export const IconLock           = (p) => <Icon {...p} d={["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z","M7 11V7a5 5 0 0110 0v4"]} />;
export const IconUnlock         = (p) => <Icon {...p} d={["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z","M7 11V7a5 5 0 019.9-1"]} />;

// 로그 유형
export const IconInfo           = (p) => <Icon {...p} d={["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z","M12 8v4","M12 16h.01"]} />;
export const IconAlertTriangle  = (p) => <Icon {...p} d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />;
export const IconAlertCircle    = (p) => <Icon {...p} d={["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z","M12 8v4","M12 16h.01"]} />;
export const IconCheckCircle    = (p) => <Icon {...p} d={["M22 11.08V12a10 10 0 11-5.93-9.14","M22 4L12 14.01l-3-3"]} />;

export default Icon;