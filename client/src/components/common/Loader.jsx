import React from 'react';
import './Loader.css';

export const Spinner = ({ size = 'md', color = 'purple' }) => (
  <div className={`spinner spinner-${size} spinner-${color}`} />
);

export const PageLoader = () => (
  <div className="page-loader">
    <div className="loader-ring" />
    <p className="loader-text">Loading…</p>
  </div>
);

export const SkeletonLine = ({ width = '100%', height = '1rem' }) => (
  <div className="skeleton" style={{ width, height }} />
);

export const SkeletonCard = () => (
  <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <SkeletonLine width="60%" height="1.25rem" />
    <SkeletonLine width="100%" height="0.875rem" />
    <SkeletonLine width="80%"  height="0.875rem" />
    <SkeletonLine width="40%" height="2rem" />
  </div>
);

export default Spinner;
