import React from 'react';
import { MdSearchOff, MdCloudOff, MdWarningAmber, MdOutlineHistoryToggleOff } from 'react-icons/md';

const iconMap = {
  'no-results':  <MdSearchOff />,
  'offline':     <MdCloudOff />,
  'error':       <MdWarningAmber />,
  'no-history':  <MdOutlineHistoryToggleOff />,
};

const EmptyState = ({
  type = 'no-results',
  icon,
  title = 'Nothing here yet',
  description,
  action,
  compact = false,
}) => (
  <div
    className="empty-state"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact ? '2rem' : '4rem 2rem',
      gap: '1rem',
      textAlign: 'center',
    }}
  >
    <div
      style={{
        width: compact ? 48 : 72,
        height: compact ? 48 : 72,
        borderRadius: '50%',
        background: 'rgba(108, 92, 231, 0.1)',
        border: '1px solid rgba(108, 92, 231, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: compact ? '1.4rem' : '2rem',
        color: 'var(--text-muted)',
      }}
    >
      {icon || iconMap[type]}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <h3 style={{ fontSize: compact ? 'var(--text-md)' : 'var(--text-lg)', fontWeight: 'var(--fw-semi)', color: 'var(--text-secondary)' }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: 320 }}>
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

export default EmptyState;
