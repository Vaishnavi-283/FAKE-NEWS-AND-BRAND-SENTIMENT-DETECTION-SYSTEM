import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MdDarkMode, MdLightMode } from 'react-icons/md';
import { useTheme } from '../context/ThemeContext';
import './LandingPage.css';

const stats = [
  { value: '1.2K+', label: 'News Analyzed' },
  { value: '342',   label: 'Fake News Detected' },
  { value: '856',   label: 'Brands Analyzed' },
  { value: '92%',   label: 'Sentiment Accuracy' },
];

const steps = [
  {
    num: '1',
    title: 'Input',
    desc: 'Paste text, link, or upload your content.',
    color: 'var(--accent-purple)',
  },
  {
    num: '2',
    title: 'AI Analysis',
    desc: 'AI checks credibility and sentiment.',
    color: 'var(--accent-cyan)',
  },
  {
    num: '3',
    title: 'Get Results',
    desc: 'View detailed insights and reports.',
    color: 'var(--success)',
  },
];

const features = [
  { icon: '🧠', title: 'AI-Powered Analysis',   desc: 'Gemini AI analyzes content with deep understanding.' },
  { icon: '⚡', title: 'Real-Time Insights',     desc: 'Live evidence retrieved from trusted sources.' },
  { icon: '🔒', title: 'Secure & Reliable',      desc: 'Your data is encrypted and never stored unsafely.' },
];

const LandingPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const [heroInput, setHeroInput] = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowPrivacy(false);
    };
    if (showPrivacy) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrivacy]);

  return (
    <div className="landing">
      {/* ── Public Nav ─────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <div className="landing-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="url(#lg1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="lg1" x1="2" y1="2" x2="22" y2="22">
                  <stop offset="0%" stopColor="#6C5CE7"/>
                  <stop offset="100%" stopColor="#00D4FF"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="landing-logo-text">Meiora <span className="gradient-text">AI</span></span>
        </div>
        <ul className="landing-nav-links">
          <li><a href="#home">Home</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#about">About</a></li>
        </ul>
        <div className="landing-nav-actions">
          <button
            type="button"
            className="landing-theme-toggle-btn"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <MdLightMode style={{ color: '#FFD700', fontSize: '1.2rem' }} />
            ) : (
              <MdDarkMode style={{ color: 'var(--accent-purple)', fontSize: '1.2rem' }} />
            )}
          </button>
          <Link to="/auth" className="btn btn-primary btn-sm">Login</Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="hero" id="home">
        <div className="hero-bg-glow" />
        <div className="hero-content animate-fade-in">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            AI-Powered Fact Checking
          </div>
          <h1 className="hero-headline">
            Detect <span className="gradient-text">Fake News.</span><br />
            Understand <span className="text-cyan">Brand Sentiment.</span>
          </h1>
          <p className="hero-sub">
            AI-powered platform for analyzing news credibility<br />
            and public opinion.
          </p>
          <div className="hero-actions">
            <Link to="/auth" className="btn btn-primary btn-lg">
              <span>🔍</span> Analyze News
            </Link>
            <Link to="/auth" className="btn btn-secondary btn-lg">
              <span>📊</span> Analyze Brand
            </Link>
          </div>
        </div>

        {/* Floating AI card illustration */}
        <div className="hero-visual animate-float">
          <div className="hero-card-mockup">
            <div className="hero-card-header">
              <div className="hero-card-dots">
                <span style={{ background: 'var(--danger)' }} />
                <span style={{ background: 'var(--warning)' }} />
                <span style={{ background: 'var(--success)' }} />
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>AI Analysis</span>
            </div>
            <div className="hero-card-body">
              <div className="hero-score-ring">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(108,92,231,0.15)" strokeWidth="8"/>
                  <circle cx="40" cy="40" r="34" fill="none"
                    stroke="url(#scoreGrad)" strokeWidth="8"
                    strokeDasharray="213.6" strokeDashoffset="38"
                    strokeLinecap="round"
                    transform="rotate(-90 40 40)"
                  />
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6C5CE7"/>
                      <stop offset="100%" stopColor="#00D4FF"/>
                    </linearGradient>
                  </defs>
                  <text x="40" y="44" textAnchor="middle" fill="#E8EAFF" fontSize="14" fontWeight="700">82%</text>
                </svg>
              </div>
              <div className="badge badge-real" style={{ margin: '0 auto' }}>✓ Likely Real</div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {['Reliable language', 'Consistent info', 'Source verified'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>✓</span> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────── */}
      <section className="stats-bar animate-fade-in delay-300">
        {stats.map((s) => (
          <div key={s.label} className="stat-item">
            <span className="stat-value gradient-text">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </section>

      {/* ── How It Works ────────────────────────────────── */}
      <section className="how-it-works" id="how-it-works">
        <h2 className="section-center-title">How It Works</h2>
        <div className="steps-row">
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <div className="step-card animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="step-num" style={{ background: `${step.color}22`, border: `1px solid ${step.color}55`, color: step.color }}>
                  {step.num}
                </div>
                <div className="step-body">
                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.desc}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className="step-arrow">→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section className="features-section" id="features">
        <h2 className="section-center-title">Powered by AI</h2>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={f.title} className="feature-card glass-card animate-scale-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-glow" />
        <h2>Start Detecting Fake News Today</h2>
        <p>Join thousands of users who trust Meiora AI for fact-checking and brand analysis.</p>
        <Link to="/auth" className="btn btn-primary btn-lg">
          Get Started Free →
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="landing-footer" id="about">
        <div className="footer-brand">
          <span className="landing-logo-text">Meiora <span className="gradient-text">AI</span></span>
          <p>Better Decisions. Better Tomorrow.</p>
        </div>
        <ul className="footer-links">
          <li><a href="#home">Home</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#about">About</a></li>
          <li><a href="#privacy" onClick={(e) => { e.preventDefault(); setShowPrivacy(true); }}>Privacy</a></li>
        </ul>
        <div className="footer-social">
          <a href="#" aria-label="GitHub">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
          <a href="#" aria-label="LinkedIn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="#" aria-label="Twitter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </footer>

      {/* ── Privacy Policy Modal ───────────────────────── */}
      {showPrivacy && (
        <div className="privacy-modal-overlay animate-fade-in" onClick={() => setShowPrivacy(false)}>
          <div className="privacy-modal-card glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="privacy-modal-header">
              <div className="privacy-modal-title-row">
                <span className="privacy-modal-icon">🔒</span>
                <div>
                  <h3 className="privacy-modal-title">Privacy Policy</h3>
                  <p className="privacy-modal-sub">Meiora AI Data Protection &amp; User Privacy</p>
                </div>
              </div>
              <button
                className="privacy-close-btn"
                onClick={() => setShowPrivacy(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="privacy-modal-body">
              <div className="privacy-section">
                <h4>1. Purpose of the Platform</h4>
                <p>
                  Meiora AI is an evidence-grounded AI system designed to detect fake news, cross-reference public claims, and analyze public brand sentiment. We believe user trust starts with complete data privacy.
                </p>
              </div>

              <div className="privacy-section">
                <h4>2. Information We Process</h4>
                <ul>
                  <li><strong>Analyzed Content:</strong> Any news text, article links, YouTube URLs, or uploaded documents/images are processed solely to verify claims and compute credibility scores.</li>
                  <li><strong>Account Credentials:</strong> For registered users or Google OAuth 2.0 sign-ins, we only store your basic profile name and email to maintain your personal dashboard and history.</li>
                  <li><strong>Strict No-Sale Policy:</strong> We never sell, rent, or trade your personal information or submitted content to third-party advertisers.</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h4>3. AI &amp; Cloud Security</h4>
                <p>
                  Claim verification is powered by Google Gemini with live grounding against verified public news and web sources. Your user data is securely stored in MongoDB Atlas with TLS encryption in transit and at rest.
                </p>
              </div>

              <div className="privacy-section">
                <h4>4. Data Ownership &amp; Control</h4>
                <p>
                  You own your data. You can inspect your past verification history, download detailed PDF reports, or permanently delete any analysis record directly from your History dashboard at any time.
                </p>
              </div>
            </div>

            <div className="privacy-modal-footer">
              <button className="btn btn-primary btn-sm" onClick={() => setShowPrivacy(false)}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
