import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MdVerifiedUser, MdSentimentSatisfied, MdFilterList,
  MdOpenInNew, MdDelete, MdWarningAmber,
} from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { analysisService } from '../services/api';
import EmptyState from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/Loader';
import './HistoryPage.css';

const typeFilters = ['All', 'News', 'Brand'];

const HistoryRow = ({ item, onRequestDelete }) => {
  const classMap = {
    real:       'badge-real',
    fake:       'badge-fake',
    positive:   'badge-positive',
    negative:   'badge-negative',
    neutral:    'badge-neutral',
    unverified: 'badge-unverified',
    misleading: 'badge-fake',
  };
  const cls = classMap[(item.classification || '').toLowerCase()] || 'badge-unverified';

  return (
    <tr className="history-row animate-fade-in">
      <td>
        <div className={`history-type-icon ${item.type === 'news' ? 'news-icon' : 'brand-icon'}`}>
          {item.type === 'news'
            ? <MdVerifiedUser />
            : <MdSentimentSatisfied />
          }
        </div>
      </td>
      <td>
        <div className="history-title">{item.title || (item.input?.slice(0, 60)) || 'Analysis'}</div>
        <div className="history-sub">{item.type === 'news' ? 'News Analysis' : 'Brand Analysis'}</div>
      </td>
      <td>
        <span className={`badge ${cls}`}>{item.classification || 'Pending'}</span>
      </td>
      <td className="history-date">
        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
      </td>
      <td>
        <div className="history-actions">
          <Link to={`/result/${item._id}`} className="btn btn-ghost btn-sm" title="View details">
            <MdOpenInNew />
          </Link>
          <button className="btn btn-danger btn-sm" onClick={() => onRequestDelete(item)} title="Delete record">
            <MdDelete />
          </button>
        </div>
      </td>
    </tr>
  );
};

const HistoryPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState(initialSearch);
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]   = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'All') params.type = filter.toLowerCase();
      const { data } = await analysisService.getHistory(params);
      setItems(data.analyses || []);
      setTotal(data.total || 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [filter]);

  // Sync with URL query parameter changes
  useEffect(() => {
    const s = searchParams.get('search');
    if (s != null) {
      setSearch(s);
    }
  }, [searchParams]);

  // Keyboard shortcut to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && deleteTarget && !deleting) {
        setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, deleting]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await analysisService.deleteById(deleteTarget._id);
      setItems((prev) => prev.filter((i) => i._id !== deleteTarget._id));
      setTotal((prev) => Math.max(0, prev - 1));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete analysis:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    if (val.trim()) {
      setSearchParams({ search: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  // Client-side text filter by title, input, and classification
  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.input && item.input.toLowerCase().includes(q)) ||
      (item.classification && item.classification.toLowerCase().includes(q)) ||
      (item.type && item.type.toLowerCase().includes(q))
    );
  });

  return (
    <AppLayout title="Analysis History" subtitle="All your past analyses in one place.">
      <div className="history-page page-enter">
        {/* Toolbar */}
        <div className="history-toolbar glass-card">
          <div className="flex gap-3" style={{ alignItems: 'center' }}>
            <MdFilterList style={{ color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              placeholder="Search by name, keyword…"
              style={{ width: 260, padding: '0.4rem 0.875rem', fontSize: 'var(--text-sm)' }}
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div className="tabs history-tabs">
            {typeFilters.map((f) => (
              <button
                key={f}
                className={`tab-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          {filteredItems.length > 0 && (
            <span className="history-count">{filteredItems.length} results</span>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3,4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              type="no-history"
              title="No analyses found"
              description={search
                ? `No analyses matching "${search}". Try a different keyword.`
                : filter === 'All'
                  ? "You haven't analyzed any content yet. Start with a news article or brand."
                  : `No ${filter.toLowerCase()} analyses found.`
              }
              action={
                <div style={{ display: 'flex', gap: '0.875rem' }}>
                  <Link to="/news-detection"  className="btn btn-primary btn-sm">Analyze News</Link>
                  <Link to="/brand-sentiment" className="btn btn-secondary btn-sm">Analyze Brand</Link>
                </div>
              }
            />
          </div>
        ) : (
          <div className="glass-card table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Type</th>
                  <th>Name / Content</th>
                  <th style={{ width: 130 }}>Result</th>
                  <th style={{ width: 140 }}>Date</th>
                  <th style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <HistoryRow key={item._id} item={item} onRequestDelete={setDeleteTarget} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="modal-backdrop animate-fade-in" onClick={() => !deleting && setDeleteTarget(null)}>
            <div className="delete-modal-card glass-card" onClick={(e) => e.stopPropagation()}>
              <div className="delete-modal-header">
                <div className="delete-modal-icon">
                  <MdWarningAmber />
                </div>
                <div>
                  <h3 className="delete-modal-title">Delete Analysis Record?</h3>
                  <p className="delete-modal-subtitle">This action cannot be undone.</p>
                </div>
              </div>
              <div className="delete-modal-body">
                <p className="delete-modal-prompt">Are you sure you want to permanently remove this record from your history?</p>
                <div className="delete-modal-item-preview">
                  <span className={`modal-item-badge ${deleteTarget.type === 'news' ? 'badge-news' : 'badge-brand'}`}>
                    {deleteTarget.type === 'news' ? 'News' : 'Brand'}
                  </span>
                  <span className="modal-item-title">
                    {deleteTarget.title || deleteTarget.input?.slice(0, 70) || 'Untitled Analysis'}
                  </span>
                </div>
              </div>
              <div className="delete-modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
