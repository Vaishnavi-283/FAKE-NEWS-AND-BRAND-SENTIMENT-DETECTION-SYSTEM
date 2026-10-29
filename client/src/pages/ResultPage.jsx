import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  MdArrowBack, MdVerified, MdWarning, MdClose, MdSend,
  MdDownload, MdAutoAwesome, MdOpenInNew, MdCheckCircle,
  MdCancel, MdHelp, MdSmartToy,
} from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { useAnalysis } from '../context/AnalysisContext';
import { copilotService, reportsService, analysisService } from '../services/api';
import EmptyState from '../components/common/EmptyState';
import { Spinner } from '../components/common/Loader';
import './ResultPage.css';

/* ── Trust Score Ring ─────────────────────────────────── */
const TrustScoreRing = ({ score = 0 }) => {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? '#00C853' : score >= 40 ? '#FFA502' : '#FF4757';

  return (
    <div className="trust-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(108,92,231,0.1)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={radius}
          fill="none" stroke="url(#trustGrad)" strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
        <defs>
          <linearGradient id="trustGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6C5CE7" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
        </defs>
        <text x="70" y="64" textAnchor="middle" fill="#E8EAFF" fontSize="28" fontWeight="800"
          fontFamily="'Outfit', sans-serif">
          {score}%
        </text>
        <text x="70" y="82" textAnchor="middle" fill="#9BA3C8" fontSize="10">
          Trust Score
        </text>
      </svg>
    </div>
  );
};

/* ── Classification Badge ─────────────────────────────── */
const ClassBadge = ({ classification }) => {
  const map = {
    'Real':       { cls: 'badge-real',      icon: <MdCheckCircle />, label: 'Likely Real'    },
    'Fake':       { cls: 'badge-fake',      icon: <MdCancel />,      label: 'Likely Fake'    },
    'Unverified': { cls: 'badge-unverified',icon: <MdHelp />,        label: 'Unverified'     },
    'Misleading': { cls: 'badge-negative',  icon: <MdWarning />,     label: 'Misleading'     },
    'Positive':   { cls: 'badge-positive',  icon: <MdCheckCircle />, label: 'Positive'       },
    'Negative':   { cls: 'badge-negative',  icon: <MdCancel />,      label: 'Negative'       },
    'Neutral':    { cls: 'badge-neutral',   icon: <MdHelp />,        label: 'Neutral'        },
  };
  const info = map[classification] || map['Unverified'];
  return (
    <div className={`class-badge ${info.cls}`}>
      {info.icon}
      <span>{info.label}</span>
    </div>
  );
};

