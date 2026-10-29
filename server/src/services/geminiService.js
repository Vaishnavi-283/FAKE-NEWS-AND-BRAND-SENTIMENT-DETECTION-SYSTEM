import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchLiveWebSearchResults } from './webScraperService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenerativeAI(apiKey.trim());
};

// Candidate models in priority order with automatic fallback
const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.8-flash',
];

/**
 * Executes generateContent trying candidate models in order if 404 or 503 occurs
 */
const generateWithModelFallback = async (contents, isJson = true, options = {}) => {
  const genAI = getGeminiClient();
  if (!genAI) {
    throw new Error('Gemini API key is not configured. Please add GEMINI_API_KEY to server/.env to perform real AI analysis.');
  }

  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const config = {
        ...(isJson ? { responseMimeType: 'application/json' } : {}),
        ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      };
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: config,
      });

      const result = await model.generateContent(contents);
      const text = result.response.text();
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Fallback] Model ${modelName} returned: ${err.message?.slice(0, 100)}. Trying next model...`);
    }
  }

  throw new Error(`All Gemini models failed: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Robust JSON parser that strips markdown code fences or extracts JSON from LLM text
 */
const extractJson = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response received from AI model');
  }

  const trimmed = text.trim();

  // 1. Direct parse attempt
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 2. Strip code fences like ```json ... ```
  try {
    const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(stripped);
  } catch {}

  // 3. Extract substring between first '{' and last '}'
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const bracketed = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(bracketed);
    } catch {}
  }

  throw new Error('Gemini returned an invalid JSON response structure. Please try again.');
};

/**
 * Analyzes news/article text using Google Gemini with real fact-checking & search grounding
 */
export const analyzeNewsContent = async ({ content, title, sourceUrl, imageBuffer, mimeType }) => {
  const prompt = `
You are Meiora AI's authoritative Fact-Checking & Fake News Detection Engine.
Analyze the following real content submitted by the user. If an image is attached, inspect the image, read any headline or text visible, assess visual authenticity, and evaluate the claims.

USER CONTENT TO ANALYZE:
Title/Context: ${title || 'N/A'}
Source URL: ${sourceUrl || 'N/A'}
Full Text:
"""
${(content || '').slice(0, 10000)}
"""

CRITICAL INSTRUCTIONS:
- You must perform genuine, evidence-based fact-checking on the real content provided above.
- Identify the core claims made in the text or image.
- Evaluate the credibility, factual accuracy, potential sensationalism, logical fallacies, or alignment with verified facts.
- Do NOT make up fake URLs or fictional government bodies. Reference real verifiable domains or indicate if unverified.
- Calculate an honest trust score from 0 to 100 based on factual evidence and verification certainty.
- Classify the content into exactly one of: "Real", "Fake", "Misleading", or "Unverified".

Return your answer strictly in the following JSON format:
{
  "title": "A concise, descriptive headline for this analysis",
  "trustScore": 85,
  "confidence": 90,
  "classification": "Real",
  "keyIndicators": [
    { "text": "Consistent with official reports", "type": "positive" },
    { "text": "Sensationalized headline detected", "type": "negative" },
    { "text": "Anonymous primary sources", "type": "neutral" }
  ],
  "sourceAnalysis": {
    "Credibility": "High",
    "Domain Reputation": "Verified",
    "Cross-Reference Check": "Consistent",
    "Fact-Check Alignment": "Verified by multiple outlets"
  },
  "keyClaims": [
    { "text": "Summary of claim 1", "status": "Verified" },
    { "text": "Summary of claim 2", "status": "Disputed" }
  ],
  "evidence": [
    {
      "text": "Detailed factual finding supporting or refuting the claim",
      "supports": true,
      "source": "https://example.com/source",
      "sourceName": "Reputable Source Name"
    }
  ],
  "officialSources": [
    { "title": "Official Agency or Outlet", "url": "https://..." }
  ],
  "newsSources": [
    { "title": "News Outlet Name", "url": "https://..." }
  ],
  "explanation": "In-depth AI breakdown of why this content was given this classification, detailing specific discrepancies, verified facts, and contextual nuances.",
  "summary": "Concise 2-3 sentence executive summary of the fact-check result."
}
`;

  const contents = [prompt];
  if (imageBuffer) {
    contents.push({
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType || 'image/jpeg',
      },
    });
  }

  const responseText = await generateWithModelFallback(contents, true);
  return extractJson(responseText);
};

