import fs from 'fs';
import { analysisStore } from '../models/dataStore.js';
import {
  analyzeNewsContent,
  analyzeBrandContent,
  analyzeBrandComparison,
  analyzeWhatsAppRumor,
  analyzeDeepfakeVideoContent,
} from '../services/geminiService.js';
import { scrapeUrlContent } from '../services/webScraperService.js';
import { sendAnalysisReportEmail } from '../services/emailService.js';

export const analyzeNews = async (req, res) => {
  try {
    let content = '';
    let title = '';
    let sourceUrl = '';
    let inputType = req.body.type || 'text';

    let imageBuffer = null;
    let mimeType = null;

    // 1. File upload input
    if (req.file) {
      inputType = 'file';
      const filePath = req.file.path;
      mimeType = req.file.mimetype;
      title = req.file.originalname;
      try {
        if (mimeType && mimeType.startsWith('image/')) {
          imageBuffer = fs.readFileSync(filePath);
          content = req.body.content || `Image verification and fact-checking: ${req.file.originalname}`;
        } else {
          content = fs.readFileSync(filePath, 'utf-8');
        }
        // Clean up temp file
        fs.unlink(filePath, () => {});
      } catch (fileErr) {
        return res.status(400).json({ message: 'Error reading uploaded file' });
      }
    }
    // 2. URL input
    else if (inputType === 'url' || (req.body.content && req.body.content.startsWith('http'))) {
      const url = (req.body.content || '').trim();
      if (!url) {
        return res.status(400).json({ message: 'Please provide a valid URL' });
      }
      sourceUrl = url;
      inputType = 'url';
      try {
        const scraped = await scrapeUrlContent(url);
        content = scraped.content;
        title = scraped.title;
      } catch (scrapeErr) {
        return res.status(422).json({
          message: `Unable to access or scrape article from provided URL: ${scrapeErr.message}`,
        });
      }
    }
    // 3. Raw text input
    else {
      content = req.body.content || '';
      title = req.body.title || (content.slice(0, 60) + '…');
    }

    if (!imageBuffer && (!content || content.trim().length < 15)) {
      return res.status(400).json({
        message: 'Content is too short to perform a meaningful fact-checking analysis. Please provide more text.',
      });
    }

    // Call Gemini Fact-Checking Engine
    const analysisData = await analyzeNewsContent({ content, title, sourceUrl, imageBuffer, mimeType });

    // Check Auto-Save preference (defaults to true)
    const shouldAutoSave = req.body.autoSave !== false && req.body.autoSave !== 'false';

    let saved;
    if (shouldAutoSave) {
      // Persist real analysis to MongoDB
      saved = await analysisStore.create({
        userId: req.user?._id || null,
        type: 'news',
        analysisType: 'news',
        input: content.slice(0, 500),
        inputType,
        title: analysisData.title || title || 'Fact-Check Analysis',
        trustScore: analysisData.trustScore ?? 0,
        confidence: analysisData.confidence ?? 0,
        classification: analysisData.classification || 'Unverified',
        keyIndicators: analysisData.keyIndicators || [],
        sourceAnalysis: analysisData.sourceAnalysis || {},
        keyClaims: analysisData.keyClaims || [],
        evidence: analysisData.evidence || [],
        officialSources: analysisData.officialSources || [],
        newsSources: analysisData.newsSources || [],
        explanation: analysisData.explanation || '',
        summary: analysisData.summary || '',
      });
    } else {
      // Return in-memory result without database persistence
      saved = {
        _id: 'temp_' + Date.now(),
        userId: req.user?._id || null,
        type: 'news',
        analysisType: 'news',
        input: content.slice(0, 500),
        inputType,
        title: analysisData.title || title || 'Fact-Check Analysis',
        trustScore: analysisData.trustScore ?? 0,
        confidence: analysisData.confidence ?? 0,
        classification: analysisData.classification || 'Unverified',
        keyIndicators: analysisData.keyIndicators || [],
        sourceAnalysis: analysisData.sourceAnalysis || {},
        keyClaims: analysisData.keyClaims || [],
        evidence: analysisData.evidence || [],
        officialSources: analysisData.officialSources || [],
        newsSources: analysisData.newsSources || [],
        explanation: analysisData.explanation || '',
        summary: analysisData.summary || '',
        unsaved: true,
        createdAt: new Date().toISOString(),
      };
    }

    // Check Email Notification preference
    const shouldEmail = (req.body.emailNotifications === true || req.body.emailNotifications === 'true') && req.user?.email;
    if (shouldEmail) {
      sendAnalysisReportEmail({
        toEmail: req.user.email,
        userName: req.user.name,
        analysis: saved,
      }).catch((e) => console.error('[Analysis Email] Dispatch failed:', e.message));
    }

    return res.status(200).json(saved);
  } catch (error) {
    console.error('Error in analyzeNews:', error);
    return res.status(500).json({
      message: error.message || 'An error occurred during news analysis',
    });
  }
};

