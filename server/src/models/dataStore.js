import { User } from './User.js';
import { Analysis } from './Analysis.js';
import { getDBStatus } from '../config/db.js';
import bcrypt from 'bcryptjs';

// In-memory fallback repository for development when mongod isn't locally running
const memoryUsers = [];
const memoryAnalyses = [];

export const userStore = {
  async findByEmail(email) {
    if (getDBStatus()) {
      try {
        return await User.findOne({ email: email.toLowerCase() });
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    return memoryUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  async findById(id) {
    if (getDBStatus()) {
      try {
        return await User.findById(id).select('-password');
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    const u = memoryUsers.find((user) => String(user._id) === String(id));
    if (u) {
      const { password, ...rest } = u;
      return rest;
    }
    return null;
  },

  async create({ name, email, password, isVerified = false, otp = null, otpExpires = null }) {
    if (getDBStatus()) {
      try {
        return await User.create({ name, email, password, isVerified, otp, otpExpires });
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = {
      _id: 'user_' + Date.now() + Math.random().toString(36).substr(2, 5),
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'user',
      isVerified,
      otp,
      otpExpires,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      async matchPassword(pwd) {
        return await bcrypt.compare(pwd, this.password);
      },
    };
    memoryUsers.push(newUser);
    return newUser;
  },

  async update(id, updates) {
    if (updates.password && typeof updates.password === 'string' && !updates.password.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(updates.password, salt);
    }
    if (getDBStatus()) {
      try {
        return await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    const idx = memoryUsers.findIndex((u) => String(u._id) === String(id));
    if (idx !== -1) {
      memoryUsers[idx] = { ...memoryUsers[idx], ...updates, updatedAt: new Date().toISOString() };
      const { password, ...rest } = memoryUsers[idx];
      return rest;
    }
    return null;
  },
};

export const analysisStore = {
  async create(data) {
    if (getDBStatus()) {
      try {
        return await Analysis.create(data);
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    const doc = {
      _id: 'ana_' + Date.now() + Math.random().toString(36).substr(2, 5),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryAnalyses.unshift(doc);
    return doc;
  },

  async find(filter = {}) {
    if (getDBStatus()) {
      try {
        const q = {};
        if (filter.userId !== undefined) q.userId = filter.userId;
        if (filter.type) q.type = filter.type;
        return await Analysis.find(q).sort({ createdAt: -1 });
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    let list = [...memoryAnalyses];
    if (filter.userId !== undefined) {
      list = list.filter((a) => String(a.userId) === String(filter.userId));
    }
    if (filter.type) {
      list = list.filter((a) => a.type === filter.type);
    }
    return list;
  },

  async findById(id) {
    if (getDBStatus()) {
      try {
        const item = await Analysis.findById(id);
        if (item) return item;
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    return memoryAnalyses.find((a) => String(a._id) === String(id)) || null;
  },

  async deleteById(id, userId = null, isAdmin = false) {
    if (getDBStatus()) {
      try {
        const q = { _id: id };
        if (userId && !isAdmin) {
          q.userId = userId;
        }
        return await Analysis.findOneAndDelete(q);
      } catch (e) {
        console.warn('[DB Error, falling back to memory]', e.message);
      }
    }
    const idx = memoryAnalyses.findIndex((a) => {
      if (String(a._id) !== String(id)) return false;
      if (userId && !isAdmin) {
        return String(a.userId) === String(userId);
      }
      return true;
    });
    if (idx !== -1) {
      const removed = memoryAnalyses.splice(idx, 1);
      return removed[0];
    }
    return null;
  },
};