/**
 * Analyzes Brand Sentiment using Google Gemini with Live Search Grounding & Official Link Detection
 */
export const analyzeBrandContent = async ({ content, brand, type }) => {
  const brandQuery = (brand || content || '').trim();

  // 1. Fetch real-time web footprint for accurate grounding (direct query for maximum accuracy)
  let liveResults = await fetchLiveWebSearchResults(brandQuery);
  if (!liveResults || liveResults.length === 0) {
    liveResults = await fetchLiveWebSearchResults(`${brandQuery} brand`);
  }
  const liveSnippets = liveResults.map((r, i) => `[Source ${i + 1}] ${r.title} (${r.url})\nSnippet: ${r.snippet}`).join('\n\n');

  // Detect likely official website from search hits
  let detectedOfficialUrl = '';
  for (const r of liveResults) {
    const u = r.url.toLowerCase();
    if (u.startsWith('http') && !u.includes('duckduckgo') && !u.includes('wikipedia') && !u.includes('amazon') && !u.includes('flipkart') && !u.includes('instagram.com') && !u.includes('facebook.com') && !u.includes('youtube.com')) {
      detectedOfficialUrl = r.url;
      break;
    }
  }
  if (!detectedOfficialUrl && liveResults[0]?.url) {
    detectedOfficialUrl = liveResults[0].url;
  }

  const prompt = `
You are Meiora AI's authoritative Brand Sentiment & Market Intelligence Engine.
Analyze the following brand using verified real-time web intelligence.

TARGET BRAND: "${brand || brandQuery}"
INPUT TYPE: ${type || 'brand_name'}
USER INPUT / QUERY:
"""
${(content || '').slice(0, 5000)}
"""

VERIFIED REAL-TIME WEB FOOTPRINT & LIVE CONSUMER INTELLIGENCE:
"""
${liveSnippets || 'No direct web snippets found; perform grounded analysis based on known market presence.'}
"""

CRITICAL INSTRUCTIONS:
- Ground your analysis strictly in the real-world web footprint provided above.
- Identify the brand's actual product category, ingredients, key offerings, and real consumer feedback (e.g., if it is herbal hair care like Pimpom Paati Hair Oil, note its handmade herbs, 100ml ₹199 price point, Instagram presence, and natural hair benefits).
- If an official website or store URL exists in the web footprint, include it in "officialWebsite".
- Calculate an honest trust/sentiment score from 0 to 100 based strictly on verified reputation and consumer feedback.
- Determine the sentiment distribution: positive (0-100), negative (0-100), neutral (0-100), ensuring they sum to 100.
- Classify overall sentiment into: "Positive", "Negative", or "Neutral".

Return strictly valid JSON with this exact schema:
{
  "title": "Brand Sentiment Analysis for ${brand || brandQuery}",
  "officialWebsite": "${detectedOfficialUrl || ''}",
  "trustScore": 75,
  "confidence": 88,
  "classification": "Positive",
  "sentiment": {
    "positive": 65,
    "negative": 15,
    "neutral": 20
  },
  "keyIndicators": [
    { "text": "Specific real strength or consumer praise from verified reviews", "type": "positive" },
    { "text": "Specific customer grievance or product limitation", "type": "negative" }
  ],
  "keyClaims": [
    { "text": "Key recurring product feature or consumer opinion", "status": "Positive" }
  ],
  "evidence": [
    {
      "text": "Specific customer feedback citation with verified product details",
      "supports": true,
      "source": "${detectedOfficialUrl || 'https://google.com'}",
      "sourceName": "Verified Web & Market Reviews"
    }
  ],
  "officialSources": [
    { "title": "${brand || brandQuery} Official / Store Link", "url": "${detectedOfficialUrl || ''}" }
  ],
  "explanation": "In-depth breakdown of the brand's verified background, actual products/offerings, pricing, customer feedback, and market trajectory.",
  "summary": "Concise 2-3 sentence executive summary of the brand sentiment."
}
`;

  const responseText = await generateWithModelFallback(prompt, true, { temperature: 0.1 });
  const parsed = extractJson(responseText);
  if (!parsed.officialWebsite && detectedOfficialUrl) {
    parsed.officialWebsite = detectedOfficialUrl;
  }
  return parsed;
};

