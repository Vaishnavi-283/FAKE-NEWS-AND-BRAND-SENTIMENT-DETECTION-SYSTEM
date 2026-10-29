import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdBusiness, MdStar, MdAutoAwesome, MdSentimentSatisfiedAlt, MdCompareArrows } from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { analysisService } from '../services/api';
import { useAnalysis } from '../context/AnalysisContext';
import { Spinner } from '../components/common/Loader';
import { getSettings, sendPushNotification } from '../services/settingsService';
import './BrandSentimentPage.css';

const POPULAR_BRANDS = [
  { name: 'Apple',   emoji: '🍎' },
  { name: 'Nike',    emoji: '✔️' },
  { name: 'Samsung', emoji: '📱' },
  { name: 'Amazon',  emoji: '📦' },
  { name: 'Tesla',   emoji: '⚡' },
];

const POPULAR_DUELS = [
  { b1: 'Zomato', b2: 'Swiggy', label: 'Zomato 🍕 vs Swiggy 🍔' },
  { b1: 'Apple',  b2: 'Samsung', label: 'Apple 🍎 vs Samsung 📱' },
  { b1: 'Nike',   b2: 'Adidas',  label: 'Nike ✔️ vs Adidas 👟' },
  { b1: 'Tesla',  b2: 'BYD',     label: 'Tesla ⚡ vs BYD 🚗' },
];

const SENTIMENTS = [
  { icon: '😊', label: 'Positive' },
  { icon: '😐', label: 'Neutral' },
  { icon: '😠', label: 'Negative' },
];

const BrandSentimentPage = () => {
  const [tab, setTab] = useState('brand');
  const [brand, setBrand] = useState('');
  const [brand1, setBrand1] = useState('');
  const [brand2, setBrand2] = useState('');
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setCurrentResult, setIsAnalyzing, setAnalysisError } = useAnalysis();

  const handleAnalyze = async () => {
    setError('');
    setAnalysisError(null);
    if (tab === 'duel') {
      if (!brand1.trim() || !brand2.trim()) {
        setError('Please enter both brand names to start the duel.');
        return;
      }
    } else if (tab === 'brand' && !brand.trim()) {
      setError('Please enter a brand name.');
      return;
    } else if (tab === 'review' && !review.trim()) {
      setError('Please paste a review or comment.');
      return;
    }

    const settings = getSettings();
    const payload = {
      ...(tab === 'duel'
        ? { type: 'comparison', brand1: brand1.trim(), brand2: brand2.trim(), content: `${brand1.trim()} vs ${brand2.trim()}` }
        : tab === 'brand'
        ? { type: 'brand_name', content: brand.trim(), brand: brand.trim() }
        : { type: 'review',     content: review.trim(), brand: brand.trim() || 'General' }),
      autoSave: settings.autoSave,
      emailNotifications: settings.emailNotifications,
    };

    setLoading(true);
    setIsAnalyzing(true);
    try {
      const { data } = await analysisService.analyzeBrand(payload);
      setAnalysisError(null);
      setCurrentResult({ ...data, analysisType: 'brand' });
      sendPushNotification(`Brand Analysis Ready: ${data.title || 'Brand Sentiment'}`, {
        body: `Verdict: ${data.classification || 'Complete'} (Score: ${data.trustScore ?? 0}%)`,
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

  return (
    <AppLayout title="Brand Sentiment Analysis" subtitle="Analyze customer opinions, brand perception, and competitor duels.">
      <div className="brand-page page-enter">
        <div className="brand-layout">
          {/* Input Panel */}
          <div className="glass-card brand-panel">
            <div className="tabs" style={{ marginBottom: '1.5rem' }}>
              <button className={`tab-btn ${tab === 'brand' ? 'active' : ''}`} onClick={() => setTab('brand')}>
                <MdBusiness /> Brand Name
              </button>
              <button className={`tab-btn ${tab === 'duel' ? 'active' : ''}`} onClick={() => setTab('duel')}>
                <MdCompareArrows /> ⚔️ Brand Duel (VS)
              </button>
              <button className={`tab-btn ${tab === 'review' ? 'active' : ''}`} onClick={() => setTab('review')}>
                <MdStar /> Paste Review
              </button>
            </div>

            {error && (
              <div className="auth-error animate-fade-in" style={{ marginBottom: '1rem' }}>
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Brand Duel Tab */}
            {tab === 'duel' && (
              <div className="input-group">
                <label className="input-label">Competitor Duel Arena</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Brand 1 (e.g. Zomato)"
                    value={brand1}
                    onChange={(e) => setBrand1(e.target.value)}
                  />
                  <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '1.1rem', textAlign: 'center' }}>
                    VS
                  </span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Brand 2 (e.g. Swiggy)"
                    value={brand2}
                    onChange={(e) => setBrand2(e.target.value)}
                  />
                </div>
                <p className="input-hint">
                  Meiora AI will compare real public perception, customer ratings, strengths, and crown the winner!
                </p>

                {/* Trending Duel Chips */}
                <div style={{ marginTop: '1.25rem' }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    🔥 Trending Matchups
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {POPULAR_DUELS.map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        className="brand-chip"
                        onClick={() => { setBrand1(d.b1); setBrand2(d.b2); setTab('duel'); }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Brand Name Tab */}
            {tab === 'brand' && (
              <div className="input-group">
                <label className="input-label">Enter Brand Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <MdBusiness style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-muted)', fontSize: '1.1rem' }} />
                  <input
                    type="text"
                    className="input-field"
                    style={{ paddingLeft: '2.5rem' }}
                    placeholder="e.g. Apple, Nike, Samsung…"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
                <p className="input-hint">
                  We'll analyze public sentiment and reviews for this brand using real data.
                </p>
              </div>
            )}

            {/* Review Tab */}
            {tab === 'review' && (
              <>
                <div className="input-group">
                  <label className="input-label">Brand Name (optional)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Apple…"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label className="input-label">Review / Comment</label>
                  <textarea
                    className="input-field"
                    placeholder="Paste customer review, tweet, or comment here…"
                    rows={8}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                  />
                </div>
              </>
            )}

            <button
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: '1.5rem' }}
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? (
                <><Spinner size="sm" color="white" /> Analyzing…</>
              ) : (
                <><MdAutoAwesome /> {tab === 'duel' ? '⚔️ Start Brand Duel' : 'Analyze Sentiment'}</>
              )}
            </button>

            {/* Popular Brands */}
            <div style={{ marginTop: '1.75rem' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.875rem' }}>
                Popular Brands
              </p>
              <div className="popular-brands">
                {POPULAR_BRANDS.map((b) => (
                  <button
                    key={b.name}
                    className={`brand-chip ${brand === b.name ? 'active' : ''}`}
                    onClick={() => { setBrand(b.name); setTab('brand'); }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>{b.emoji}</span>
                    <span>{b.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Sentiment Illustration */}
          <div className="brand-illustration">
            <div className="glass-card illustration-card animate-float" style={{ gap: '1.25rem' }}>
              <div className="illustration-icon">📊</div>
              <h3>Understand what people really think.</h3>
              <p>Real sentiment from real reviews and public data.</p>

              <div className="sentiment-emojis">
                {SENTIMENTS.map((s) => (
                  <div key={s.label} className="sentiment-emoji-item">
                    <span className="sentiment-emoji">{s.icon}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'left' }}>What we analyze:</p>
                {['Customer reviews', 'Social media mentions', 'News coverage', 'Brand perception'].map((f) => (
                  <div key={f} className="illustration-feature">
                    <MdSentimentSatisfiedAlt style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }} />
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

export default BrandSentimentPage;
