import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MdVerifiedUser, MdWarning, MdSentimentSatisfied, MdTrendingUp,
  MdAutoAwesome, MdOpenInNew, MdClose, MdArticle, MdRefresh,
  MdMemory, MdScience, MdLocalHospital, MdAccountBalance
} from 'react-icons/md';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../context/AuthContext';
import { analysisService, discoverService } from '../services/api';
import { SkeletonCard } from '../components/common/Loader';
import './DashboardPage.css';

const REGIONS = ['Tamil Nadu', 'India', 'World'];
const CATEGORIES = ['All', 'Tech & AI', 'Business', 'Science', 'Health', 'Politics'];

const StatCard = ({ icon, label, value, color, trend }) => {
  const isTextValue = typeof value === 'string' && isNaN(Number(value.replace(/%$/, '')));
  return (
    <div className="stat-card glass-card animate-fade-in">
      <div className="stat-card-icon" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <div className="stat-card-body">
        <p className="stat-card-label">{label}</p>
        <h3 className={`stat-card-value ${isTextValue ? 'is-text' : ''}`}>{value ?? '—'}</h3>
        {trend != null && (
          <span className="stat-card-trend" style={{ color: trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% this week
          </span>
        )}
      </div>
    </div>
  );
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'Tech & AI':
      return <MdMemory />;
    case 'Business':
      return <MdTrendingUp />;
    case 'Science':
      return <MdScience />;
    case 'Health':
      return <MdLocalHospital />;
    case 'Politics':
      return <MdAccountBalance />;
    default:
      return <MdArticle />;
  }
};

const NewsFallbackBanner = ({ category, region, source, isModal = false }) => (
  <div className={`discover-card-fallback-wrap ${isModal ? 'is-modal' : ''}`}>
    <div className="fallback-badges-row">
      <span className="discover-category-badge">{category || 'General'}</span>
      {region && <span className="discover-region-badge">{region}</span>}
    </div>
    <div className="fallback-center-visual">
      <div className="fallback-category-icon-bubble">
        {getCategoryIcon(category)}
      </div>
      <span className="fallback-category-name">{category || 'Regional News'}</span>
    </div>
    <div className="fallback-source-brand">
      <span className="fallback-source-pill">{source || 'Live Publisher'}</span>
    </div>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Discover feed state with Regional News
  const [discoverStories, setDiscoverStories] = useState([]);
  const [selectedRegion, setSelectedRegion] = useState('Tamil Nadu');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedWarning, setFeedWarning] = useState(null);
  const [feedError, setFeedError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(6);
  const [readerStory, setReaderStory] = useState(null);
  const [failedImageIds, setFailedImageIds] = useState(new Set());

  const handleImageError = (storyId) => {
    if (!storyId) return;
    setFailedImageIds((prev) => {
      const next = new Set(prev);
      next.add(storyId);
      return next;
    });
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await analysisService.getHistory({ limit: 100 });
        const history = data.analyses || [];
        const news   = history.filter((h) => h.type === 'news');
        const brands = history.filter((h) => h.type === 'brand');
        const fake   = news.filter((h) => h.classification?.toLowerCase() === 'fake');

        const withConf = history.filter(
          (h) => typeof h.confidence === 'number' && !isNaN(h.confidence) && h.confidence > 0 && h.confidence <= 100
        );
        const avgConfidence = withConf.length > 0
          ? Math.round(withConf.reduce((sum, h) => sum + h.confidence, 0) / withConf.length)
          : null;

        setStats({
          newsAnalyzed:   news.length,
          fakeDetected:   fake.length,
          brandsAnalyzed: brands.length,
          avgConfidence,
        });
      } catch {
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  const fetchDiscoveries = async (region = selectedRegion, category = selectedCategory, forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setDiscoverLoading(true);
    }
    setFeedError(null);
    try {
      const { data } = await discoverService.getTrending({ region, category, refresh: forceRefresh });
      setDiscoverStories(data?.stories || []);
      setFeedWarning(data?.warning || null);
      setVisibleCount(6);
      setFailedImageIds(new Set());
    } catch (err) {
      console.error('Discover error:', err);
      const errMsg = err.response?.data?.message || 'Unable to retrieve live regional news. Please retry.';
      setFeedError(errMsg);
      if (!forceRefresh) {
        setDiscoverStories([]);
      }
    } finally {
      setDiscoverLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiscoveries(selectedRegion, selectedCategory, false);

    // Auto-refresh every 10 minutes silently
    const interval = setInterval(() => {
      fetchDiscoveries(selectedRegion, selectedCategory, true);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedRegion, selectedCategory]);

  const handleRegionChange = (reg) => {
    setSelectedRegion(reg);
  };

  const handleCategoryChange = (cat) => {
    setSelectedCategory(cat);
  };

  const handleVerifyInMeiora = (story) => {
    const textToVerify = typeof story === 'string' ? story : story?.headline || '';
    navigate('/news-detection', {
      state: {
        prefill: textToVerify,
        source: `${story?.source || 'Live News'} (${story?.region || 'Regional'})`,
      },
    });
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <AppLayout>
      <div className="dashboard page-enter">
        {/* Welcome Header */}
        <div className="dashboard-welcome">
          <div>
            <h1 className="dashboard-greeting">
              {greeting}, {user?.name?.split(' ')[0] || 'User'} 👋
            </h1>
            <p className="dashboard-sub">Explore curated regional discoveries and verify information with Meiora AI.</p>
          </div>
          <div className="dashboard-cta-row">
            <Link to="/news-detection"  className="btn btn-primary btn-sm">+ Analyze News</Link>
            <Link to="/brand-sentiment" className="btn btn-secondary btn-sm">+ Analyze Brand</Link>
          </div>
        </div>

        {/* Quick Stats */}
        {loading ? (
          <div className="grid-4">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid-4">
            <StatCard icon={<MdVerifiedUser />}      label="News Analyzed"   value={stats?.newsAnalyzed}   color="var(--accent-purple)" />
            <StatCard icon={<MdWarning />}            label="Fake Detected"   value={stats?.fakeDetected}   color="var(--danger)"        />
            <StatCard icon={<MdSentimentSatisfied />} label="Brands Analyzed" value={stats?.brandsAnalyzed} color="var(--accent-cyan)"   />
            <StatCard
              icon={<MdTrendingUp />}
              label="Average AI Confidence"
              value={stats?.avgConfidence != null ? `${stats.avgConfidence}%` : 'Not available yet'}
              color="var(--success)"
            />
          </div>
        )}

        {/* Discover Feed Section */}
        <div className="discover-section">
          <div className="discover-section-header">
            <div>
              <h2 className="discover-title">
                <span className="discover-sparkle">✨</span> Live Regional Intelligence
                <span className="discover-live-tag">
                  <span className="live-dot" /> LIVE FEED
                </span>
              </h2>
              <p className="discover-subtitle">
                Live regional intelligence for <strong>{selectedRegion}</strong> ({selectedCategory}).
              </p>
            </div>

            <div className="discover-controls-bar">
              {/* Region Selector Pills */}
              <div className="discover-region-tabs">
                {REGIONS.map((reg) => (
                  <button
                    key={reg}
                    type="button"
                    className={`region-pill-btn ${selectedRegion === reg ? 'active' : ''}`}
                    onClick={() => handleRegionChange(reg)}
                  >
                    <span>{reg}</span>
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                className={`btn btn-secondary btn-sm discover-refresh-btn ${isRefreshing ? 'is-syncing' : ''}`}
                onClick={() => fetchDiscoveries(selectedRegion, selectedCategory, true)}
                disabled={discoverLoading || isRefreshing}
                title="Force refresh live feed from Google News"
              >
                <MdRefresh className={`discover-refresh-icon ${isRefreshing ? 'spin-anim' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Category Tabs Bar */}
          <div className="tabs discover-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stale Warning or Error Notifications */}
          {feedWarning && (
            <div className="discover-status-banner warning animate-fade-in">
              <MdWarning className="banner-icon" />
              <span>{feedWarning}</span>
            </div>
          )}

          {feedError && (
            <div className="discover-status-banner error animate-fade-in">
              <MdWarning className="banner-icon" />
              <span>{feedError}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs banner-retry-btn"
                onClick={() => fetchDiscoveries(selectedRegion, selectedCategory, true)}
              >
                Retry
              </button>
            </div>
          )}

          {/* Feed Content */}
          {discoverLoading ? (
            <div className="discover-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card discover-card-skeleton" style={{ height: 260 }} />
              ))}
            </div>
          ) : discoverStories.length === 0 ? (
            <div className="glass-card empty-feed-card animate-fade-in">
              <MdArticle className="empty-feed-icon" />
              <h3>No news stories available for this filter</h3>
              <p>No verified headlines found for {selectedRegion} under {selectedCategory}. Try switching category or refreshing.</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fetchDiscoveries(selectedRegion, selectedCategory, true)}
              >
                <MdRefresh /> Refresh Feed
              </button>
            </div>
          ) : (
            <div className="discover-grid-wrapper">
              <div className="discover-grid">
                {discoverStories.slice(0, visibleCount).map((story) => (
                  <div
                    key={story.id}
                    className="discover-card glass-card animate-fade-in"
                    onClick={() => setReaderStory(story)}
                  >
                    {story.image && !failedImageIds.has(story.id) ? (
                      <div className="discover-card-img-wrap">
                        <img
                          src={story.image}
                          alt={story.headline}
                          className="discover-card-img"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={() => handleImageError(story.id)}
                        />
                        <span className="discover-category-badge">{story.category}</span>
                        <span className="discover-region-badge">{story.region}</span>
                      </div>
                    ) : (
                      <NewsFallbackBanner
                        category={story.category}
                        region={story.region}
                        source={story.source}
                      />
                    )}

                    <div className="discover-card-body">
                      <h3 className="discover-card-headline">{story.headline}</h3>
                      <div className="discover-card-footer">
                        <span className="discover-card-source" title={story.sourceUrl || story.source}>
                          {story.source}
                        </span>
                        <span
                          className="discover-card-time"
                          title={story.publishedAt ? `Published: ${new Date(story.publishedAt).toLocaleString()}` : 'Date unavailable'}
                        >
                          • {story.publishedTimeLabel || 'Date unavailable'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {discoverStories.length > visibleCount && (
                <div className="discover-load-more-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm discover-load-more-btn"
                    onClick={() => setVisibleCount((prev) => prev + 6)}
                  >
                    Load More Stories ({discoverStories.length - visibleCount} more) ↓
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reader Modal */}
        {readerStory && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setReaderStory(null)}>
            <div className="reader-modal-card glass-card" onClick={(e) => e.stopPropagation()}>
              <div className="reader-modal-header-wrap">
                {readerStory.image && !failedImageIds.has(readerStory.id) ? (
                  <>
                    <img
                      src={readerStory.image}
                      alt={readerStory.headline}
                      className="reader-modal-img"
                      referrerPolicy="no-referrer"
                      onError={() => handleImageError(readerStory.id)}
                    />
                    <div className="reader-header-badges">
                      <span className="reader-category-pill">{readerStory.category}</span>
                      <span className="reader-region-pill">{readerStory.region}</span>
                    </div>
                  </>
                ) : (
                  <NewsFallbackBanner
                    category={readerStory.category}
                    region={readerStory.region}
                    source={readerStory.source}
                    isModal={true}
                  />
                )}
                <button
                  type="button"
                  className="reader-close-btn"
                  onClick={() => setReaderStory(null)}
                  title="Close"
                >
                  <MdClose />
                </button>
              </div>

              <div className="reader-modal-body">
                <div className="reader-meta">
                  <span className="reader-source">{readerStory.source}</span>
                  <span className="reader-time">• Published: {readerStory.publishedTimeLabel || 'Date unavailable'}</span>
                </div>

                <div className="reader-timestamps">
                  <span>
                    <strong>Published:</strong> {readerStory.publishedAt ? new Date(readerStory.publishedAt).toLocaleString() : 'Date unavailable'}
                  </span>
                  <span>
                    <strong>Fetched:</strong> {readerStory.fetchedAt ? new Date(readerStory.fetchedAt).toLocaleString() : 'Recent'}
                  </span>
                </div>

                <h2 className="reader-headline">{readerStory.headline}</h2>
                <p className="reader-summary">{readerStory.summary}</p>

                <div className="reader-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleVerifyInMeiora(readerStory)}
                  >
                    <MdAutoAwesome /> Verify with Meiora AI
                  </button>
                  {readerStory.url && (
                    <a
                      href={readerStory.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-sm"
                    >
                      Read on {readerStory.source} <MdOpenInNew />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
