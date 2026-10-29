export const DEFAULT_SETTINGS = {
  emailNotifications: true,
  pushNotifications: false,
  autoSave: true,
  publicProfile: false,
  dataSharing: false,
  language: 'en',
};

const SETTINGS_KEY = 'meiora_settings_prefs';

/**
 * Retrieve user preferences from localStorage with fallback defaults
 */
export const getSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Failed to read settings from localStorage', err);
  }
  return { ...DEFAULT_SETTINGS };
};

/**
 * Persist user preferences to localStorage
 */
export const saveSettings = (newSettings) => {
  try {
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error('Failed to save settings to localStorage', err);
    return newSettings;
  }
};

/**
 * Requests browser push notification permission
 */
export const requestPushPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      supported: false,
      granted: false,
      message: 'Browser does not support desktop push notifications.',
    };
  }

  if (Notification.permission === 'granted') {
    return { supported: true, granted: true };
  }

  if (Notification.permission === 'denied') {
    return {
      supported: true,
      granted: false,
      message: 'Notifications are blocked in your browser site permissions.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      try {
        new Notification('Meiora AI Notifications Activated', {
          body: 'You will receive instant alerts whenever AI analyses finish.',
          icon: '/favicon.ico',
        });
      } catch (err) {
        // Notification constructor could be restricted in some iframes
      }
      return { supported: true, granted: true };
    }
    return {
      supported: true,
      granted: false,
      message: 'Permission not granted.',
    };
  } catch (err) {
    return { supported: true, granted: false, message: err.message };
  }
};

/**
 * Dispatches a native desktop notification if user enabled push notifications
 */
export const sendPushNotification = (title, options = {}) => {
  try {
    const settings = getSettings();
    if (!settings.pushNotifications) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch (err) {
    console.warn('Failed to trigger push notification:', err);
  }
};
