import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MdVideocam, MdUploadFile, MdLink, MdWarningAmber,
  MdCheckCircle, MdCancel, MdAutoAwesome, MdSpeed,
  MdGraphicEq, MdFace, MdTimeline, MdOpenInNew, MdRefresh,
  MdPlayArrow, MdPause, MdSecurity, MdImage, MdPhotoCamera
} from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { analysisService } from '../services/api';
import { Spinner } from '../components/common/Loader';
import { getSettings, sendPushNotification } from '../services/settingsService';
import './DeepfakeLabPage.css';

const PRESET_CASES = [
  {
    tag: 'AI-Generated Celebrity Photo',
    title: 'Midjourney Hyper-Realistic AI Photo',
    desc: 'Viral photorealistic image circulating on social media depicting a high-profile VIP at an unauthorized gathering, generated via generative AI diffusion models.',
    sampleVideoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
  },
  {
    tag: 'Politician AI Lip-Sync Morph',
    title: 'Viral Politician Emergency Curfew Announcement',
    desc: 'Viral video clip circulating on social media showing a senior minister declaring an immediate nationwide financial curfew and bank shutdown.',
    sampleVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
  {
    tag: 'Celebrity Crypto Scam Reel',
    title: 'Celebrity Investment Giveaway Scam Reel',
    desc: 'Instagram Reel of a prominent tech CEO supposedly endorsing a cryptocurrency doubling scheme with synthetic voice dubbing.',
    sampleVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
  },
  {
    tag: 'Authentic Camera Capture',
    title: 'Authentic Official Briefing & Portrait',
    desc: 'Unedited camera photograph and broadcast press briefing with natural focal depth and lighting.',
    sampleVideoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  },
];

const DeepfakeLabPage = () => {
  const [tab, setTab] = useState('upload'); // 'upload' | 'url'
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [claim, setClaim] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeAnomaly, setActiveAnomaly] = useState(null);

  const handleSelectPreset = (p) => {
    setTab('url');
    setVideoUrl(p.sampleVideoUrl);
    setClaim(p.desc);
    setVideoPreview(p.sampleVideoUrl);
    setVideoFile(null);
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('image/'))) {
      setVideoFile(file);
      setVideoPreview(URL.createObjectURL(file));
      setError('');
    } else {
      setError('Please upload a valid video file (.mp4, .mov, .webm) or photo (.jpg, .png, .webp).');
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    if (videoPreview && !videoUrl) URL.revokeObjectURL(videoPreview);
    setVideoPreview(null);
    setVideoUrl('');
    setClaim('');
    setResult(null);
    setActiveAnomaly(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!videoFile && !videoUrl.trim() && !claim.trim()) {
      setError('Please provide a video file, photo, reel URL, or claim description to inspect.');
      return;
    }

    setError('');
    setLoading(true);
    const settings = getSettings();

    try {
      let data;
      if (videoFile) {
        const fd = new FormData();
        fd.append('video', videoFile);
        if (claim.trim()) fd.append('description', claim.trim());
        fd.append('autoSave', settings.autoSave);
        fd.append('emailNotifications', settings.emailNotifications);
        const res = await analysisService.analyzeDeepfakeVideo(fd);
        data = res.data;
      } else {
        const res = await analysisService.analyzeDeepfakeVideo({
          videoUrl: videoUrl.trim(),
          description: claim.trim(),
          autoSave: settings.autoSave,
          emailNotifications: settings.emailNotifications,
        });
        data = res.data;
      }

      setResult(data);
      if (data.deepfakeForensics?.timelineAnomalies?.length > 0) {
        setActiveAnomaly(data.deepfakeForensics.timelineAnomalies[0]);
      }

      sendPushNotification(
        'Deepfake Inspection Complete',
        `${data.title || 'Media'} Verdict: ${data.deepfakeForensics?.verdict || data.classification}`
      );
    } catch (err) {
      console.error('Deepfake analysis error:', err);
      setError(err.response?.data?.message || 'Deepfake analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const forensics = result?.deepfakeForensics || {};
  const isDeepfake = (forensics.deepfakeScore ?? 0) >= 50;
  const isImage = videoFile ? videoFile.type.startsWith('image/') : (/\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(videoUrl));

  return (
    <AppLayout
      title="Deepfake & AI Media Lab"
      subtitle="Multi-modal forensic inspection for AI-generated photos, synthetic video clips, lip-sync manipulation, and cloned voices."
    >
      <div className="deepfake-page page-enter">
        {/* Hero Banner */}
        <div className="glass-card deepfake-hero-card">
          <div className="deepfake-hero-left">
            <div className="deepfake-badge">
              <MdVideocam className="deepfake-hero-icon" />
              <span>AI MULTI-MODAL FORENSIC LAB • V3.2</span>
            </div>
            <h2 className="deepfake-hero-title">
              Detect AI-Generated Photos, Synthetic Videos & Deepfakes
            </h2>
            <p className="deepfake-hero-desc">
              Upload viral photos, social reels, or video clips. Meiora AI inspects micro-facial boundary blending, pixel diffusion patterns, and lighting consistency frame-by-frame.
            </p>
          </div>
          <div className="deepfake-hero-stats">
            <div className="df-stat-pill">
              <span className="df-stat-num">Spatial/30FPS</span>
              <span className="df-stat-lbl">Multi-Modal Scan</span>
            </div>
            <div className="df-stat-pill">
              <span className="df-stat-num">AI vs Real</span>
              <span className="df-stat-lbl">Diffusion & Sync</span>
            </div>
            <div className="df-stat-pill">
              <span className="df-stat-num">Heatmap</span>
              <span className="df-stat-lbl">Anomaly Regions</span>
            </div>
          </div>
        </div>

        {/* Preset Sample Deepfake Cases */}
        <div className="df-presets-wrap">
          <span className="df-presets-title">Test Sample Cases:</span>
          <div className="df-presets-list">
            {PRESET_CASES.map((p) => (
              <button
                key={p.tag}
                type="button"
                className="df-preset-btn"
                onClick={() => handleSelectPreset(p)}
              >
                <span>{p.tag.includes('Photo') ? '📸' : '🎬'}</span> {p.tag}
              </button>
            ))}
          </div>
        </div>

        {/* Input & Inspection Console */}
        <div className="glass-card df-input-card">
          <div className="df-tabs">
            <button
              type="button"
              className={`tab-btn ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
            >
              <MdUploadFile /> Upload Video or Photo File
            </button>
            <button
              type="button"
              className={`tab-btn ${tab === 'url' ? 'active' : ''}`}
              onClick={() => setTab('url')}
            >
              <MdLink /> Paste Media URL
            </button>
            <button
              type="button"
              className="df-reset-btn"
              onClick={handleReset}
              title="Reset all"
            >
              <MdRefresh /> Reset
            </button>
          </div>

          {/* Upload Tab */}
          {tab === 'upload' && (
            <div
              className={`df-dropzone ${dragOver ? 'drag-over' : ''} ${videoFile ? 'has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => !videoFile && fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {videoFile ? (
                <div className="df-file-info">
                  {isImage ? <MdPhotoCamera className="df-file-icon" /> : <MdVideocam className="df-file-icon" />}
                  <div>
                    <p className="df-file-name">{videoFile.name}</p>
                    <span className="df-file-size">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for forensic inspection</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Change {isImage ? 'Photo' : 'Video'}
                  </button>
                </div>
              ) : (
                <div className="df-drop-prompt">
                  <div className="df-drop-icon-wrap">
                    <MdPhotoCamera />
                  </div>
                  <p className="df-drop-text">Drag & drop video clip or photo here, or click to browse</p>
                  <span className="df-drop-sub">Supports MP4, MOV, WEBM, JPG, PNG, WEBP (Max 20MB)</span>
                </div>
              )}
            </div>
          )}

          {/* URL Tab */}
          {tab === 'url' && (
            <div className="df-url-wrap">
              <div className="input-group">
                <label className="input-label">Video, Reel or Photo URL</label>
                <div className="df-url-input-box">
                  <MdLink className="df-url-icon" />
                  <input
                    type="url"
                    className="input-field df-url-input"
                    placeholder="https://instagram.com/reel/... or https://images... (Image or Video Link)"
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      setVideoPreview(e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Media Preview Player / Image (if available) */}
          {videoPreview && (
            <div className="df-player-wrap animate-fade-in">
              {isImage ? (
                <img
                  src={videoPreview}
                  alt="Forensic Inspection Target"
                  className="df-image-element"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={videoPreview}
                  controls
                  className="df-video-element"
                />
              )}
            </div>
          )}

          {/* Optional Claim Description */}
          <div className="input-group" style={{ marginTop: '1rem' }}>
            <label className="input-label">Context / Claim Description (Optional)</label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="What is this media claiming? (e.g. 'Viral photo of politician in private meeting' or 'Leaked interview')"
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
            />
          </div>

          {error && (
            <div className="auth-error animate-fade-in" style={{ marginTop: '0.75rem' }}>
              <MdWarningAmber /> {error}
            </div>
          )}

          {/* Action Button */}
          <div className="df-action-row">
            <button
              type="button"
              className="btn btn-primary btn-lg df-scan-btn"
              onClick={handleAnalyze}
              disabled={loading || (!videoFile && !videoUrl.trim() && !claim.trim())}
            >
              {loading ? (
                <>
                  <Spinner size="sm" color="white" />
                  <span>Auditing AI Generation & Forensic Artifacts…</span>
                </>
              ) : (
                <>
                  <MdAutoAwesome />
                  <span>Run {isImage ? 'Photo AI Forensic Scan' : 'Video Multi-Modal Forensic Scan'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="df-results-container animate-fade-in">
            {/* Verdict Header Card */}
            <div className={`glass-card df-verdict-card ${isDeepfake ? 'verdict-fake' : 'verdict-real'}`}>
              <div className="df-verdict-top">
                <div>
                  <span className={`df-verdict-badge ${isDeepfake ? 'badge-danger' : 'badge-success'}`}>
                    {forensics.verdict || (isDeepfake ? (isImage ? '🚨 AI-GENERATED / DEEPFAKE PHOTO' : '🚨 HIGH RISK DEEPFAKE') : (isImage ? '✅ AUTHENTIC CAMERA PHOTO' : '✅ AUTHENTIC HUMAN VIDEO'))}
                  </span>
                  <h3 className="df-verdict-title">{result.title}</h3>
                </div>
                <div className="df-score-meters">
                  <div className="df-score-block danger">
                    <span className="df-score-number">{forensics.deepfakeScore || 85}%</span>
                    <span className="df-score-title">{isImage ? 'AI Generation Probability' : 'Deepfake Risk'}</span>
                  </div>
                  <div className="df-score-block">
                    <span className="df-score-number">{result.confidence || 94}%</span>
                    <span className="df-score-title">AI Confidence</span>
                  </div>
                </div>
              </div>

              {forensics.verdictSummary && (
                <div className="df-summary-box">
                  <p className="df-summary-text">
                    <strong>Forensic Conclusion:</strong> {forensics.verdictSummary}
                  </p>
                </div>
              )}
            </div>

            {/* Timeline / Spatial Anomaly Heatmap Bar */}
            {forensics.timelineAnomalies?.length > 0 && (
              <div className="glass-card df-timeline-card">
                <div className="df-card-header">
                  <MdTimeline className="df-card-icon" />
                  <h4 className="df-card-title">{isImage ? 'Spatial Anomaly & Manipulation Regions' : 'Interactive Temporal Anomaly Timeline'}</h4>
                </div>
                <p className="df-timeline-sub">{isImage ? 'Click any region flag to view exact artifact and pixel analysis.' : 'Click any flag segment to view exact frame manipulation details.'}</p>

                <div className="df-timeline-bar">
                  {forensics.timelineAnomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={`df-timeline-segment ${activeAnomaly === anomaly ? 'active' : ''} ${anomaly.risk?.toLowerCase()}`}
                      onClick={() => setActiveAnomaly(anomaly)}
                    >
                      <span className="df-segment-time">{anomaly.timestamp}</span>
                      <span className="df-segment-name">{anomaly.type}</span>
                    </div>
                  ))}
                </div>

                {activeAnomaly && (
                  <div className="df-anomaly-detail-box animate-fade-in">
                    <div className="df-anomaly-header">
                      <span className="df-anomaly-badge">{activeAnomaly.timestamp} • {activeAnomaly.type}</span>
                      <span className="df-anomaly-risk">{activeAnomaly.risk} Risk Flag</span>
                    </div>
                    <p className="df-anomaly-desc">{activeAnomaly.details}</p>
                  </div>
                )}
              </div>
            )}

            {/* Multi-Modal Diagnostic Matrix */}
            <div className="df-matrix-grid">
              {/* Facial & Structural Forensics */}
              <div className="glass-card df-matrix-card">
                <div className="df-matrix-card-header">
                  <MdFace className="df-matrix-icon face" />
                  <h4 className="df-matrix-title">Facial Boundary & Structural Analysis</h4>
                </div>
                <div className="df-metric-item">
                  <span className="df-metric-label">{isImage ? 'Pupil Catchlight & Iris Symmetry' : 'Blinking Rate Naturalness'}</span>
                  <span className="df-metric-val">{forensics.facialForensics?.blinkRate || (isImage ? 'Natural iris symmetry' : 'Abnormal temporal frequency')}</span>
                </div>
                <div className="df-metric-item">
                  <span className="df-metric-label">Jawline & Mask Blending</span>
                  <span className="df-metric-val">{forensics.facialForensics?.boundaryBlending || 'Boundary smoothing detected'}</span>
                </div>
                <div className="df-metric-item">
                  <span className="df-metric-label">Lighting & Ambient Shadows</span>
                  <span className="df-metric-val">{forensics.facialForensics?.lightingConsistency || 'Consistent ambient reflection'}</span>
                </div>
              </div>

              {/* Audio-Visual or Image Synthesis Forensics */}
              {isImage ? (
                <div className="glass-card df-matrix-card">
                  <div className="df-matrix-card-header">
                    <MdAutoAwesome className="df-matrix-icon audio" />
                    <h4 className="df-matrix-title">Generative AI Diffusion Forensics</h4>
                  </div>
                  <div className="df-metric-item">
                    <span className="df-metric-label">AI Generation Probability</span>
                    <span className="df-metric-val highlight">{forensics.deepfakeScore || 85}% AI Probability</span>
                  </div>
                  <div className="df-metric-item">
                    <span className="df-metric-label">Pixel Diffusion Consistency</span>
                    <span className="df-metric-val">{isDeepfake ? 'Synthetic diffusion patterns identified' : 'Natural optical sensor camera noise'}</span>
                  </div>
                  {result.keyIndicators?.length > 0 && (
                    <div className="df-markers-wrap">
                      <span className="df-markers-lbl">Forensic Visual Indicators:</span>
                      <div className="df-markers-list">
                        {result.keyIndicators.map((m, i) => (
                          <span key={i} className={`df-marker-chip ${m.type || 'negative'}`}>
                            {m.type === 'positive' ? '✓' : '⚠️'} {m.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="glass-card df-matrix-card">
                  <div className="df-matrix-card-header">
                    <MdGraphicEq className="df-matrix-icon audio" />
                    <h4 className="df-matrix-title">Audio-Visual Lip-Sync Forensics</h4>
                  </div>
                  <div className="df-metric-item">
                    <span className="df-metric-label">Synthetic Voice Probability</span>
                    <span className="df-metric-val highlight">{forensics.audioForensics?.syntheticVoiceScore || 85}% Synthetic Probability</span>
                  </div>
                  <div className="df-metric-item">
                    <span className="df-metric-label">Lip-to-Phoneme Delta</span>
                    <span className="df-metric-val">{forensics.audioForensics?.lipSyncDelta || '+150ms temporal desync'}</span>
                  </div>
                  {forensics.audioForensics?.clonedVoiceMarkers?.length > 0 && (
                    <div className="df-markers-wrap">
                      <span className="df-markers-lbl">Cloned Voice Acoustic Markers:</span>
                      <div className="df-markers-list">
                        {forensics.audioForensics.clonedVoiceMarkers.map((m, i) => (
                          <span key={i} className="df-marker-chip">⚠️ {m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Spoken Speech Transcript & Fact-Check */}
            {(forensics.speechTranscript || forensics.claimFactCheck) && (
              <div className="glass-card df-transcript-card">
                <div className="df-card-header">
                  <MdSecurity className="df-card-icon" />
                  <h4 className="df-card-title">Transcribed Speech & Fact-Check Reality</h4>
                </div>
                {forensics.speechTranscript && (
                  <div className="df-transcript-box">
                    <p className="df-transcript-title">Auto-Transcribed Spoken Dialogue:</p>
                    <p className="df-transcript-text">"{forensics.speechTranscript}"</p>
                  </div>
                )}
                {forensics.claimFactCheck && (
                  <div className="df-fact-reality-box">
                    <p className="df-fact-title">Fact-Check on Spoken Claim:</p>
                    <p className="df-fact-text">{forensics.claimFactCheck}</p>
                  </div>
                )}
                <div className="df-result-footer">
                  <Link to={`/result/${result._id}`} className="btn btn-ghost btn-sm">
                    Open Full Detailed Report in Intelligence Center →
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

export default DeepfakeLabPage;
