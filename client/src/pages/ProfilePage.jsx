import React, { useState, useEffect } from 'react';
import { MdEdit, MdSave, MdClose, MdVerifiedUser, MdSentimentSatisfied, MdAssessment } from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { authService, analysisService } from '../services/api';
import { Spinner } from '../components/common/Loader';
import './ProfilePage.css';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [form, setForm] = useState({
    name:  user?.name  || '',
    email: user?.email || '',
    bio:   user?.bio   || '',
  });

  const [statsData, setStatsData] = useState({ total: 0, news: 0, brand: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const { data } = await analysisService.getHistory({ limit: 1000 });
        const list = data?.analyses || [];
        const total = typeof data?.total === 'number' ? data.total : list.length;
        const news = list.filter((item) => (item.type || item.analysisType) === 'news').length;
        const brand = list.filter((item) => (item.type || item.analysisType) === 'brand').length;
        if (isMounted) {
          setStatsData({ total, news, brand });
        }
      } catch (err) {
        console.error('Failed to load profile stats:', err);
      } finally {
        if (isMounted) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await authService.updateProfile(form);
      updateUser(data.user);
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ name: user?.name || '', email: user?.email || '', bio: user?.bio || '' });
    setEditing(false);
    setError('');
  };

  const stats = [
    { label: 'Analyses Completed', value: statsLoading ? '...' : statsData.total, icon: <MdAssessment />,       color: 'var(--accent-purple)' },
    { label: 'News Analyses',      value: statsLoading ? '...' : statsData.news,  icon: <MdVerifiedUser />,      color: 'var(--accent-cyan)'   },
    { label: 'Brand Analyses',     value: statsLoading ? '...' : statsData.brand, icon: <MdSentimentSatisfied />, color: 'var(--success)'       },
  ];

  return (
    <AppLayout title="Profile" subtitle="Your account information and preferences.">
      <div className="profile-page page-enter">
        {/* Profile Card */}
        <div className="glass-card profile-card">
          {/* Avatar + Basic Info */}
          <div className="profile-top">
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="profile-avatar-badge">✓</div>
            </div>
            <div className="profile-basic">
              <h2 className="profile-name">{user?.name || 'User'}</h2>
              <p className="profile-email">{user?.email || ''}</p>
              {user?.bio && <p className="profile-bio">{user.bio}</p>}
              <div className="profile-meta">
                <span className="profile-meta-item">
                  <span style={{ color: 'var(--text-muted)' }}>Member Since</span>{' '}
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                    : 'Oct 2026'
                  }
                </span>
              </div>
            </div>
            <button
              className={`btn ${editing ? 'btn-ghost' : 'btn-primary'} btn-sm profile-edit-btn`}
              onClick={() => editing ? handleCancel() : setEditing(true)}
            >
              {editing ? <><MdClose /> Cancel</> : <><MdEdit /> Edit Profile</>}
            </button>
          </div>

          {/* Stats Row */}
          <div className="profile-stats">
            {stats.map((s) => (
              <div key={s.label} className="profile-stat-item">
                <div className="profile-stat-icon" style={{ color: s.color, background: `${s.color}15` }}>
                  {s.icon}
                </div>
                <div className="profile-stat-body">
                  <span className="profile-stat-value" style={{ color: s.color }}>{s.value}</span>
                  <span className="profile-stat-label">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit / Info Form */}
        <div className="glass-card profile-info-card">
          <h3 className="section-title" style={{ marginBottom: '1.5rem' }}>
            {editing ? 'Edit Profile' : 'Account Information'}
          </h3>

          {error && (
            <div className="auth-error animate-fade-in" style={{ marginBottom: '1rem' }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {editing ? (
            <form onSubmit={handleSave} className="profile-form">
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Email Address</label>
                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="input-group">
                <label className="input-label">Bio</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="Tell us about yourself…"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.875rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner size="sm" color="white" /> : <MdSave />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-info-list">
              {[
                { label: 'Name',         value: user?.name  || '—' },
                { label: 'Email',        value: user?.email || '—' },
                { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Oct 2026' },
                { label: 'Plan',         value: user?.plan  || 'Free' },
              ].map((row) => (
                <div key={row.label} className="profile-info-row">
                  <span className="profile-info-label">{row.label}</span>
                  <span className="profile-info-value">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