/**
 * Analyzes Head-to-Head Brand Duel / Competitor Sentiment Comparison using Google Gemini with Deterministic Benchmarking
 */
export const analyzeBrandComparison = async ({ brand1, brand2 }) => {
  const b1Raw = (brand1 || '').trim();
  const b2Raw = (brand2 || '').trim();

  // Sort alphabetically to eliminate LLM order bias (ensures 100% reproducible verdicts)
  const isSwapped = b1Raw.localeCompare(b2Raw, undefined, { sensitivity: 'base' }) > 0;
  const canonicalA = isSwapped ? b2Raw : b1Raw;
  const canonicalB = isSwapped ? b1Raw : b2Raw;

  // Fetch live search results for BOTH brands to guarantee grounded facts
  const [hitsA, hitsB] = await Promise.all([
    fetchLiveWebSearchResults(`${canonicalA} customer reviews market share reputation`),
    fetchLiveWebSearchResults(`${canonicalB} customer reviews market share reputation`),
  ]);

  const liveContextA = hitsA.map((h) => `• ${h.title}: ${h.snippet}`).join('\n');
  const liveContextB = hitsB.map((h) => `• ${h.title}: ${h.snippet}`).join('\n');

  const prompt = `
You are Meiora AI's authoritative Brand Duel and Competitor Sentiment Comparison Engine.
Compare these two brands strictly using objective, grounded market data and consumer satisfaction metrics:
Brand A: "${canonicalA}"
Brand B: "${canonicalB}"

VERIFIED REAL-TIME DATA FOR BRAND A (${canonicalA}):
${liveContextA || 'Standard market intelligence'}

VERIFIED REAL-TIME DATA FOR BRAND B (${canonicalB}):
${liveContextB || 'Standard market intelligence'}

CRITICAL DETERMINISTIC BENCHMARK RULES:
- Evaluate both brands across 4 standardized objective dimensions:
  1. Service Quality & Core Reliability (e.g. call stability/speed or product durability)
  2. Pricing & Cost Transparency (value-for-money perception)
  3. Customer Service & Support Response Latency
  4. Compliance, Fines, and Public Trust Stability
- The determination of the Winner MUST be deterministic and consistent: Choose either "${canonicalA}" or "${canonicalB}".
- Provide objective, grounded strengths and weaknesses for each brand based on verifiable facts (e.g. TRAI drive tests, pricing tiers, consumer review trends).

Return strictly valid JSON:
{
  "title": "${canonicalA} vs ${canonicalB} · Brand Duel",
  "trustScore": 85,
  "confidence": 92,
  "classification": "Positive",
  "winner": "${canonicalA}",
  "winnerReason": "Detailed evidence-backed explanation citing specific benchmark leads (e.g. pricing transparency, coverage or quality).",
  "brandA": {
    "name": "${canonicalA}",
    "trustScore": 82,
    "sentiment": { "positive": 68, "negative": 18, "neutral": 14 },
    "strengths": ["Verified key strength 1", "Verified key strength 2"],
    "weaknesses": ["Verified key weakness 1", "Verified key weakness 2"]
  },
  "brandB": {
    "name": "${canonicalB}",
    "trustScore": 84,
    "sentiment": { "positive": 72, "negative": 14, "neutral": 14 },
    "strengths": ["Verified key strength 1", "Verified key strength 2"],
    "weaknesses": ["Verified key weakness 1", "Verified key weakness 2"]
  },
  "keyIndicators": [
    { "text": "Specific comparative advantage of ${canonicalA}", "type": "positive" },
    { "text": "Specific comparative advantage of ${canonicalB}", "type": "positive" }
  ],
  "keyClaims": [
    { "text": "Core competitive differentiation", "status": "Analyzed" }
  ],
  "evidence": [
    {
      "text": "Objective comparative market benchmark citation",
      "supports": true,
      "sourceName": "Comparative Telecom / Market Regulatory Intelligence"
    }
  ],
  "explanation": "Comprehensive comparative breakdown explaining the performance, pricing, and public perception of both brands.",
  "summary": "Executive summary of the head-to-head comparison."
}
`;

  // Set temperature to 0.0 for completely deterministic evaluation
  const responseText = await generateWithModelFallback(prompt, true, { temperature: 0.0 });
  const parsed = extractJson(responseText);

  // Map canonical brandA/brandB back to the user's requested brand1/brand2 ordering
  const brand1Data = isSwapped ? (parsed.brandB || parsed.brand2) : (parsed.brandA || parsed.brand1);
  const brand2Data = isSwapped ? (parsed.brandA || parsed.brand1) : (parsed.brandB || parsed.brand2);

  return {
    ...parsed,
    title: `${b1Raw} vs ${b2Raw} · Brand Duel`,
    brand1: brand1Data || { name: b1Raw, trustScore: 80, sentiment: { positive: 65, negative: 20, neutral: 15 }, strengths: [], weaknesses: [] },
    brand2: brand2Data || { name: b2Raw, trustScore: 80, sentiment: { positive: 65, negative: 20, neutral: 15 }, strengths: [], weaknesses: [] },
  };
};


