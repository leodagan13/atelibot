// Ready event
const logger = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.info(`Bot is online as ${client.user.tag}`);
    
    // Set activity status
    client.user.setActivity('managing job orders', { type: 'WATCHING' });
  }
};