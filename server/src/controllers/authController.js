import jwt from 'jsonwebtoken';
import axios from 'axios';
import { userStore } from '../models/dataStore.js';
import { sendOtpEmail } from '../services/emailService.js';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'meiora_super_secure_jwt_secret_key_2026_x89a', {
    expiresIn: '30d',
  });
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields' });
  }

  const existingUser = await userStore.findByEmail(email);
  if (existingUser && existingUser.isVerified) {
    return res.status(400).json({ message: 'User already exists with this email. Please sign in.' });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    if (existingUser && !existingUser.isVerified) {
      await userStore.update(existingUser._id, {
        name,
        password,
        otp: otpCode,
        otpExpires,
      });
    } else {
      await userStore.create({
        name,
        email,
        password,
        isVerified: false,
        otp: otpCode,
        otpExpires,
      });
    }

    // Dispatch email
    try {
      await sendOtpEmail({ toEmail: email, otpCode, userName: name });
    } catch (mailErr) {
      console.error('[Registration Mail Warning]', mailErr.message);
      return res.status(500).json({
        message: 'Could not send verification email. Please check your email address and try again.',
      });
    }

    return res.status(200).json({
      requiresOtp: true,
      email: email.toLowerCase(),
      message: `A 6-digit verification code has been sent to ${email}`,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Server error creating user' });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Please provide email and verification code' });
  }

  const user = await userStore.findByEmail(email);
  if (!user) {
    return res.status(404).json({ message: 'User not found. Please register first.' });
  }

  if (user.isVerified) {
    const token = generateToken(user._id);
    return res.json({
      message: 'Account is already verified',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  }

  if (!user.otp || String(user.otp).trim() !== String(otp).trim()) {
    return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
  }

  if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
    return res.status(400).json({ message: 'Verification code has expired. Please click Resend Code.' });
  }

  // Activate account and clear OTP
  await userStore.update(user._id, {
    isVerified: true,
    otp: null,
    otpExpires: null,
  });

  const token = generateToken(user._id);
  return res.json({
    message: 'Email verified successfully! Welcome to Meiora AI.',
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

export const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Please provide your email address' });
  }

  const user = await userStore.findByEmail(email);
  if (!user) {
    return res.status(404).json({ message: 'User not found with this email' });
  }

  if (user.isVerified) {
    return res.status(400).json({ message: 'Account is already verified. Please sign in.' });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  await userStore.update(user._id, {
    otp: otpCode,
    otpExpires,
  });

  try {
    await sendOtpEmail({ toEmail: user.email, otpCode, userName: user.name });
    return res.json({ message: `A new verification code has been sent to ${user.email}` });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send email: ' + err.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password' });
  }

  const user = await userStore.findByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // If user registered with email/password but never verified OTP
  if (user.isVerified === false) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await userStore.update(user._id, { otp: otpCode, otpExpires });
    try {
      await sendOtpEmail({ toEmail: user.email, otpCode, userName: user.name });
    } catch {}

    return res.status(403).json({
      requiresOtp: true,
      email: user.email,
      message: 'Please verify your email to continue. We just sent a verification code to your inbox.',
    });
  }

  const token = generateToken(user._id);
  return res.json({
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

export const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  return res.json({ user: req.user });
};

export const updateProfile = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  const { name, email, bio } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (bio !== undefined) updates.bio = bio;

  try {
    const updated = await userStore.update(req.user._id, updates);
    return res.json({ user: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const googleAuth = async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ message: 'Google credential token is required' });
  }

  try {
    let email, name, sub;

    // 1. Try Google userinfo API (standard for OAuth2 access_token)
    try {
      const userinfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      email = userinfoRes.data.email;
      name = userinfoRes.data.name;
      sub = userinfoRes.data.sub;
    } catch {
      // 2. Fallback to Google tokeninfo API (standard for OpenID id_token)
      const tokeninfoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      email = tokeninfoRes.data.email;
      name = tokeninfoRes.data.name;
      sub = tokeninfoRes.data.sub;
    }

    if (!email) {
      return res.status(400).json({ message: 'Could not retrieve email from Google profile' });
    }

    // Check if user already exists
    let user = await userStore.findByEmail(email);
    if (!user) {
      // Auto-create user from Google profile
      const randomPassword = 'google_' + Math.random().toString(36).slice(2) + Date.now();
      user = await userStore.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: randomPassword,
        isVerified: true,
      });
    }

    const jwtToken = generateToken(user._id);
    return res.json({
      token: jwtToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
      },
    });
  } catch (err) {
    console.error('Google Auth Error:', err.response?.data || err.message);
    return res.status(401).json({
      message: 'Failed to verify Google account with Google. Please try again.',
    });
  }
};