export const analyzeBrand = async (req, res) => {
  try {
    const { brand, brand1, brand2, type } = req.body;
    const isComparison = type === 'comparison' || Boolean(brand1 && brand2);

    let content = req.body.content || req.body.review || req.body.brand || '';
    if (isComparison) {
      const b1 = brand1 || brand;
      const b2 = brand2;
      if (!b1 || !b2 || b1.trim().length < 2 || b2.trim().length < 2) {
        return res.status(400).json({ message: 'Please provide both brand names to duel.' });
      }
      content = `${b1.trim()} vs ${b2.trim()}`;
    } else if (!content || content.trim().length < 2) {
      return res.status(400).json({ message: 'Please provide content or brand name to analyze.' });
    }

    let analysisData;
    if (isComparison) {
      const b1 = brand1 || brand;
      const b2 = brand2;
      analysisData = await analyzeBrandComparison({
        brand1: b1.trim(),
        brand2: b2.trim(),
      });
    } else {
      analysisData = await analyzeBrandContent({
        content,
        brand,
        type: type || 'review',
      });
    }

    // Check Auto-Save preference (defaults to true)
    const shouldAutoSave = req.body.autoSave !== false && req.body.autoSave !== 'false';

    const comparisonData = analysisData.winner
      ? {
          winner: analysisData.winner,
          winnerReason: analysisData.winnerReason,
          brand1: analysisData.brand1,
          brand2: analysisData.brand2,
        }
      : null;

    let saved;
    if (shouldAutoSave) {
      saved = await analysisStore.create({
        userId: req.user?._id || null,
        type: 'brand',
        analysisType: 'brand',
        input: content.slice(0, 500),
        inputType: isComparison ? 'comparison' : (type || 'review'),
        title: analysisData.title || `Brand Sentiment: ${brand || 'Overview'}`,
        trustScore: analysisData.trustScore ?? 0,
        confidence: analysisData.confidence ?? 0,
        classification: analysisData.classification || 'Neutral',
        sentiment: analysisData.sentiment || { positive: 0, negative: 0, neutral: 0 },
        keyIndicators: analysisData.keyIndicators || [],
        keyClaims: analysisData.keyClaims || [],
        evidence: analysisData.evidence || [],
        officialWebsite: analysisData.officialWebsite || '',
        officialSources: analysisData.officialSources || [],
        explanation: analysisData.explanation || '',
        summary: analysisData.summary || '',
        comparison: comparisonData,
      });
    } else {
      saved = {
        _id: 'temp_' + Date.now(),
        userId: req.user?._id || null,
        type: 'brand',
        analysisType: 'brand',
        input: content.slice(0, 500),
        inputType: isComparison ? 'comparison' : (type || 'review'),
        title: analysisData.title || `Brand Sentiment: ${brand || 'Overview'}`,
        trustScore: analysisData.trustScore ?? 0,
        confidence: analysisData.confidence ?? 0,
        classification: analysisData.classification || 'Neutral',
        sentiment: analysisData.sentiment || { positive: 0, negative: 0, neutral: 0 },
        keyIndicators: analysisData.keyIndicators || [],
        keyClaims: analysisData.keyClaims || [],
        evidence: analysisData.evidence || [],
        officialWebsite: analysisData.officialWebsite || '',
        officialSources: analysisData.officialSources || [],
        explanation: analysisData.explanation || '',
        summary: analysisData.summary || '',
        comparison: comparisonData,
        unsaved: true,
        createdAt: new Date().toISOString(),
      };
    }

    // Check Email Notification preference
    const shouldEmail = (req.body.emailNotifications === true || req.body.emailNotifications === 'true') && req.user?.email;
    if (shouldEmail) {
      sendAnalysisReportEmail({
        toEmail: req.user.email,
        userName: req.user.name,
        analysis: saved,
      }).catch((e) => console.error('[Brand Email] Dispatch failed:', e.message));
    }

    return res.status(200).json(saved);
  } catch (error) {
    console.error('Error in analyzeBrand:', error);
    return res.status(500).json({
      message: error.message || 'An error occurred during brand sentiment analysis',
    });
  }
};

