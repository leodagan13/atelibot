// interactions/modals/modalHandler.js - Handles modal submissions
const logger = require('../../utils/logger');
const { handleOrderCreationModal } = require('./orderCreationModal');
const { handleOrderConfirmationModal } = require('./orderConfirmationModal');
const { cleanupOrderSession } = require('../../utils/orderSessionManager');

/**
 * Handles modal submission interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleModalSubmit(interaction, client) {
  try {
    logger.debug(`Processing modal submission: ${interaction.customId}`);
    
    // Handle initial order details form submission
    if (interaction.customId.startsWith('create_order_details_')) {
      await handleOrderCreationModal(interaction, client);
    }
    // Handle order confirmation modal
    else if (interaction.customId.startsWith('create_order_modal_')) {
      await handleOrderConfirmationModal(interaction, client);
    } else {
      logger.warn(`Unknown modal interaction: ${interaction.customId}`);
    }
    
    logger.debug(`Modal submission completed: ${interaction.customId}`);
  } catch (error) {
    logger.error(`Error handling modal submission: ${interaction.customId}`, error);
    
    // Clean up session state in case of error
    if (interaction.user?.id) {
      cleanupOrderSession(client, interaction.user.id);
    }
    
    // Make sure we respond to the interaction to avoid "interaction failed" errors
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement du formulaire.',
        ephemeral: true
      });
    } else if (interaction.deferred) {
      await interaction.editReply({
        content: 'Une erreur est survenue lors du traitement du formulaire.',
        ephemeral: true,
        embeds: [],
        components: [],
        files: []
      });
    }
  }
}

module.exports = { handleModalSubmit };