/* ── Brand Duel Arena ─────────────────────────────────── */
const BrandDuelArena = ({ comparison }) => {
  const { winner, winnerReason, brand1, brand2 } = comparison || {};
  const isB1Winner = winner && brand1?.name && winner.toLowerCase().includes(brand1.name.toLowerCase());
  const isB2Winner = winner && brand2?.name && winner.toLowerCase().includes(brand2.name.toLowerCase());

  return (
    <div className="glass-card brand-duel-arena animate-fade-in" style={{ marginBottom: '1.5rem', padding: '1.75rem', border: '1px solid rgba(108, 92, 231, 0.35)' }}>
      {/* Duel Banner */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <span style={{
          background: 'linear-gradient(135deg, #6C5CE7, #00D4FF)',
          color: '#ffffff',
          fontSize: '0.75rem',
          fontWeight: 800,
          padding: '4px 14px',
          borderRadius: '999px',
          letterSpacing: '1px',
          display: 'inline-block',
        }}>
          ⚔️ HEAD-TO-HEAD BRAND DUEL
        </span>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.75rem', color: 'var(--text-primary)' }}>
          {brand1?.name || 'Brand 1'} <span style={{ color: 'var(--accent-cyan)' }}>VS</span> {brand2?.name || 'Brand 2'}
        </h2>

        {winner && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 200, 83, 0.12)',
            border: '1px solid rgba(0, 200, 83, 0.4)',
            padding: '6px 18px',
            borderRadius: '999px',
            marginTop: '0.65rem'
          }}>
            <span style={{ fontSize: '1.15rem' }}>🏆</span>
            <span style={{ fontWeight: 800, color: '#00C853', fontSize: '0.95rem' }}>
              Winner: {winner}
            </span>
          </div>
        )}

        {winnerReason && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '580px', margin: '0.75rem auto 0', lineHeight: 1.5 }}>
            {winnerReason}
          </p>
        )}
      </div>

      {/* Duel Face-Off Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
        {/* Brand 1 Card */}
        <div style={{
          background: isB1Winner ? 'rgba(0, 200, 83, 0.06)' : 'rgba(255, 255, 255, 0.02)',
          border: isB1Winner ? '2px solid rgba(0, 200, 83, 0.5)' : '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{brand1?.name}</h3>
            {isB1Winner && <span style={{ fontSize: '1.3rem' }} title="Champion">👑</span>}
          </div>

          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-purple)', marginBottom: '0.5rem' }}>
            {brand1?.trustScore ?? 0}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Trust Score</span>
          </div>

          {brand1?.sentiment && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
              <span style={{ color: '#00C853' }}>+{brand1.sentiment.positive}% Pos</span>
              <span style={{ color: '#FFA502' }}>{brand1.sentiment.neutral}% Neu</span>
              <span style={{ color: '#FF4757' }}>-{brand1.sentiment.negative}% Neg</span>
            </div>
          )}

          {brand1?.strengths?.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00C853', marginBottom: '0.25rem' }}>✓ Key Strengths</p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {brand1.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {brand1?.weaknesses?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF4757', marginBottom: '0.25rem' }}>✗ Main Weaknesses</p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {brand1.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Brand 2 Card */}
        <div style={{
          background: isB2Winner ? 'rgba(0, 200, 83, 0.06)' : 'rgba(255, 255, 255, 0.02)',
          border: isB2Winner ? '2px solid rgba(0, 200, 83, 0.5)' : '1px solid var(--border-default)',
          borderRadius: '16px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>{brand2?.name}</h3>
            {isB2Winner && <span style={{ fontSize: '1.3rem' }} title="Champion">👑</span>}
          </div>

          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>
            {brand2?.trustScore ?? 0}% <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Trust Score</span>
          </div>

          {brand2?.sentiment && (
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>
              <span style={{ color: '#00C853' }}>+{brand2.sentiment.positive}% Pos</span>
              <span style={{ color: '#FFA502' }}>{brand2.sentiment.neutral}% Neu</span>
              <span style={{ color: '#FF4757' }}>-{brand2.sentiment.negative}% Neg</span>
            </div>
          )}

          {brand2?.strengths?.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00C853', marginBottom: '0.25rem' }}>✓ Key Strengths</p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {brand2.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {brand2?.weaknesses?.length > 0 && (
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FF4757', marginBottom: '0.25rem' }}>✗ Main Weaknesses</p>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {brand2.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Copilot Panel ────────────────────────────────────── */

const CopilotPanel = ({ result }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm your AI Copilot. I've analyzed the content and I'm ready to answer any questions about this ${result?.analysisType === 'brand' ? 'brand sentiment' : 'fact-check'} result. Ask me anything!`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const QUICK_QUESTIONS = [
    'Why is this result suspicious?',
    'What evidence supports this?',
    'Explain in simple words.',
    'Which official source confirms this?',
    'Summarize this result.',
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const q = text || input.trim();
    if (!q) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    try {
      const { data } = await copilotService.ask({
        question:   q,
        analysisId: result?._id,
        context:    result,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: err.response?.data?.message || 'Unable to get a response right now. The backend may not be connected yet.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="copilot-panel glass-card">
      <div className="copilot-header">
        <div className="copilot-header-left">
          <div className="copilot-icon"><MdSmartToy /></div>
          <div>
            <h3 className="copilot-title">AI Copilot</h3>
            <p className="copilot-sub">Ask questions about this analysis</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="copilot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`copilot-msg ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="copilot-avatar"><MdSmartToy /></div>
            )}
            <div className="copilot-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="copilot-msg assistant">
            <div className="copilot-avatar"><MdSmartToy /></div>
            <div className="copilot-bubble copilot-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div className="copilot-quick">
          <p className="copilot-quick-label">Quick questions:</p>
          <div className="copilot-quick-btns">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} className="copilot-quick-btn" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="copilot-input-row">
        <input
          className="input-field copilot-input"
          placeholder="Ask anything about this analysis…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={loading}
        />
        <button
          className="btn btn-primary copilot-send"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          {loading ? <Spinner size="sm" color="white" /> : <MdSend />}
        </button>
      </div>
    </div>
  );
};

