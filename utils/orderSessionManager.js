// utils/orderSessionManager.js
const logger = require('./logger');

function cleanupOrderSession(client, userId) {
  const session = client.activeOrders.get(userId);
  
  // Clear timeout if it exists
  if (session && session.timeout) {
    clearTimeout(session.timeout);
    logger.debug(`Cleared timeout for order session of user ${userId}`);
  }
  
  // Remove the session
  client.activeOrders.delete(userId);
  logger.debug(`Removed order session for user ${userId}`);
}

module.exports = { cleanupOrderSession };