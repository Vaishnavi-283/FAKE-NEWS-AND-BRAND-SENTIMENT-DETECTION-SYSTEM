import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MdAssessment, MdDownload, MdOpenInNew, MdBarChart } from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { reportsService } from '../services/api';
import EmptyState from '../components/common/EmptyState';
import { SkeletonCard } from '../components/common/Loader';
import './ReportsPage.css';

const ReportCard = ({ report, onDownload }) => (
  <div className="report-card glass-card animate-fade-in">
    <div className="report-card-header">
      <div className={`report-type-icon ${report.type === 'news' ? 'news-icon' : 'brand-icon'}`}>
        {report.type === 'news' ? <MdAssessment /> : <MdBarChart />}
      </div>
      <div className="report-card-info">
        <h4 className="report-title">{report.title || 'Analysis Report'}</h4>
        <p className="report-sub">
          {report.type === 'news' ? 'News Analysis' : 'Brand Analysis'} ·{' '}
          {report.createdAt ? new Date(report.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </p>
      </div>
    </div>
    {report.summary && (
      <p className="report-summary">{report.summary.slice(0, 120)}…</p>
    )}
    <div className="report-card-actions">
      <Link to={`/result/${report._id}`} className="btn btn-ghost btn-sm">
        <MdOpenInNew /> View
      </Link>
      <button className="btn btn-secondary btn-sm" onClick={() => onDownload(report._id)}>
        <MdDownload /> Download
      </button>
    </div>
  </div>
);

const ReportsPage = () => {
  const [tab, setTab]       = useState('all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const params = tab !== 'all' ? { type: tab } : {};
        const { data } = await reportsService.getAll(params);
        setReports(data.reports || []);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [tab]);

  const handleDownload = async (id) => {
    try {
      const { data } = await reportsService.download(id);
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `meiora-report-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Backend not connected
    }
  };

  return (
    <AppLayout title="My Reports" subtitle="Download and review your analysis reports.">
      <div className="reports-page page-enter">
        <div className="tabs" style={{ marginBottom: '1.5rem', width: 'fit-content' }}>
          <button className={`tab-btn ${tab === 'all'   ? 'active' : ''}`} onClick={() => setTab('all')}>All</button>
          <button className={`tab-btn ${tab === 'news'  ? 'active' : ''}`} onClick={() => setTab('news')}>
            <MdAssessment /> News Reports
          </button>
          <button className={`tab-btn ${tab === 'brand' ? 'active' : ''}`} onClick={() => setTab('brand')}>
            <MdBarChart /> Brand Reports
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1,2,3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              type="no-results"
              title="No reports available"
              description="Run an analysis to generate reports here."
            />
          </div>
        ) : (
          <div className="reports-grid">
            {reports.map((r) => (
              <ReportCard key={r._id} report={r} onDownload={handleDownload} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ReportsPage;
