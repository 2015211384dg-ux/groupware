import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import './Confirm.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
    const [dialog, setDialog] = useState(null);
    const [inputVal, setInputVal] = useState('');
    const inputRef = useRef(null);

    // input 타입일 때 자동 포커스
    useEffect(() => {
        if (dialog?.type === 'input') {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [dialog]);

    // confirm(message, options) — 확인/취소 → true/false 반환
    // prompt(message, options)  — 입력 → 문자열 or null 반환
    const confirm = useCallback((message, options = {}) => {
        return new Promise((resolve) => {
            setInputVal(options.defaultValue || '');
            setDialog({
                type:        options.type        || 'confirm',
                message,
                placeholder: options.placeholder || '',
                confirmText: options.confirmText || '확인',
                cancelText:  options.cancelText  || '취소',
                danger:      options.danger      || false,
                resolve,
            });
        });
    }, []);

    const handleConfirm = () => {
        if (dialog.type === 'input') {
            dialog?.resolve(inputVal.trim() || null);
        } else {
            dialog?.resolve(true);
        }
        setDialog(null);
        setInputVal('');
    };

    const handleCancel = () => {
        dialog?.resolve(dialog.type === 'input' ? null : false);
        setDialog(null);
        setInputVal('');
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {dialog && (
                <div className="cfm-overlay" onClick={handleCancel}>
                    <div className="cfm-box" onClick={e => e.stopPropagation()}>
                        <div className="cfm-message">{dialog.message}</div>
                        {dialog.type === 'input' && (
                            <input
                                ref={inputRef}
                                className="cfm-input"
                                placeholder={dialog.placeholder}
                                value={inputVal}
                                onChange={e => setInputVal(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleConfirm();
                                    if (e.key === 'Escape') handleCancel();
                                }}
                                maxLength={100}
                            />
                        )}
                        <div className="cfm-btns">
                            <button className="cfm-cancel" onClick={handleCancel}>
                                {dialog.cancelText}
                            </button>
                            <button
                                className={`cfm-confirm ${dialog.danger ? 'danger' : ''}`}
                                onClick={handleConfirm}
                            >
                                {dialog.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    return useContext(ConfirmContext);
}
