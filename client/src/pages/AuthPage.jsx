import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdEmail, MdLock, MdPerson, MdVisibility, MdVisibilityOff, MdArrowBack } from 'react-icons/md';
import { FcGoogle } from 'react-icons/fc';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { Spinner } from '../components/common/Loader';
import './AuthPage.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const AuthPage = () => {
  const [tab, setTab] = useState('login');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP Verification State
  const [otpStep, setOtpStep] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(60);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const otpRefs = useRef([]);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Countdown timer for Resend Code
  useEffect(() => {
    let interval;
    if (otpStep && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpStep, otpTimer]);

  // Google OAuth Login Trigger
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await authService.googleLogin({ token: tokenResponse.access_token });
        login(data.user, data.token);
        navigate(from, { replace: true });
      } catch (err) {
        setError(err.response?.data?.message || 'Google sign-in failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError('Google login failed or was dismissed.');
    },
  });

  const handleGoogleClick = () => {
    if (!googleClientId || googleClientId.trim() === '' || googleClientId.includes('dummy')) {
      setError('Google Sign-In requires your Google Client ID. Please add VITE_GOOGLE_CLIENT_ID in client/.env (from Google Cloud Console).');
      return;
    }
    triggerGoogleLogin();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authService.login(loginForm);
      login(data.user, data.token);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.response?.data?.requiresOtp) {
        setPendingEmail(err.response.data.email || loginForm.email);
        setOtpStep(true);
        setOtpSuccess(err.response.data.message || 'Verification code sent to your email.');
        setOtpError('');
        setOtpTimer(60);
        setOtpValues(['', '', '', '', '', '']);
        return;
      }
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authService.register({
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
      });

      if (data.requiresOtp) {
        setPendingEmail(data.email || registerForm.email);
        setOtpStep(true);
        setOtpSuccess(data.message || 'Verification code sent to your email.');
        setOtpError('');
        setOtpTimer(60);
        setOtpValues(['', '', '', '', '', '']);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      login(data.user, data.token);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // OTP handlers
  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpValues];
      digits.forEach((d, i) => {
        newOtp[i] = d;
      });
      setOtpValues(newOtp);
      const nextIdx = Math.min(digits.length, 5);
      otpRefs.current[nextIdx]?.focus();
      return;
    }

    const clean = value.replace(/\D/g, '');
    const newOtp = [...otpValues];
    newOtp[index] = clean;
    setOtpValues(newOtp);

    if (clean && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const newOtp = [...otpValues];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtpValues(newOtp);
      const targetIdx = Math.min(pasted.length, 5);
      otpRefs.current[targetIdx]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const code = otpValues.join('');
    if (code.length < 6) {
      setOtpError('Please enter all 6 digits of the verification code.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const { data } = await authService.verifyOtp({
        email: pendingEmail,
        otp: code,
      });
      login(data.user, data.token);
      navigate(from, { replace: true });
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid code. Please check and try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const { data } = await authService.resendOtp({ email: pendingEmail });
      setOtpSuccess(data.message || 'New verification code sent to your email.');
      setOtpTimer(60);
      setOtpValues(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left panel */}
      <div className="auth-left">
        <div className="auth-left-bg" />
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#authLG)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="authLG" x1="2" y1="2" x2="22" y2="22">
                  <stop offset="0%" stopColor="#6C5CE7"/>
                  <stop offset="100%" stopColor="#00D4FF"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="auth-brand-name">Meiora <span className="gradient-text">AI</span></span>
        </div>
        <div className="auth-left-content">
          <h2 className="auth-left-title">
            Welcome to<br /><span className="gradient-text">Meiora AI</span>
          </h2>
          <p className="auth-left-sub">Intelligent News &amp; Sentiment Analysis</p>
          <p className="auth-left-desc">
            Detect fake news, understand brand sentiment<br />and make informed decisions using AI.
          </p>
          <div className="auth-features">
            {[
              { icon: '🧠', text: 'AI-Powered Analysis' },
              { icon: '⚡', text: 'Real-time Insights' },
              { icon: '🔒', text: 'Secure &amp; Reliable' },
            ].map((f) => (
              <div key={f.text} className="auth-feature-item">
                <span>{f.icon}</span>
                <span dangerouslySetInnerHTML={{ __html: f.text }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="auth-right">
        <div className="auth-card animate-scale-in">
          {otpStep ? (
            <div className="auth-otp-wrap animate-fade-in">
              <div className="auth-otp-badge">✉️</div>
              <h3 className="auth-otp-title">Verify Your Email</h3>
              <p className="auth-otp-desc">
                We sent a 6-digit verification code to<br />
                <span className="auth-otp-email">{pendingEmail}</span>
              </p>

              {otpSuccess && (
                <div className="auth-success animate-fade-in">
                  <span>✅</span> {otpSuccess}
                </div>
              )}

              {otpError && (
                <div className="auth-error animate-fade-in">
                  <span>⚠️</span> {otpError}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="auth-otp-actions">
                <div className="auth-otp-inputs" onPaste={handleOtpPaste}>
                  {otpValues.map((val, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      className="auth-otp-input"
                      value={val}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      disabled={otpLoading}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full btn-lg"
                  disabled={otpLoading || otpValues.join('').length < 6}
                >
                  {otpLoading ? <Spinner size="sm" color="white" /> : 'Verify & Continue'}
                </button>

                <div className="auth-otp-resend">
                  <span>Didn't receive code?</span>
                  <button
                    type="button"
                    className="auth-otp-resend-btn"
                    onClick={handleResendOtp}
                    disabled={otpTimer > 0 || otpLoading}
                  >
                    {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend Code'}
                  </button>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: '0.5rem', alignSelf: 'center' }}
                  onClick={() => {
                    setOtpStep(false);
                    setOtpError('');
                    setOtpSuccess('');
                  }}
                >
                  <MdArrowBack /> Back to Register
                </button>
              </form>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="tabs" style={{ marginBottom: '2rem' }}>
                <button
                  className={`tab-btn ${tab === 'login' ? 'active' : ''}`}
                  onClick={() => { setTab('login'); setError(''); }}
                >
                  Login
                </button>
                <button
                  className={`tab-btn ${tab === 'register' ? 'active' : ''}`}
                  onClick={() => { setTab('register'); setError(''); }}
                >
                  Register
                </button>
              </div>

              {/* Error */}
              {error && (
                <div className="auth-error animate-fade-in">
                  <span>⚠️</span> {error}
                </div>
              )}

          {/* Login Form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="auth-form">
              <div className="input-group">
                <label className="input-label">Email address</label>
                <div className="auth-input-wrap">
                  <MdEmail className="auth-input-icon" />
                  <input
                    type="email"
                    className="input-field auth-input"
                    placeholder="you@example.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="auth-input-wrap">
                  <MdLock className="auth-input-icon" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field auth-input"
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                  <button type="button" className="auth-pass-toggle" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
              </div>
              <div className="auth-row">
                <label className="auth-remember">
                  <input type="checkbox" /> Remember me
                </label>
                <a href="#" className="auth-forgot">Forgot password?</a>
              </div>
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <Spinner size="sm" color="white" /> : 'Login'}
              </button>
              <div className="divider">or</div>
              <button type="button" className="btn btn-ghost btn-full" onClick={handleGoogleClick} disabled={loading}>
                <FcGoogle style={{ fontSize: '1.15rem' }} />
                Continue with Google
              </button>
              <p className="auth-switch">
                Don't have an account?{' '}
                <button type="button" className="auth-switch-btn" onClick={() => { setTab('register'); setError(''); }}>
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* Register Form */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="auth-form">
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div className="auth-input-wrap">
                  <MdPerson className="auth-input-icon" />
                  <input
                    type="text"
                    className="input-field auth-input"
                    placeholder="Your full name"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Email address</label>
                <div className="auth-input-wrap">
                  <MdEmail className="auth-input-icon" />
                  <input
                    type="email"
                    className="input-field auth-input"
                    placeholder="you@example.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="auth-input-wrap">
                  <MdLock className="auth-input-icon" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field auth-input"
                    placeholder="Create a password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                    minLength={8}
                  />
                  <button type="button" className="auth-pass-toggle" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <MdVisibilityOff /> : <MdVisibility />}
                  </button>
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Confirm Password</label>
                <div className="auth-input-wrap">
                  <MdLock className="auth-input-icon" />
                  <input
                    type="password"
                    className="input-field auth-input"
                    placeholder="Confirm your password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <Spinner size="sm" color="white" /> : 'Create Account'}
              </button>
              <div className="divider">or</div>
              <button type="button" className="btn btn-ghost btn-full" onClick={handleGoogleClick} disabled={loading}>
                <FcGoogle style={{ fontSize: '1.15rem' }} />
                Continue with Google
              </button>
              <p className="auth-switch">
                Already have an account?{' '}
                <button type="button" className="auth-switch-btn" onClick={() => { setTab('login'); setError(''); }}>
                  Login
                </button>
              </p>
            </form>
          )}
        </>
      )}
    </div>
  </div>
    </div>
  );
};

export default AuthPage;
