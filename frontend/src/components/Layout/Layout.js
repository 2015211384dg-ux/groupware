import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import './Layout.css';

function Layout({ children, user, onLogout }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    const isHome = location.pathname === '/' || location.pathname === '/dashboard';

    const handleLogout = () => {
        if (window.confirm('로그아웃 하시겠습니까?')) {
            onLogout();
            navigate('/login');
        }
    };

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="layout">
            <Header
                user={user}
                onLogout={handleLogout}
                onToggleSidebar={isHome ? null : toggleSidebar}
            />

            <div className="layout-content">
                {!isHome && <Sidebar isOpen={sidebarOpen} user={user} />}
                <main className={`main-content${isHome ? ' main-content--home' : ''}`}>
                    {children}
                </main>
            </div>
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