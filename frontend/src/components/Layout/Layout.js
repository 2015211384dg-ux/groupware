import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
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

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <div className="layout">
            <Header 
                user={user} 
                onLogout={handleLogout}
                onToggleSidebar={toggleSidebar}
            />
            
            <div className="layout-content">
                <Sidebar isOpen={sidebarOpen} user={user} />
                <main className="main-content">
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