import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const AppLayout = ({ children, title, subtitle }) => (
  <div className="app-shell">
    <Sidebar />
    <div className="page-content">
      <TopBar title={title} subtitle={subtitle} />
      <main className="main-area page-enter">
        {children}
      </main>
    </div>
  </div>
);

export default AppLayout;
