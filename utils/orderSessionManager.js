// utils/orderSessionManager.js
const logger = require('./logger');

/**
 * Safely cleans up an order session for a user
 * @param {Object} client - Discord client
 * @param {String} userId - User ID
 * @returns {Boolean} - Whether a session was found and cleaned up
 */
function cleanupOrderSession(client, userId) {
  if (!client || !userId) {
    logger.warn(`Invalid parameters for cleanup: client=${!!client}, userId=${userId}`);
    return false;
  }
  
  try {
    const session = client.activeOrders.get(userId);
    const hasSession = !!session;
    
    // Clear timeout if it exists
    if (session && session.timeout) {
      clearTimeout(session.timeout);
      logger.debug(`Cleared timeout for order session of user ${userId}`);
    }
    
    // Remove the session
    client.activeOrders.delete(userId);
    logger.debug(`Removed order session for user ${userId}`);
    
    return hasSession;
  } catch (error) {
    logger.error(`Error cleaning up session for ${userId}:`, error);
    
    // Try to delete the session anyway
    try {
      client.activeOrders.delete(userId);
    } catch (deleteError) {
      logger.error(`Error forcefully deleting session for ${userId}:`, deleteError);
    }
    
    return false;
  }
}

/**
 * Checks if a user has an active order session
 * @param {Object} client - Discord client
 * @param {String} userId - User ID
 * @returns {Boolean} - Whether the user has an active session
 */
function hasActiveSession(client, userId) {
  if (!client || !userId) return false;
  
  try {
    return client.activeOrders.has(userId);
  } catch (error) {
    logger.error(`Error checking session for ${userId}:`, error);
    return false;
  }
}

/**
 * Gets debug info about active order sessions
 * @param {Object} client - Discord client
 * @returns {String} - Debug info
 */
function getSessionDebugInfo(client) {
  if (!client || !client.activeOrders) {
    return "Client or activeOrders map not available";
  }
  
  try {
    const sessionCount = client.activeOrders.size;
    const userIds = Array.from(client.activeOrders.keys());
    
    return `Active sessions: ${sessionCount}. Users: ${userIds.join(', ')}`;
  } catch (error) {
    return `Error getting session info: ${error.message}`;
  }
}

module.exports = { 
  cleanupOrderSession,
  hasActiveSession,
  getSessionDebugInfo
};