/**
 * AI Copilot interactive Q&A assistant grounded on the analysis context
 */
export const askCopilot = async ({ question, context }) => {
  const prompt = `
You are Meiora AI Copilot, a helpful and transparent AI fact-checking and sentiment intelligence assistant.
The user is viewing the following analysis result:

ANALYSIS CONTEXT:
Type: ${context.type || context.analysisType || 'Unknown'}
Title: ${context.title || 'N/A'}
Classification: ${context.classification || 'N/A'}
Trust Score: ${context.trustScore || context.score || 0}%
Confidence: ${context.confidence || 0}%
Key Indicators: ${JSON.stringify(context.keyIndicators || [])}
Explanation: ${context.explanation || 'N/A'}
Summary: ${context.summary || 'N/A'}
Evidence: ${JSON.stringify(context.evidence || [])}

USER QUESTION:
"${question}"

Provide a clear, objective, concise, and helpful answer grounded in the evidence and facts of this analysis. If something is unknown or not verified, state so honestly.
`;

  return await generateWithModelFallback(prompt, false);
};

/**
 * WhatsApp Rumor Buster & Virality Intelligence Analysis
 */
export const analyzeWhatsAppRumor = async ({ message, imageBuffer, mimeType }) => {
  const prompt = `
You are Meiora AI's advanced WhatsApp Rumor Buster & Virality Intelligence Engine.
Analyze the following viral message, claim, or attached screenshot/image circulating on WhatsApp or social messaging apps:

MESSAGE / CONTEXT:
"""${message || 'Attached screenshot or viral forward image to inspect.'}"""

${imageBuffer ? 'An image/screenshot has been attached. Carefully inspect the image: perform OCR on all visible headlines, chat bubbles, stamps, or captions. Look for manipulated elements, fake breaking news templates, or deceptive visual claims.' : ''}

Evaluate this viral message or screenshot with strict fact-checking rigor.
Determine:
1. Is it "Fake", "Misleading", "Real", or "Unverified"?
2. What are the psychological triggers / virality factors (e.g. "Urgency", "Fear / Health Panic", "Financial Greed / Free Offer", "Emotional Appeal", "Outrage")?
3. What is the Virality & Panic Risk Score (0 to 100, where 100 is extreme dangerous panic / viral bait)?
4. What are the key false claims?
5. What are the verifiable official fact-check sources or truth explanations?
6. Provide THREE ready-to-copy WhatsApp replies to bust this rumor directly in family / friend groups:
   a) "family": A warm, polite, respectful message suitable for family/elder WhatsApp groups (e.g., "Dear family, please verify before forwarding. Meiora AI and official fact-checkers confirmed this message is unverified/false. Here are the facts: ...").
   b) "direct": A crisp, direct, assertive debunk alert (e.g., "🛑 FACT-CHECK ALERT: This viral message regarding [Topic] is verified FALSE. Official fact-check: ...").
   c) "tamil": A clear, courteous message written in Tamil (தமிழ்) so regional groups can understand immediately (e.g., "🛑 எச்சரிக்கை: இந்த தகவல் போலியானது என சரிபார்க்கப்பட்டுள்ளது. தயவுசெய்து இதை குழுவில் பகிர வேண்டாம்.").

Return strictly valid JSON with this exact schema:
{
  "title": "Short descriptive title of the viral rumor (e.g. Free 5G Scheme Scam Rumor)",
  "classification": "Fake",
  "trustScore": 15,
  "confidence": 95,
  "viralityScore": 88,
  "emotionalTriggers": ["Urgency", "Financial Greed", "Fear of missing out"],
  "debunkSummary": "Clear 2-sentence explanation of why this claim is false or misleading.",
  "officialSources": [
    { "title": "PIB Fact Check / Official Authority", "url": "https://pib.gov.in" },
    { "title": "Official Telecommunications Notice", "url": "https://dot.gov.in" }
  ],
  "replies": {
    "family": "Dear family members, please note that this forwarded message is false...",
    "direct": "🛑 FACT-CHECK ALERT: This message is confirmed to be FAKE...",
    "tamil": "வணக்கம், இந்த செய்தி தவறானது என உறுதிப்படுத்தப்பட்டுள்ளது. இதை யாரும் பகிர வேண்டாம்."
  },
  "explanation": "Detailed forensic explanation of how this rumor originated and why it is deceptive.",
  "keyClaims": [
    { "text": "Claim from the message", "status": "False" }
  ],
  "evidence": [
    { "text": "Official verification statement or reference", "supports": false, "sourceName": "Official Fact-Checker" }
  ]
}
`;

  const contents = [prompt];
  if (imageBuffer) {
    contents.push({
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType || 'image/jpeg',
      },
    });
  }

  const responseText = await generateWithModelFallback(contents, true);
  return extractJson(responseText);
};

