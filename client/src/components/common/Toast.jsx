import React, { useEffect } from 'react';
import { MdCheckCircle, MdError, MdWarning, MdInfo, MdClose } from 'react-icons/md';
import './Toast.css';

const icons = {
  success: <MdCheckCircle />,
  error:   <MdError />,
  warning: <MdWarning />,
  info:    <MdInfo />,
};

const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const t = setTimeout(onClose, duration);
      return () => clearTimeout(t);
    }
  }, [duration, onClose]);

  return (
    <div className={`toast toast-${type} animate-fade-right`}>
      <span className="toast-icon">{icons[type]}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}><MdClose /></button>
    </div>
  );
};

export default Toast;