export const analyzeRumor = async (req, res) => {
  try {
    let message = req.body.message || req.body.content || '';
    let imageBuffer = null;
    let mimeType = null;
    let inputType = 'whatsapp-rumor';

    if (req.file) {
      inputType = 'file';
      const filePath = req.file.path;
      mimeType = req.file.mimetype;
      try {
        if (mimeType && mimeType.startsWith('image/')) {
          imageBuffer = fs.readFileSync(filePath);
          if (!message) {
            message = `WhatsApp viral rumor screenshot/image: ${req.file.originalname}`;
          }
        } else {
          const fileText = fs.readFileSync(filePath, 'utf-8');
          message = message ? `${message}\n\n${fileText}` : fileText;
        }
      } catch (readErr) {
        console.error('Rumor file read error:', readErr);
      } finally {
        fs.unlink(filePath, () => {});
      }
    }

    if (!message || message.trim().length < 3) {
      return res.status(400).json({ message: 'Please provide the viral message content or screenshot to bust.' });
    }

    const analysisData = await analyzeWhatsAppRumor({
      message: message.trim(),
      imageBuffer,
      mimeType,
    });

    const autoSave = req.body.autoSave !== false && req.body.autoSave !== 'false';
    let saved;

    if (autoSave) {
      saved = await analysisStore.create({
        userId: req.user?._id || null,
        type: 'news',
        analysisType: 'news',
        input: message.slice(0, 500),
        inputType: 'whatsapp-rumor',
        title: analysisData.title || 'WhatsApp Viral Rumor Debunk',
        trustScore: analysisData.trustScore ?? 0,
        confidence: analysisData.confidence ?? 0,
        classification: analysisData.classification || 'Fake',
        viralityScore: analysisData.viralityScore ?? 75,
        emotionalTriggers: analysisData.emotionalTriggers || [],
        replies: analysisData.replies || {},
        keyClaims: analysisData.keyClaims || [],
        evidence: analysisData.evidence || [],
        officialSources: analysisData.officialSources || [],
        explanation: analysisData.explanation || '',
        summary: analysisData.debunkSummary || analysisData.explanation || '',
      });
    } else {
      saved = {
        _id: 'temp_' + Date.now(),
        userId: req.user?._id || null,
        type: 'news',
        analysisType: 'news',
        input: message.slice(0, 500),
        inputType: 'whatsapp-rumor',
        title: analysisData.title || 'WhatsApp Viral Rumor Debunk',
        trustScore: analysisData.trustScore ?? 0,
        confidence: analysisData.confidence ?? 0,
        classification: analysisData.classification || 'Fake',
        viralityScore: analysisData.viralityScore ?? 75,
        emotionalTriggers: analysisData.emotionalTriggers || [],
        replies: analysisData.replies || {},
        keyClaims: analysisData.keyClaims || [],
        evidence: analysisData.evidence || [],
        officialSources: analysisData.officialSources || [],
        explanation: analysisData.explanation || '',
        summary: analysisData.debunkSummary || analysisData.explanation || '',
        unsaved: true,
        createdAt: new Date().toISOString(),
      };
    }

    // Check Email Notification preference
    const shouldEmail = (req.body.emailNotifications === true || req.body.emailNotifications === 'true') && req.user?.email;
    if (shouldEmail) {
      sendAnalysisReportEmail({
        toEmail: req.user.email,
        userName: req.user.name,
        analysis: saved,
      }).catch((e) => console.error('[Rumor Email] Dispatch failed:', e.message));
    }

    return res.status(200).json(saved);
  } catch (error) {
    console.error('Error in analyzeRumor:', error);
    return res.status(500).json({
      message: error.message || 'An error occurred during viral rumor analysis',
    });
  }
};

