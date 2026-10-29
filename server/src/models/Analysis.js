import mongoose from 'mongoose';

const analysisSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: ['news', 'brand'],
      required: true,
    },
    analysisType: {
      type: String,
      enum: ['news', 'brand'],
      required: true,
    },
    input: {
      type: String,
      required: true,
    },
    inputType: {
      type: String,
      enum: ['text', 'url', 'file', 'brand_name', 'review', 'comparison', 'whatsapp-rumor', 'video-deepfake', 'image-deepfake'],
      default: 'text',
    },
    title: {
      type: String,
      default: 'Analysis Result',
    },
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    viralityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    emotionalTriggers: [
      { type: String }
    ],
    replies: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    deepfakeForensics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    classification: {
      type: String,
      enum: ['Real', 'Fake', 'Unverified', 'Misleading', 'Positive', 'Negative', 'Neutral'],
      default: 'Unverified',
    },
    keyIndicators: [
      {
        text: String,
        type: { type: String, enum: ['positive', 'negative', 'neutral'], default: 'neutral' },
      },
    ],
    sourceAnalysis: {
      type: Map,
      of: String,
      default: {},
    },
    keyClaims: [
      {
        text: String,
        status: String,
      },
    ],
    evidence: [
      {
        text: String,
        supports: Boolean,
        source: String,
        sourceName: String,
      },
    ],
    officialWebsite: {
      type: String,
      default: '',
    },
    officialSources: [
      {
        title: String,
        url: String,
      },
    ],
    newsSources: [
      {
        title: String,
        url: String,
      },
    ],
    sentiment: {
      positive: { type: Number, default: 0 },
      negative: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
    },
    explanation: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
      default: '',
    },
    comparison: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

export const Analysis = mongoose.models.Analysis || mongoose.model('Analysis', analysisSchema);
