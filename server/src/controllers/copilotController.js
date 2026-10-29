import { askCopilot } from '../services/geminiService.js';
import { analysisStore } from '../models/dataStore.js';

export const ask = async (req, res) => {
  try {
    const { question, analysisId, context: incomingContext } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Please provide a question' });
    }

    let context = incomingContext;
    if ((!context || !context.title) && analysisId) {
      const record = await analysisStore.findById(analysisId);
      if (!record) {
        return res.status(404).json({ message: 'Analysis context not found' });
      }
      if (record.userId) {
        if (!req.user?._id) {
          return res.status(401).json({ message: 'Authentication required to access analysis context' });
        }
        const isOwner = String(record.userId) === String(req.user._id);
        const isAdmin = req.user.role === 'admin';
        if (!isOwner && !isAdmin) {
          return res.status(404).json({ message: 'Analysis context not found' });
        }
      }
      context = record;
    }

    if (!context) {
      return res.status(400).json({ message: 'No analysis context provided for the Copilot' });
    }

    const answer = await askCopilot({ question, context });
    return res.json({ answer });
  } catch (error) {
    console.error('Error in copilot.ask:', error);
    return res.status(500).json({
      message: error.message || 'Error generating AI response. Please ensure GEMINI_API_KEY is configured.',
    });
  }
};
