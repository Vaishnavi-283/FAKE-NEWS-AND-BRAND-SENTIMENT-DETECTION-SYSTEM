import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MdContentCopy, MdCheck, MdOpenInNew, MdWarningAmber,
  MdVerified, MdShare, MdAutoAwesome, MdSpeed,
  MdPsychology, MdSecurity, MdChat, MdRefresh,
  MdAttachFile, MdAddPhotoAlternate, MdClose
} from 'react-icons/md';
import { FaWhatsapp } from 'react-icons/fa';
import AppLayout from '../components/layout/AppLayout';
import { analysisService } from '../services/api';
import { Spinner } from '../components/common/Loader';
import { getSettings, sendPushNotification } from '../services/settingsService';
import './RumorBusterPage.css';

const PRESET_RUMORS = [
  {
    tag: '5G Free Recharge Scam',
    text: 'Urgent! Ministry of Telecommunications is offering FREE 500GB 5G recharge for 3 months to celebrate Digital India. Click this link: bit.ly/free-5g-recharge before tonight 12:00 AM! Forward to 5 groups to activate your free recharge instantly.',
  },
  {
    tag: 'NASA Cosmic Ray Panic',
    text: 'Tonight between 12:30 AM to 03:30 AM, dangerous cosmic rays will pass close to earth as per NASA emergency announcement. Please switch off your mobile phones and do not keep them near your body. Forward to all your family and loved ones immediately!',
  },
  {
    tag: 'UNESCO Best Anthem',
    text: 'Breaking News: UNESCO has just officially announced that India\'s National Anthem "Jana Gana Mana" has been declared the Best National Anthem in the world! Proud moment for every Indian. Share this as much as possible in all groups!',
  },
];

