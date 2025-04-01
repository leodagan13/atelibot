// interactions/modals/modalHandler.js - Handles modal submissions
const logger = require('../../utils/logger');
const { handleOrderCreationModal } = require('./orderCreationModal');
const { handleOrderConfirmationModal } = require('./orderConfirmationModal');

/**
 * Handles modal submission interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleModalSubmit(interaction, client) {
  try {
    // Handle initial order details form submission
    if (interaction.customId.startsWith('create_order_details_')) {
      await handleOrderCreationModal(interaction, client);
    }
    // Handle order confirmation modal
    else if (interaction.customId.startsWith('create_order_modal_')) {
      await handleOrderConfirmationModal(interaction, client);
    }
  } catch (error) {
    logger.error('Error handling modal submission:', error);
    if (!interaction.replied) {
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement du formulaire.',
        ephemeral: true
      });
    }
  }
}

module.exports = { handleModalSubmit };