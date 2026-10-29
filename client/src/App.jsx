import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider }     from './context/AuthContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { ThemeProvider }    from './context/ThemeContext';
import AppRouter from './router';
import './index.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-google-client-id.apps.googleusercontent.com';

const App = () => (
  <GoogleOAuthProvider clientId={googleClientId}>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AnalysisProvider>
            <AppRouter />
          </AnalysisProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </GoogleOAuthProvider>
);

export default App;