export const analyzeDeepfakeVideo = async (req, res) => {
  try {
    let videoBuffer = null;
    let mimeType = null;
    let videoUrl = req.body.videoUrl || req.body.url || '';
    let title = req.body.title || '';
    let description = req.body.description || req.body.claim || '';

    if (req.file) {
      const filePath = req.file.path;
      mimeType = req.file.mimetype;
      title = title || req.file.originalname;
      try {
        videoBuffer = fs.readFileSync(filePath);
      } catch (err) {
        console.error('Video read error:', err);
        return res.status(400).json({ message: 'Error reading uploaded video file' });
      } finally {
        fs.unlink(filePath, () => {});
      }
    }

    if (!videoBuffer && !videoUrl.trim() && !description.trim()) {
      return res.status(400).json({ message: 'Please provide a video file, video URL, or claim description to inspect.' });
    }

    const analysisData = await analyzeDeepfakeVideoContent({
      videoBuffer,
      mimeType,
      videoUrl: videoUrl.trim(),
      title,
      description: description.trim(),
    });

    const autoSave = req.body.autoSave !== false && req.body.autoSave !== 'false';
    let saved;

    const classification = analysisData.deepfakeScore >= 70 ? 'Fake'
      : analysisData.deepfakeScore >= 40 ? 'Misleading'
      : 'Real';

    const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(videoUrl || '');
    const defaultTitle = isImage ? 'AI Photo Deepfake Inspection' : 'AI Video Deepfake Inspection';
    const inputType = isImage ? 'image-deepfake' : 'video-deepfake';

    const payload = {
      userId: req.user?._id || null,
      type: 'news',
      analysisType: 'news',
      input: (description || title || videoUrl || (isImage ? 'Deepfake Photo Inspection' : 'Deepfake Video Inspection')).slice(0, 500),
      inputType,
      title: analysisData.title || title || defaultTitle,
      trustScore: analysisData.trustScore ?? Math.max(0, 100 - (analysisData.deepfakeScore || 50)),
      confidence: analysisData.confidence ?? 92,
      classification,
      deepfakeForensics: {
        deepfakeScore: analysisData.deepfakeScore ?? 80,
        verdict: analysisData.verdict || 'High Risk Deepfake',
        facialForensics: analysisData.facialForensics || {},
        audioForensics: analysisData.audioForensics || {},
        timelineAnomalies: analysisData.timelineAnomalies || [],
        speechTranscript: analysisData.speechTranscript || '',
        claimFactCheck: analysisData.claimFactCheck || '',
      },
      keyIndicators: analysisData.keyIndicators || [],
      evidence: analysisData.timelineAnomalies?.map((a) => ({
        text: `[${a.timestamp}] ${a.type}: ${a.details}`,
        supports: a.risk !== 'High',
        sourceName: 'Meiora Forensic Vision Engine',
      })) || [],
      officialSources: analysisData.officialSources || [],
      explanation: analysisData.verdictSummary || '',
      summary: analysisData.verdictSummary || '',
    };

    if (autoSave) {
      saved = await analysisStore.create(payload);
    } else {
      saved = {
        _id: 'temp_' + Date.now(),
        ...payload,
        unsaved: true,
        createdAt: new Date().toISOString(),
      };
    }

    return res.status(200).json(saved);
  } catch (error) {
    console.error('Error in analyzeDeepfakeVideo:', error);
    return res.status(error.status || 500).json({
      message: error.message || 'An error occurred during video deepfake inspection',
    });
  }
};

export const getHistory = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Authentication required to access analysis history' });
    }

    const filter = { userId: req.user._id };
    if (req.query.type && req.query.type !== 'all') {
      filter.type = req.query.type.toLowerCase();
    }

    const analyses = await analysisStore.find(filter);
    const limit = parseInt(req.query.limit) || 50;

    return res.json({
      total: analyses.length,
      analyses: analyses.slice(0, limit),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const item = await analysisStore.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    // Ownership check: must be owner or admin
    const isOwner = item.userId && String(item.userId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(404).json({ message: 'Analysis not found' });
    }

    return res.json(item);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteById = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const item = await analysisStore.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Analysis record not found' });
    }

    const isOwner = item.userId && String(item.userId) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(404).json({ message: 'Analysis record not found' });
    }

    const deleted = await analysisStore.deleteById(req.params.id, req.user._id, isAdmin);
    if (!deleted) {
      return res.status(404).json({ message: 'Analysis record not found' });
    }

    return res.json({ message: 'Analysis deleted successfully', id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

