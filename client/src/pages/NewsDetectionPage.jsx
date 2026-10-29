import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  MdArticle, MdLink, MdUploadFile, MdAutoAwesome,
  MdContentPaste, MdSend, MdClose,
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import AppLayout from '../components/layout/AppLayout';
import { analysisService } from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';
import { Spinner } from '../components/common/Loader';
import { getSettings, sendPushNotification } from '../services/settingsService';
import './NewsDetectionPage.css';

const SAMPLE_TOPICS = [
  { label: 'Tech',     sample: 'AI chatbots are replacing all jobs in 2026 according to latest government report.' },
  { label: 'Health',   sample: 'Miracle cure for all diseases discovered by scientists at WHO headquarters.' },
  { label: 'Politics', sample: 'Government rallying creates viral claims about new voter ID requirements.' },
];

const NewsDetectionPage = () => {
  const location = useLocation();
  const [tab, setTab] = useState('text');
  const [text, setText] = useState(location.state?.prefill || '');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { setCurrentResult, setIsAnalyzing, setAnalysisError } = useAnalysis();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.state?.prefill) {
      setText(location.state.prefill);
      setTab('text');
    }
  }, [location.state]);

  const handleAnalyze = async () => {
    setError('');
    setAnalysisError(null);
    const settings = getSettings();
    const payload = {
      autoSave: settings.autoSave,
      emailNotifications: settings.emailNotifications,
    };

    if (tab === 'text') {
      if (!text.trim()) { setError('Please paste or type some article content.'); return; }
      payload.type = 'text';
      payload.content = text.trim();
    } else if (tab === 'url') {
      if (!url.trim()) { setError('Please enter a URL.'); return; }
      payload.type = 'url';
      payload.content = url.trim();
    } else if (tab === 'file') {
      if (!file) { setError('Please upload a file.'); return; }
      // File upload handled via FormData
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'file');
      fd.append('autoSave', settings.autoSave);
      fd.append('emailNotifications', settings.emailNotifications);
      setLoading(true);
      setIsAnalyzing(true);
      try {
        const { data } = await analysisService.analyzeNews(fd);
        setAnalysisError(null);
        setCurrentResult({ ...data, analysisType: 'news' });
        sendPushNotification(`Fact-Check Complete: ${data.title || 'News Analysis'}`, {
          body: `Verdict: ${data.classification || 'Complete'} (Trust Score: ${data.trustScore ?? 0}%)`,
        });
        navigate('/result');
      } catch (err) {
        setAnalysisError(err.response?.data?.message || 'Analysis failed. Please try again.');
        navigate('/result');
      } finally {
        setLoading(false);
        setIsAnalyzing(false);
      }
      return;
    }

    setLoading(true);
    setIsAnalyzing(true);
    try {
      const { data } = await analysisService.analyzeNews(payload);
      setAnalysisError(null);
      setCurrentResult({ ...data, analysisType: 'news' });
      sendPushNotification(`Fact-Check Complete: ${data.title || 'News Analysis'}`, {
        body: `Verdict: ${data.classification || 'Complete'} (Trust Score: ${data.trustScore ?? 0}%)`,
      });
      navigate('/result');
    } catch (err) {
      setAnalysisError(err.response?.data?.message || 'Analysis failed. Please try again.');
      navigate('/result');
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSample = (sample) => {
    setTab('text');
    setText(sample);
  };

  return (
    <AppLayout title="Fake News Detection" subtitle="Analyze a news article and determine its credibility using AI.">
      <div className="detection-page page-enter">
        <div className="detection-layout">
          {/* Main Input Panel */}
          <div className="glass-card detection-panel">
            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: '1.5rem' }}>
              <button className={`tab-btn ${tab === 'text' ? 'active' : ''}`} onClick={() => setTab('text')}>
                <MdContentPaste /> Paste Article
              </button>
              <button className={`tab-btn ${tab === 'url' ? 'active' : ''}`} onClick={() => setTab('url')}>
                <MdLink /> Enter URL
              </button>
              <button className={`tab-btn ${tab === 'file' ? 'active' : ''}`} onClick={() => setTab('file')}>
                <MdUploadFile /> Upload File
              </button>
              <Link
                to="/rumor-buster"
                className="tab-btn"
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(37, 211, 102, 0.12)',
                  color: '#25D366',
                  borderColor: 'rgba(37, 211, 102, 0.35)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none'
                }}
              >
                <FaWhatsapp style={{ fontSize: '1.1rem' }} /> WhatsApp Rumor Buster →
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="auth-error animate-fade-in" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Text Tab */}
            {tab === 'text' && (
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <label className="input-label" style={{ margin: 0 }}>Article Content</label>
                  {location.state?.prefill && text === location.state.prefill && (
                    <span className="import-banner-pill animate-fade-in">
                      ✨ Imported from {location.state.source || 'Discover'}
                    </span>
                  )}
                </div>

                {location.state?.prefill && text === location.state.prefill && (
                  <div className="discovery-import-banner animate-fade-in">
                    <span className="import-banner-sparkle">✨</span>
                    <span className="import-banner-text">
                      Headline imported from <strong>{location.state.source || 'Trending Discoveries'}</strong>. Click <strong>Analyze News</strong> below to run AI fact-checking.
                    </span>
                  </div>
                )}

                <textarea
                  className="input-field detection-textarea"
                  placeholder="Paste the news article content here…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                />
                <p className="char-count">{text.length} characters</p>
              </div>
            )}

            {/* URL Tab */}
            {tab === 'url' && (
              <div className="input-group">
                <label className="input-label">Article / Social Media / YouTube URL</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <MdLink style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input
                    type="url"
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="https://example.com/article or YouTube URL…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <p className="input-hint">
                  Supports: news articles, social media posts, YouTube videos
                </p>
              </div>
            )}

            {/* File Tab */}
            {tab === 'file' && (
              <div
                className={`dropzone ${dragOver ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.pdf,.png,.jpg,.jpeg,.mp3,.mp4"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files[0])}
                />
                {file ? (
                  <div className="file-selected">
                    <MdUploadFile style={{ fontSize: '2rem', color: 'var(--accent-purple-l)' }} />
                    <div>
                      <p className="file-name">{file.name}</p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <MdClose />
                    </button>
                  </div>
                ) : (
                  <>
                    <MdUploadFile style={{ fontSize: '3rem', color: 'var(--text-muted)' }} />
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 'var(--fw-medium)' }}>
                      Drop file here or click to browse
                    </p>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Supports: PDF, TXT, JPG, PNG, MP3, MP4
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Analyze Button */}
            <button
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: '1.5rem' }}
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <><Spinner size="sm" color="white" /> Analyzing…</>
              ) : (
                <><MdAutoAwesome /> Analyze News</>
              )}
            </button>

            {/* Sample Topics */}
            <div style={{ marginTop: '1.5rem' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Or try a sample:
              </p>
              <div className="sample-chips">
                {SAMPLE_TOPICS.map((t) => (
                  <button
                    key={t.label}
                    className="sample-chip"
                    onClick={() => handleSample(t.sample)}
                  >
                    {t.label}
                    <span className="sample-chip-preview">{t.sample.slice(0, 40)}…</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Illustration Panel */}
          <div className="detection-illustration">
            <div className="illustration-card glass-card animate-float">
              <div className="illustration-icon">🛡️</div>
              <h3>Stop misinformation.</h3>
              <p>Get the real story.</p>
              <div className="illustration-features">
                {[
                  '🔍 Real evidence search',
                  '📊 Trust score analysis',
                  '🏛️ Official source check',
                  '⚖️ Claim comparison',
                ].map((f) => (
                  <div key={f} className="illustration-feature">
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default NewsDetectionPage;
