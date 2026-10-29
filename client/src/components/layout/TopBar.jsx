import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdNotifications, MdNotificationsNone, MdSearch,
  MdDarkMode, MdLightMode, MdVerifiedUser, MdSentimentSatisfied,
  MdArrowForward, MdDoneAll
} from 'react-icons/md';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { analysisService } from '../../services/api';
import './TopBar.css';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const TopBar = ({ title, subtitle }) => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const { data } = await analysisService.getHistory({ limit: 6 });
      const list = data?.analyses || [];
      setNotifications(list);
      setUnreadCount(list.length > 0 ? Math.min(list.length, 5) : 0);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      navigate(`/history?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSearchClick = () => {
    if (query.trim()) {
      navigate(`/history?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        {title && (
          <div>
            <h1 className="topbar-title">{title}</h1>
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
        )}
      </div>
      <div className="topbar-right">
        <div className="topbar-search">
          <MdSearch style={{ cursor: 'pointer' }} onClick={handleSearchClick} />
          <input
            placeholder="Search anything…"
            className="topbar-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
        <button
          className="topbar-icon-btn theme-switch-btn"
          aria-label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          onClick={toggleTheme}
        >
          {isDark ? <MdLightMode style={{ color: '#FFD700', fontSize: '1.2rem' }} /> : <MdDarkMode style={{ color: 'var(--accent-purple)', fontSize: '1.2rem' }} />}
        </button>

        {/* Notifications Dropdown */}
        <div className="topbar-notif-wrapper" ref={notifRef}>
          <button
            className={`topbar-icon-btn ${showNotifs ? 'active' : ''}`}
            aria-label="Notifications"
            onClick={() => {
              if (!showNotifs) fetchNotifications();
              setShowNotifs((prev) => !prev);
            }}
          >
            <MdNotifications />
            {unreadCount > 0 && <span className="topbar-notif-dot" />}
          </button>

          {showNotifs && (
            <div className="notif-dropdown glass-card animate-fade-in">
              <div className="notif-header">
                <div className="notif-header-title">
                  <span>Notifications</span>
                  {unreadCount > 0 && <span className="notif-count-badge">{unreadCount} new</span>}
                </div>
                {unreadCount > 0 && (
                  <button
                    className="notif-mark-read-btn"
                    onClick={() => setUnreadCount(0)}
                    title="Mark all as read"
                  >
                    <MdDoneAll /> Mark read
                  </button>
                )}
              </div>

              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <MdNotificationsNone className="notif-empty-icon" />
                    <p className="notif-empty-text">No notifications yet</p>
                    <span className="notif-empty-sub">Recent analyses and alerts will appear here.</span>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item._id}
                      className="notif-item"
                      onClick={() => {
                        setShowNotifs(false);
                        navigate(`/result/${item._id}`);
                      }}
                    >
                      <div className={`notif-icon ${item.type === 'news' ? 'news' : 'brand'}`}>
                        {item.type === 'news' ? <MdVerifiedUser /> : <MdSentimentSatisfied />}
                      </div>
                      <div className="notif-content">
                        <p className="notif-item-title">
                          {item.title || item.input?.slice(0, 42) || 'Analysis Complete'}
                        </p>
                        <div className="notif-meta">
                          <span className={`notif-badge ${(item.classification || '').toLowerCase()}`}>
                            {item.classification || 'Complete'}
                          </span>
                          <span className="notif-time">{formatTimeAgo(item.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="notif-footer">
                <button
                  className="notif-view-all-btn"
                  onClick={() => {
                    setShowNotifs(false);
                    navigate('/history');
                  }}
                >
                  View all in History <MdArrowForward />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="topbar-user" style={{ cursor: 'pointer' }} onClick={() => navigate('/profile')}>
          <div className="topbar-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <span className="topbar-username">{user?.name?.split(' ')[0] || 'User'}</span>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
