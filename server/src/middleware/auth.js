import jwt from 'jsonwebtoken';
import { userStore } from '../models/dataStore.js';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'meiora_super_secure_jwt_secret_key_2026_x89a');
    const user = await userStore.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User belonging to this token no longer exists' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

// Optional auth: sets req.user if token is present, but doesn't block if not
export const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'meiora_super_secure_jwt_secret_key_2026_x89a');
      const user = await userStore.findById(decoded.id);
      if (user) req.user = user;
    } catch {
      // Ignore invalid token in optional mode
    }
  }
  next();
};