/* ── Result Page ──────────────────────────────────────── */
const ResultPage = () => {
  const { id } = useParams();
  const { currentResult, setCurrentResult, isAnalyzing, analysisError, setAnalysisError } = useAnalysis();
  const [fetchingById, setFetchingById] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (id && (!currentResult || currentResult._id !== id)) {
      setFetchingById(true);
      analysisService.getById(id)
        .then(({ data }) => {
          setCurrentResult(data);
        })
        .catch((err) => {
          setAnalysisError(err.response?.data?.message || 'Report not found.');
        })
        .finally(() => {
          setFetchingById(false);
        });
    }
  }, [id]);

  /* Loading state */
  if (isAnalyzing || fetchingById) {
    return (
      <AppLayout title="Analysis Result">
        <div className="result-loading page-enter">
          <div className="result-loading-card glass-card">
            <div className="loader-ring" />
            <h2>Analyzing your content…</h2>
            <p>Searching for evidence, checking sources, and generating insights.</p>
            <div className="analysis-steps">
              {['Extracting key claims…', 'Searching official sources…', 'Comparing evidence…', 'Generating trust score…'].map((s, i) => (
                <div key={s} className="analysis-step animate-fade-in" style={{ animationDelay: `${i * 400}ms` }}>
                  <Spinner size="sm" /> {s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* Error state */
  if (analysisError) {
    return (
      <AppLayout title="Analysis Result">
        <div className="result-error-wrap page-enter">
          <EmptyState
            type="error"
            title="Analysis Failed"
            description={analysisError}
            action={
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Go Back</button>
                <Link to="/news-detection" className="btn btn-primary">Try Again</Link>
              </div>
            }
          />
        </div>
      </AppLayout>
    );
  }

  /* No result */
  if (!currentResult) {
    return (
      <AppLayout title="Analysis Result">
        <div className="result-error-wrap page-enter">
          <EmptyState
            type="no-results"
            title="No Analysis Available"
            description="Submit content to analyze first."
            action={
              <div style={{ display: 'flex', gap: '1rem' }}>
                <Link to="/news-detection"  className="btn btn-primary">Analyze News</Link>
                <Link to="/brand-sentiment" className="btn btn-secondary">Analyze Brand</Link>
              </div>
            }
          />
        </div>
      </AppLayout>
    );
  }

  const r = currentResult;
  const isNews = r.analysisType === 'news' || r.type === 'news';

  return (
    <AppLayout title="Analysis Result">
      <div className="result-page page-enter">
        {/* Back row */}
        <button className="btn btn-ghost btn-sm result-back" onClick={() => navigate(-1)}>
          <MdArrowBack /> Back
        </button>

        <div className="result-layout">
          {/* ── Left Column ── */}
          <div className="result-main">
            {/* If Brand Duel Comparison, show Head-to-Head Arena */}
            {r.comparison && <BrandDuelArena comparison={r.comparison} />}

            {/* Score + Classification (Standard) */}
            {!r.comparison && (
              <div className="glass-card result-score-card">
                <TrustScoreRing score={r.trustScore ?? r.score ?? 0} />
                <div className="result-score-info">
                  {r.classification && <ClassBadge classification={r.classification} />}
                  <div className="result-score-details">
                    <div className="result-detail-row">
                      <span className="result-detail-label">Classification</span>
                      <span className="result-detail-value">{r.classification || '—'}</span>
                    </div>
                    <div className="result-detail-row">
                      <span className="result-detail-label">Confidence</span>
                      <span className="result-detail-value">{r.confidence ? `${r.confidence}%` : '—'}</span>
                    </div>
                    {isNews && (
                      <div className="result-detail-row">
                        <span className="result-detail-label">Source verification</span>
                        <span className="result-detail-value result-detail-warn">Required</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Indicators */}
                {r.keyIndicators?.length > 0 && (
                  <div className="key-indicators">
                    <p className="key-indicators-title">Key Indicators</p>
                    {r.keyIndicators.map((ind, i) => (
                      <div key={i} className={`indicator-item ${ind.type}`}>
                        {ind.type === 'positive' ? <MdCheckCircle /> : ind.type === 'negative' ? <MdCancel /> : <MdHelp />}
                        {ind.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Verified Official Website Banner */}
            {r.officialWebsite && (
              <div
                className="glass-card result-section official-website-banner animate-fade-in"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(108, 92, 231, 0.08))',
                  border: '1px solid rgba(0, 212, 255, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1.25rem 1.5rem',
                  borderRadius: '14px',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(0, 212, 255, 0.15)',
                      color: 'var(--accent-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                    }}
                  >
                    🌐
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Verified Official Website & Store
                    </h4>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      {r.officialWebsite}
                    </p>
                  </div>
                </div>
                <a
                  href={r.officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                >
                  Visit Official Website <MdOpenInNew />
                </a>
              </div>
            )}

            {/* Source Analysis (News) */}
            {isNews && r.sourceAnalysis && (
              <div className="glass-card result-section">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Source Analysis</h3>
                <div className="source-analysis-table">
                  {Object.entries(r.sourceAnalysis).map(([key, val]) => (
                    <div key={key} className="source-row">
                      <span className="source-row-key">{key}</span>
                      <span className={`badge ${
                        val === 'High' ? 'badge-high' :
                        val === 'Low'  ? 'badge-low'  :
                        val === 'Consistent' ? 'badge-real' :
                        'badge-medium'
                      }`}>{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Explanation */}
            {r.explanation && (
              <div className="glass-card result-section">
                <div className="section-header" style={{ marginBottom: '0.875rem' }}>
                  <h3 className="section-title">AI Explanation</h3>
                  <MdAutoAwesome style={{ color: 'var(--accent-purple-l)' }} />
                </div>
                <p className="result-explanation">{r.explanation}</p>
              </div>
            )}

            {/* Sentiment (Brand) */}
            {!isNews && r.sentiment && (
              <div className="glass-card result-section">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Sentiment Breakdown</h3>
                {r.sentiment.positive != null && (
                  <div className="sentiment-bars">
                    {[
                      { label: 'Positive', value: r.sentiment.positive, color: 'var(--success)' },
                      { label: 'Negative', value: r.sentiment.negative, color: 'var(--danger)' },
                      { label: 'Neutral',  value: r.sentiment.neutral,  color: 'var(--warning)' },
                    ].map((s) => (
                      <div key={s.label} className="sentiment-bar-row">
                        <span className="sentiment-bar-label">{s.label}</span>
                        <div className="sentiment-bar-track">
                          <div
                            className="sentiment-bar-fill"
                            style={{ width: `${s.value}%`, background: s.color }}
                          />
                        </div>
                        <span className="sentiment-bar-val">{s.value}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Key Claims */}
            {r.keyClaims?.length > 0 && (
              <div className="glass-card result-section">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Key Claims</h3>
                <div className="key-claims-list">
                  {r.keyClaims.map((claim, i) => (
                    <div key={i} className="claim-item">
                      <span className="claim-num">{i + 1}</span>
                      <div className="claim-body">
                        <p className="claim-text">{claim.text || claim}</p>
                        {claim.status && (
                          <span className={`badge badge-${claim.status.toLowerCase()}`}>{claim.status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            {r.evidence?.length > 0 && (
              <div className="glass-card result-section">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Evidence</h3>
                <div className="evidence-list">
                  {r.evidence.map((ev, i) => (
                    <div key={i} className={`evidence-item evidence-${ev.supports ? 'supports' : 'contradicts'}`}>
                      <div className="evidence-icon">
                        {ev.supports ? <MdCheckCircle /> : <MdCancel />}
                      </div>
                      <div className="evidence-body">
                        <p className="evidence-text">{ev.text || ev.summary}</p>
                        {ev.source && (
                          <a href={ev.source} target="_blank" rel="noopener noreferrer" className="evidence-source">
                            <MdOpenInNew /> {ev.sourceName || ev.source}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sources */}
            {(r.officialSources?.length > 0 || r.newsSources?.length > 0) && (
              <div className="glass-card result-section">
                <h3 className="section-title" style={{ marginBottom: '1rem' }}>Sources</h3>
                {r.officialSources?.length > 0 && (
                  <>
                    <p className="sources-sub">Official Sources</p>
                    <div className="sources-list">
                      {r.officialSources.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="source-link">
                          <MdVerified style={{ color: 'var(--accent-cyan)' }} />
                          <span>{s.title || s.name || s.url}</span>
                          <MdOpenInNew style={{ marginLeft: 'auto', opacity: 0.5 }} />
                        </a>
                      ))}
                    </div>
                  </>
                )}
                {r.newsSources?.length > 0 && (
                  <>
                    <p className="sources-sub" style={{ marginTop: '1rem' }}>News Sources</p>
                    <div className="sources-list">
                      {r.newsSources.map((s, i) => (
                        <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="source-link">
                          <MdOpenInNew style={{ color: 'var(--accent-purple-l)' }} />
                          <span>{s.title || s.name || s.url}</span>
                          <MdOpenInNew style={{ marginLeft: 'auto', opacity: 0.5 }} />
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI Summary */}
            {r.summary && (
              <div className="glass-card result-section result-summary">
                <h3 className="section-title" style={{ marginBottom: '0.875rem' }}>AI Summary</h3>
                <p className="result-summary-text">{r.summary}</p>
              </div>
            )}

            {/* Download */}
            <button
              className="btn btn-secondary"
              onClick={async () => {
                if (!r._id) return;
                try {
                  const { data } = await reportsService.download(r._id);
                  const url = window.URL.createObjectURL(new Blob([data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `meiora-report-${r._id}.pdf`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (err) {
                  alert('Report download is available for saved analyses.');
                }
              }}
            >
              <MdDownload /> Download Report
            </button>
          </div>

          {/* ── Right Column: Copilot ── */}
          <div className="result-copilot">
            <CopilotPanel result={r} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ResultPage;
