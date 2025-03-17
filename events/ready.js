// events/ready.js - Gestionnaire pour l'événement "ready"

const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
      logger.info(`Bot is online as ${client.user.tag}`);
      
      // Définir un statut pour le bot (optionnel)
      client.user.setActivity('managing job orders', { type: 'WATCHING' });
    }
  };