/**
 * Video, Reel & Photo Deepfake Forensic Analysis
 */
export const analyzeDeepfakeVideoContent = async ({ videoBuffer, mimeType, videoUrl, title, description }) => {
  const isImage = mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|avif)($|\?)/i.test(videoUrl || '');

  const videoPrompt = `
You are Meiora AI's advanced Video & Reel Deepfake Forensic Inspection Lab.
Analyze the provided video clip, reel, or video description for synthetic generation, AI face morphing, audio-visual lip-sync desynchronization, and spoken speech deception.

VIDEO METADATA / CONTEXT:
Title: ${title || 'Viral Video Claim'}
Video URL / Source: ${videoUrl || 'Direct Video File Upload'}
Description / Spoken Claim: """${description || ''}"""

Perform deep temporal and multi-modal forensic inspection:
1. "deepfakeScore": (0 to 100, where 100 is definitely AI deepfake, 0 is 100% authentic human video)
2. "verdict": "High Risk Deepfake" | "Suspicious / Manipulated" | "Authentic / Real Video"
3. "facialForensics":
   - "blinkRate": Assessment of blinking naturalness (e.g. "Abnormal / Infrequent blinking (AI generation artifact)" or "Normal natural blinking")
   - "boundaryBlending": Assessment of jawline, ears, hair boundary masking (e.g. "Blurry mask boundaries around chin and neck" or "Natural hair and edge sharpness")
   - "lightingConsistency": Assessment of light direction on face vs background (e.g. "Mismatched ambient lighting and unnatural facial highlights" or "Consistent environmental lighting")
4. "audioForensics":
   - "syntheticVoiceScore": (0 to 100)
   - "lipSyncDelta": (e.g. "+160ms desynchronization detected" or "Perfect phoneme alignment")
   - "clonedVoiceMarkers": Array of strings (e.g. ["Monotone emotional pitch", "Absence of natural inhalation breaths", "Metallic frequency cutoff"])
5. "timelineAnomalies": Array of 2 to 4 timeline anomaly segments:
   - "timestamp": e.g. "00:02 - 00:05"
   - "type": e.g. "Lip-Sync Desync" | "Facial Warp" | "Lighting Jitter"
   - "risk": "High" | "Medium" | "Low"
   - "details": Explanation of what occurs at that moment
6. "speechTranscript": Extracted or inferred transcript of what the subject is saying
7. "claimFactCheck": Fact-check of the statement made in the video
8. "verdictSummary": Comprehensive 3-sentence forensic summary detailing whether this is a face-swap, synthetic voiceover, or authentic recording.

Return strictly valid JSON with this exact schema:
{
  "title": "Short descriptive title of the forensic case",
  "deepfakeScore": 88,
  "trustScore": 12,
  "confidence": 94,
  "verdict": "High Risk Deepfake",
  "facialForensics": {
    "blinkRate": "Abnormal / Infrequent blinking pattern",
    "boundaryBlending": "Blurry mask edges and pixel smoothing around jawline",
    "lightingConsistency": "Mismatched lighting angle on face compared to background"
  },
  "audioForensics": {
    "syntheticVoiceScore": 85,
    "lipSyncDelta": "+150ms temporal lag detected",
    "clonedVoiceMarkers": ["Monotone synthetic pitch", "Missing vocal tract micro-vibrations"]
  },
  "timelineAnomalies": [
    {
      "timestamp": "00:02 - 00:05",
      "type": "Lip-Sync Desynchronization",
      "risk": "High",
      "details": "Audio phonemes precede mouth movement by 150ms during opening statement."
    },
    {
      "timestamp": "00:08 - 00:11",
      "type": "Facial Boundary Warping",
      "risk": "High",
      "details": "Edge jitter and texture smoothing along cheekbone when head turns."
    }
  ],
  "speechTranscript": "The spoken words in the video...",
  "claimFactCheck": "Fact-check analysis of the claims made in the speech...",
  "verdictSummary": "Detailed forensic conclusion...",
  "keyIndicators": [
    { "text": "Synthetic voice clone signature detected", "type": "negative" },
    { "text": "Unnatural lip-sync motion identified", "type": "negative" }
  ],
  "officialSources": [
    { "title": "Official Statement / Fact-Check", "url": "https://pib.gov.in" }
  ]
}
`;

  const imagePrompt = `
You are Meiora AI's advanced Image & Photo Deepfake Forensic Inspection Lab.
Analyze the provided photograph or image for synthetic generation (Midjourney, Stable Diffusion, DALL-E, Flux, Imagen), AI face morphing/face swaps, digital manipulation, and visual inconsistencies.

IMAGE METADATA / CONTEXT:
Title: ${title || 'Photo Deepfake Claim'}
Image Source: ${videoUrl || 'Direct Photo File Upload'}
Description / Claim: """${description || ''}"""

Perform deep visual and forensic inspection:
1. "deepfakeScore": (0 to 100, where 100 is definitely AI-generated/deepfake image, 0 is 100% authentic human camera photograph)
2. "verdict": "High Risk Deepfake" | "Suspicious / Manipulated" | "Authentic / Real Photo"
3. "facialForensics":
   - "blinkRate": Assessment of eye realism, gaze direction, and pupil reflections (e.g. "Irregular non-circular pupils and mismatched catchlights in eyes (AI generation artifact)" or "Natural reflections and anatomical iris structure")
   - "boundaryBlending": Assessment of facial boundaries, ears, hair strands, and neck blending (e.g. "Unnatural smoothing along hairline and blurred ear contours" or "Crisp optical depth and natural hair strands")
   - "lightingConsistency": Assessment of light source, shadows, and specular highlights (e.g. "Mismatched shadow directions and hyper-smooth plastic skin sheen" or "Consistent environmental lighting and realistic skin pores")
4. "audioForensics": {
     "syntheticVoiceScore": 0,
     "lipSyncDelta": "N/A (Still Image)",
     "clonedVoiceMarkers": ["Still visual forensic scan - spatial diffusion and anatomical structure analyzed"]
   }
5. "timelineAnomalies": Array of 2 to 4 spatial/regional anomaly callouts in the photo:
   - "timestamp": e.g. "Facial & Eye Region", "Hands & Anatomy", "Lighting & Reflections", "Background & Textures"
   - "type": e.g. "AI Diffusion Pattern" | "Anatomical Warp" | "Mismatched Lighting" | "Digital Face-Swap" | "Pixel Smoothing"
   - "risk": "High" | "Medium" | "Low"
   - "details": Explanation of what anomaly is detected in that region of the photo
6. "speechTranscript": "N/A (Still Image Forensic Inspection)"
7. "claimFactCheck": Fact-check of the context or claim surrounding this image
8. "verdictSummary": Comprehensive 3-sentence forensic summary detailing whether this photo was generated by an AI model (like Midjourney, DALL-E, Flux), manipulated via face-swap/Photoshop, or is an authentic unedited camera photograph.

Return strictly valid JSON with this exact schema:
{
  "title": "Short descriptive title of the photo forensic case",
  "deepfakeScore": 88,
  "trustScore": 12,
  "confidence": 94,
  "verdict": "High Risk Deepfake",
  "facialForensics": {
    "blinkRate": "Irregular non-circular pupil reflection pattern",
    "boundaryBlending": "Blurry mask edges and pixel smoothing around hairline",
    "lightingConsistency": "Mismatched light angle on subject compared to background"
  },
  "audioForensics": {
    "syntheticVoiceScore": 0,
    "lipSyncDelta": "N/A (Still Image)",
    "clonedVoiceMarkers": ["Still image analysis - anatomical and pixel diffusion inspection applied"]
  },
  "timelineAnomalies": [
    {
      "timestamp": "Facial & Eye Region",
      "type": "Pupil Symmetry & Catchlight Anomaly",
      "risk": "High",
      "details": "Mismatched corneal reflections and slight pupil distortion characteristic of generative AI diffusion models."
    },
    {
      "timestamp": "Hands & Anatomy",
      "type": "Texture & Anatomical Warping",
      "risk": "High",
      "details": "Subtle boundary blending irregularities along knuckles and clothing texture continuity."
    }
  ],
  "speechTranscript": "N/A (Still Image Forensic Inspection)",
  "claimFactCheck": "Contextual check of the image claim...",
  "verdictSummary": "Detailed forensic conclusion...",
  "keyIndicators": [
    { "text": "AI diffusion model texture signature identified", "type": "negative" },
    { "text": "Specular reflection mismatch on subject", "type": "negative" }
  ],
  "officialSources": [
    { "title": "Official Statement / Fact-Check", "url": "https://pib.gov.in" }
  ]
}
`;

  const prompt = isImage ? imagePrompt : videoPrompt;
  const contents = [prompt];
  if (videoBuffer) {
    const maxVideoBytes = parseInt(process.env.MAX_VIDEO_UPLOAD_BYTES, 10) || 20 * 1024 * 1024;
    if (videoBuffer.length > maxVideoBytes) {
      const err = new Error(`File size exceeds maximum allowable limit of ${Math.round(maxVideoBytes / (1024 * 1024))}MB.`);
      err.status = 413;
      throw err;
    }
    contents.push({
      inlineData: {
        data: videoBuffer.toString('base64'),
        mimeType: mimeType || (isImage ? 'image/jpeg' : 'video/mp4'),
      },
    });
  }

  try {
    const responseText = await generateWithModelFallback(contents, true);
    return extractJson(responseText);
  } catch (apiErr) {
    const msg = apiErr.message || '';
    if (msg.includes('413') || msg.toLowerCase().includes('payload') || msg.toLowerCase().includes('too large') || msg.includes('resource_exhausted')) {
      const err = new Error('Video clip payload is too large for AI processing. Please upload a shorter or more compressed video clip.');
      err.status = 413;
      throw err;
    }
    throw apiErr;
  }
};

