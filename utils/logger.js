// utils/logger.js - Simple logging utility
const logger = {
  info: function(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  },
  
  error: function(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  },
  
  warn: function(message, ...args) {
    console.warn(`[WARNING] ${message}`, ...args);
  },
  
  debug: function(message, ...args) {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
};

module.exports = logger;