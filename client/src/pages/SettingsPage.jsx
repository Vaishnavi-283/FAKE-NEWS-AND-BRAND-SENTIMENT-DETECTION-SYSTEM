import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdPalette, MdLanguage, MdNotifications, MdSecurity,
  MdLogout, MdChevronRight, MdDarkMode, MdLightMode,
} from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Toast from '../components/common/Toast';
import {
  getSettings,
  saveSettings,
  requestPushPermission,
} from '../services/settingsService';
import './SettingsPage.css';

const SettingsSection = ({ title, children }) => (
  <div className="glass-card settings-section">
    <h3 className="settings-section-title">{title}</h3>
    {children}
  </div>
);

const SettingsRow = ({ icon, label, description, control }) => (
  <div className="settings-row">
    <div className="settings-row-icon">{icon}</div>
    <div className="settings-row-body">
      <span className="settings-row-label">{label}</span>
      {description && <span className="settings-row-desc">{description}</span>}
    </div>
    <div className="settings-row-control">{control}</div>
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button
    className={`toggle ${checked ? 'on' : 'off'}`}
    onClick={() => onChange(!checked)}
    role="switch"
    aria-checked={checked}
  >
    <span className="toggle-thumb" />
  </button>
);

const SettingsPage = () => {
  const { logout } = useAuth();
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState(() => getSettings());
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleUpdate = (key, val) => {
    const updated = saveSettings({ [key]: val });
    setPrefs(updated);
    return updated;
  };

  const handlePushToggle = async (checked) => {
    if (checked) {
      const res = await requestPushPermission();
      if (res.granted) {
        handleUpdate('pushNotifications', true);
        showToast('Push notifications enabled! You will receive desktop alerts.');
      } else {
        handleUpdate('pushNotifications', false);
        showToast(res.message || 'Notification permission was denied in your browser.', 'error');
      }
    } else {
      handleUpdate('pushNotifications', false);
      showToast('Push notifications disabled.');
    }
  };

  const handleEmailToggle = (checked) => {
    handleUpdate('emailNotifications', checked);
    showToast(
      checked
        ? 'Email notifications enabled! Summary reports will be sent to your inbox.'
        : 'Email notifications disabled.'
    );
  };

  const handleAutoSaveToggle = (checked) => {
    handleUpdate('autoSave', checked);
    showToast(
      checked
        ? 'Auto-save enabled! Analyses will be recorded in History.'
        : 'Auto-save disabled! New analyses will be temporary only.',
      'info'
    );
  };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <AppLayout title="Settings" subtitle="Manage your preferences and account settings.">
      <div className="settings-page page-enter">

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingsRow
            icon={<MdPalette />}
            label="Theme"
            description="Choose between dark and light mode."
            control={
              <div className="theme-toggle-row">
                <button
                  className={`theme-btn ${isDark ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  <MdDarkMode /> Dark
                </button>
                <button
                  className={`theme-btn ${!isDark ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  <MdLightMode /> Light
                </button>
              </div>
            }
          />
          <SettingsRow
            icon={<MdLanguage />}
            label="Language"
            description="Select your preferred language."
            control={
              <select
                className="settings-select input-field"
                value={prefs.language}
                onChange={(e) => set('language', e.target.value)}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="mr">Marathi</option>
              </select>
            }
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsRow
            icon={<MdNotifications />}
            label="Email Notifications"
            description="Receive analysis results via email."
            control={<Toggle checked={prefs.emailNotifications} onChange={handleEmailToggle} />}
          />
          <SettingsRow
            icon={<MdNotifications />}
            label="Push Notifications"
            description="Browser push notifications for results."
            control={<Toggle checked={prefs.pushNotifications} onChange={handlePushToggle} />}
          />
          <SettingsRow
            icon={<MdNotifications />}
            label="Auto-save Results"
            description="Automatically save every analysis to history."
            control={<Toggle checked={prefs.autoSave} onChange={handleAutoSaveToggle} />}
          />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection title="Privacy &amp; Security">
          <SettingsRow
            icon={<MdSecurity />}
            label="Public Profile"
            description="Allow others to see your analysis history."
            control={
              <Toggle
                checked={prefs.publicProfile}
                onChange={(v) => {
                  handleUpdate('publicProfile', v);
                  showToast(v ? 'Public profile visibility enabled.' : 'Profile visibility set to private.');
                }}
              />
            }
          />
          <SettingsRow
            icon={<MdSecurity />}
            label="Data Sharing"
            description="Help improve Meiora AI by sharing anonymized data."
            control={
              <Toggle
                checked={prefs.dataSharing}
                onChange={(v) => {
                  handleUpdate('dataSharing', v);
                  showToast(v ? 'Anonymized model data sharing enabled.' : 'Data sharing disabled.');
                }}
              />
            }
          />
        </SettingsSection>

        {/* Account */}
        <SettingsSection title="Account">
          <div className="settings-row settings-row-btn" onClick={() => navigate('/profile')}>
            <div className="settings-row-icon"><MdSecurity /></div>
            <div className="settings-row-body">
              <span className="settings-row-label">Edit Profile</span>
              <span className="settings-row-desc">Update your name, email, and bio.</span>
            </div>
            <MdChevronRight style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }} />
          </div>
          <div className="settings-row settings-row-btn settings-row-danger" onClick={handleLogout}>
            <div className="settings-row-icon" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
              <MdLogout />
            </div>
            <div className="settings-row-body">
              <span className="settings-row-label" style={{ color: 'var(--danger)' }}>Logout</span>
              <span className="settings-row-desc">Sign out of your account.</span>
            </div>
            <MdChevronRight style={{ color: 'var(--danger)', fontSize: '1.25rem' }} />
          </div>
        </SettingsSection>

        {/* Version */}
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center', paddingBottom: '1rem' }}>
          Meiora AI v1.0.0 · Built with React + Node.js + Gemini
        </p>

        {/* Interactive Toast Confirmation */}
        {toast && (
          <div className="toast-container">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
