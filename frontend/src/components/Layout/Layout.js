import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import ChatbotWidget from '../common/ChatbotWidget';
import './Layout.css';

function Layout({ children, user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            onLogout();
            navigate('/login');
        }
    };

    return (
        <div className="layout">
            <Sidebar
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(prev => !prev)}
                user={user}
                onLogout={handleLogout}
            />
            <main className="main-content">
                {children}
                <footer className="layout-footer">
                    <Link to="/privacy-policy" className="layout-privacy-link">개인정보 처리방침</Link>
                </footer>
            </main>
            <ChatbotWidget />
        </div>
    );
}

Layout.propTypes = {
    children: PropTypes.node.isRequired,
    user: PropTypes.shape({
        name: PropTypes.string,
        role: PropTypes.string
    }),
    onLogout: PropTypes.func.isRequired
};

export default Layout;
