import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';

function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="not-found">
            <div className="not-found-content">
                <h1 className="not-found-title">404</h1>
                <p className="not-found-message">페이지를 찾을 수 없습니다</p>
                <p className="not-found-description">
                    요청하신 페이지가 존재하지 않거나 이동되었습니다.
                </p>
                <button 
                    className="not-found-button"
                    onClick={() => navigate('/')}
                >
                    홈으로 돌아가기
                </button>
            </div>
        </div>
    );
}

export default NotFound;