const RumorBusterPage = () => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeReplyTab, setActiveReplyTab] = useState('family');
  const [copied, setCopied] = useState(false);

  const handleSelectPreset = (presetText) => {
    setMessage(presetText);
    setFile(null);
    setFilePreview(null);
    setError('');
  };

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError('');
    if (selectedFile.type && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleReset = () => {
    setMessage('');
    handleRemoveFile();
    setResult(null);
    setError('');
  };

  const handleBustRumor = async (e) => {
    if (e) e.preventDefault();
    if (!message.trim() && !file) {
      setError('Please paste a forwarded message or upload a viral screenshot to fact-check.');
      return;
    }

    setError('');
    setLoading(true);
    const settings = getSettings();

    try {
      let data;
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        if (message.trim()) fd.append('message', message.trim());
        fd.append('autoSave', settings.autoSave);
        fd.append('emailNotifications', settings.emailNotifications);
        const res = await analysisService.analyzeRumor(fd);
        data = res.data;
      } else {
        const res = await analysisService.analyzeRumor({
          message: message.trim(),
          autoSave: settings.autoSave,
          emailNotifications: settings.emailNotifications,
        });
        data = res.data;
      }

      setResult(data);

      sendPushNotification(
        'WhatsApp Rumor Debunked',
        `Fact-Check complete: ${data.title || 'Viral Message'} — Verdict: ${data.classification}`
      );
    } catch (err) {
      console.error('Rumor buster error:', err);
      setError(err.response?.data?.message || 'Failed to analyze rumor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getActiveReplyText = () => {
    if (!result?.replies) return '';
    if (activeReplyTab === 'family') return result.replies.family || '';
    if (activeReplyTab === 'direct') return result.replies.direct || '';
    if (activeReplyTab === 'tamil')  return result.replies.tamil || '';
    return result.replies.family || '';
  };

  const handleCopyReply = () => {
    const text = getActiveReplyText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsAppShare = () => {
    const text = getActiveReplyText();
    if (!text) return;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getClassificationBadgeClass = (classification = '') => {
    const c = classification.toLowerCase();
    if (c === 'fake' || c === 'misleading') return 'rumor-badge-fake';
    if (c === 'real') return 'rumor-badge-real';
    return 'rumor-badge-unverified';
  };

  return (
    <AppLayout
      title="WhatsApp Rumor Buster"
      subtitle="Expose viral forwards, detect psychological panic triggers, and get 1-click group replies in English & தமிழ்."
    >
      <div className="rumor-page page-enter">
        {/* Top Header Card */}
        <div className="glass-card rumor-hero-card">
          <div className="rumor-hero-left">
            <div className="rumor-hero-badge">
              <FaWhatsapp className="rumor-whatsapp-icon" />
              <span>VIRALITY INTELLIGENCE ENGINE</span>
            </div>
            <h2 className="rumor-hero-title">
              Stop Viral Misinformation in Family & Social Groups
            </h2>
            <p className="rumor-hero-desc">
              Paste forwarded messages, fake schemes, or panicky rumors. Meiora AI analyzes deceptive psychological triggers, verifies facts against official databases, and equips you with polite, ready-to-send group replies.
            </p>
          </div>
          <div className="rumor-hero-stats">
            <div className="rumor-stat-box">
              <span className="rumor-stat-num">3</span>
              <span className="rumor-stat-label">Multi-Tone Replies</span>
            </div>
            <div className="rumor-stat-box">
              <span className="rumor-stat-num">⚡ Instant</span>
              <span className="rumor-stat-label">Debunk Output</span>
            </div>
            <div className="rumor-stat-box">
              <span className="rumor-stat-num">தமிழ்</span>
              <span className="rumor-stat-label">Native Tamil Reply</span>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="rumor-presets-wrap">
          <span className="rumor-presets-title">Try Viral Examples:</span>
          <div className="rumor-presets-list">
            {PRESET_RUMORS.map((p) => (
              <button
                key={p.tag}
                type="button"
                className="rumor-preset-btn"
                onClick={() => handleSelectPreset(p.text)}
              >
                <span>🔥</span> {p.tag}
              </button>
            ))}
          </div>
        </div>

        {/* WhatsApp Chat Simulator Card */}
        <div className="glass-card whatsapp-simulator-card">
          <div className="wa-sim-topbar">
            <div className="wa-sim-avatar">
              <FaWhatsapp />
            </div>
            <div className="wa-sim-header-info">
              <h4 className="wa-sim-contact-name">Forwarded Rumor Inspector</h4>
              <p className="wa-sim-status">
                <span className="wa-status-dot" /> Online • AI Fact-Check Simulator
              </p>
            </div>
            <button
              type="button"
              className="wa-sim-clear-btn"
              onClick={handleReset}
              title="Clear message and attachment"
            >
              <MdRefresh /> Reset
            </button>
          </div>

          <div
            className={`wa-sim-chat-area ${dragOver ? 'drag-over' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {dragOver && (
              <div className="wa-drag-overlay">
                <MdAddPhotoAlternate className="wa-drag-icon" />
                <p>Drop your viral WhatsApp screenshot or image here</p>
              </div>
            )}

            <div className="wa-bubble incoming">
              <div className="wa-forwarded-tag">
                <span className="wa-forwarded-arrow">↗</span> Forwarded many times
              </div>

              {/* Uploaded Screenshot / File Preview */}
              {file && (
                <div className="wa-attachment-card">
                  {filePreview ? (
                    <div className="wa-attachment-media">
                      <img src={filePreview} alt="Screenshot" className="wa-attachment-thumb" />
                    </div>
                  ) : (
                    <div className="wa-attachment-doc-icon">
                      <MdAttachFile />
                    </div>
                  )}
                  <div className="wa-attachment-info">
                    <span className="wa-attachment-filename">{file.name}</span>
                    <span className="wa-attachment-filesize">
                      {(file.size / 1024).toFixed(1)} KB • {file.type.startsWith('image/') ? 'Image Screenshot' : 'Text File'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="wa-attachment-remove-btn"
                    onClick={handleRemoveFile}
                    title="Remove attachment"
                  >
                    <MdClose />
                  </button>
                </div>
              )}

              <textarea
                className="wa-message-input"
                rows={4}
                placeholder={file ? "Add optional context or note about this screenshot..." : "Paste the forwarded message, rumor, or panic claim here, or attach a screenshot below…"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="wa-bubble-footer">
                <span className="wa-char-count">{message.length} characters {file ? '• 📎 1 attachment' : ''}</span>
                <span className="wa-time-stamp">Just now ✓✓</span>
              </div>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp,image/jpg,.txt"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {error && (
            <div className="rumor-error-alert animate-fade-in">
              <MdWarningAmber /> {error}
            </div>
          )}

          <div className="wa-sim-actions">
            <div className="wa-sim-attach-group">
              <button
                type="button"
                className="btn btn-ghost btn-sm wa-tool-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <MdAddPhotoAlternate style={{ color: '#25D366' }} /> Upload Screenshot
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm wa-tool-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <MdAttachFile style={{ color: '#00D4FF' }} /> Attach File
              </button>
            </div>

            <button
              type="button"
              className="btn btn-whatsapp btn-lg"
              onClick={handleBustRumor}
              disabled={loading || (!message.trim() && !file)}
            >
              {loading ? (
                <>
                  <Spinner size="sm" color="white" />
                  <span>Busting Rumor & Generating Replies…</span>
                </>
              ) : (
                <>
                  <MdAutoAwesome />
                  <span>Bust Rumor Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="rumor-result-container animate-fade-in">
            {/* Verdict Overview Card */}
            <div className="glass-card rumor-verdict-card">
              <div className="rumor-verdict-header">
                <div>
                  <span className={`rumor-classification-badge ${getClassificationBadgeClass(result.classification)}`}>
                    {result.classification === 'Fake' ? '🚨 DEBUNKED FAKE' :
                     result.classification === 'Misleading' ? '⚠️ MISLEADING CLAIM' :
                     result.classification === 'Real' ? '✅ VERIFIED AUTHENTIC' : '❓ UNVERIFIED RUMOR'}
                  </span>
                  <h3 className="rumor-result-title">{result.title}</h3>
                </div>
                <div className="rumor-scores-group">
                  <div className="rumor-score-pill">
                    <span className="rumor-score-val">{result.trustScore}%</span>
                    <span className="rumor-score-lbl">Trust Score</span>
                  </div>
                  <div className="rumor-score-pill panic">
                    <span className="rumor-score-val">{result.viralityScore || 85}/100</span>
                    <span className="rumor-score-lbl">Panic Virality</span>
                  </div>
                </div>
              </div>

              {/* Emotional Triggers */}
              {result.emotionalTriggers?.length > 0 && (
                <div className="rumor-triggers-row">
                  <span className="triggers-label">
                    <MdPsychology /> Psychological Triggers Detected:
                  </span>
                  <div className="triggers-tags">
                    {result.emotionalTriggers.map((t, i) => (
                      <span key={i} className="trigger-chip">
                        ⚡ {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Debunk Summary */}
              {result.summary && (
                <div className="rumor-debunk-summary-box">
                  <p className="debunk-summary-text">
                    <strong>Fact-Check Core Verdict:</strong> {result.summary}
                  </p>
                </div>
              )}
            </div>

            {/* 1-Click WhatsApp Debunk Reply Hub */}
            <div className="glass-card rumor-reply-hub">
              <div className="reply-hub-header">
                <div className="reply-hub-title-wrap">
                  <FaWhatsapp className="reply-hub-icon" />
                  <div>
                    <h3 className="reply-hub-title">1-Click WhatsApp Group Replies</h3>
                    <p className="reply-hub-sub">Select the appropriate tone to paste directly into your groups.</p>
                  </div>
                </div>
              </div>

              {/* Tone Tabs */}
              <div className="reply-tabs">
                <button
                  type="button"
                  className={`reply-tab-btn ${activeReplyTab === 'family' ? 'active' : ''}`}
                  onClick={() => setActiveReplyTab('family')}
                >
                  <span>👨‍👩‍👧</span> Family / Elders Group
                </button>
                <button
                  type="button"
                  className={`reply-tab-btn ${activeReplyTab === 'direct' ? 'active' : ''}`}
                  onClick={() => setActiveReplyTab('direct')}
                >
                  <span>⚡</span> Direct Alert Debunk
                </button>
                <button
                  type="button"
                  className={`reply-tab-btn ${activeReplyTab === 'tamil' ? 'active' : ''}`}
                  onClick={() => setActiveReplyTab('tamil')}
                >
                  <span>🌐</span> தமிழ் மொழி பதில் (Tamil)
                </button>
              </div>

              {/* Reply Preview Box */}
              <div className="reply-preview-box">
                <div className="reply-bubble">
                  <p className="reply-bubble-text">{getActiveReplyText()}</p>
                </div>
                <div className="reply-actions-row">
                  <button
                    type="button"
                    className={`btn ${copied ? 'btn-success' : 'btn-primary'} btn-sm reply-copy-btn`}
                    onClick={handleCopyReply}
                  >
                    {copied ? <><MdCheck /> Copied to Clipboard!</> : <><MdContentCopy /> Copy WhatsApp Reply</>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-whatsapp-subtle btn-sm"
                    onClick={handleOpenWhatsAppShare}
                    title="Send via WhatsApp Web"
                  >
                    <FaWhatsapp /> Share to WhatsApp <MdOpenInNew />
                  </button>
                </div>
              </div>
            </div>

            {/* Forensic Proof & Official Sources */}
            <div className="rumor-details-grid">
              {/* Claims Breakdown */}
              {result.keyClaims?.length > 0 && (
                <div className="glass-card rumor-subcard">
                  <h4 className="rumor-subcard-title">
                    <MdSecurity /> Key False Claims Checked
                  </h4>
                  <ul className="rumor-claims-list">
                    {result.keyClaims.map((c, i) => (
                      <li key={i} className="rumor-claim-item">
                        <span className="claim-bullet">✗</span>
                        <div>
                          <p className="claim-text">{c.text}</p>
                          <span className="claim-status-tag">{c.status || 'False'}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Official Sources & Citations */}
              {result.officialSources?.length > 0 && (
                <div className="glass-card rumor-subcard">
                  <h4 className="rumor-subcard-title">
                    <MdVerified /> Verified Official Citations
                  </h4>
                  <div className="rumor-sources-list">
                    {result.officialSources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rumor-source-link"
                      >
                        <span className="source-dot" />
                        <span className="source-name">{s.title || 'Official Government Fact-Check'}</span>
                        <MdOpenInNew className="source-arrow" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Full Explanation */}
            {result.explanation && (
              <div className="glass-card rumor-explanation-card">
                <h4 className="rumor-subcard-title">Forensic Truth Explanation</h4>
                <p className="rumor-explanation-text">{result.explanation}</p>
                <div className="rumor-result-footer">
                  <Link to={`/result/${result._id}`} className="btn btn-ghost btn-sm">
                    Open Full Detailed Intelligence Report →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RumorBusterPage;
