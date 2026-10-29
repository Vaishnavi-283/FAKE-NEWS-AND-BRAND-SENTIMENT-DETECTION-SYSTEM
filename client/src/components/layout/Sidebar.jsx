import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  MdDashboard, MdVerifiedUser, MdSentimentSatisfiedAlt,
  MdHistory, MdAssessment, MdPerson, MdSettings,
  MdLogout, MdClose, MdMenu, MdVideocam,
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
  { path: '/dashboard',        icon: <MdDashboard />,            label: 'Dashboard' },
  { path: '/news-detection',   icon: <MdVerifiedUser />,         label: 'News Detection' },
  { path: '/deepfake-lab',     icon: <MdVideocam style={{ color: '#9000feff' }} />, label: 'Deepfake Lab' },
  { path: '/rumor-buster',     icon: <FaWhatsapp style={{ color: '#25D366' }} />, label: 'Rumor Buster' },
  { path: '/brand-sentiment',  icon: <MdSentimentSatisfiedAlt />,label: 'Brand Sentiment' },
  { path: '/history',          icon: <MdHistory />,              label: 'History' },
  { path: '/reports',          icon: <MdAssessment />,           label: 'Reports' },
  { path: '/profile',          icon: <MdPerson />,               label: 'Profile' },
  { path: '/settings',         icon: <MdSettings />,             label: 'Settings' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${collapsed ? '' : 'hidden'}`}
        onClick={() => setCollapsed(false)}
      />

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#logoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="logoGrad" x1="2" y1="2" x2="22" y2="22">
                  <stop offset="0%" stopColor="#6C5CE7"/>
                  <stop offset="100%" stopColor="#00D4FF"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          {!collapsed && (
            <span className="sidebar-logo-text">
              Meiora <span className="gradient-text">AI</span>
            </span>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <MdMenu /> : <MdClose />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
              {!collapsed && item.path === '/news-detection' && (
                <span className="sidebar-nav-badge">AI</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="sidebar-footer">
          {!collapsed && user && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name || 'User'}</span>
                <span className="sidebar-user-email">{user.email || ''}</span>
              </div>
            </div>
          )}
          <button
            className="sidebar-logout"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
          >
            <MdLogout />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
