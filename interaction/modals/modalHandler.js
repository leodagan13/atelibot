// interactions/modals/modalHandler.js - Handles modal submissions
const logger = require('../../utils/logger');
const { handleFirstOrderModal } = require('./orderCreationModal');
const { handleSecondOrderModal } = require('./orderSecondModal');
const { handleOrderConfirmationModal } = require('./orderConfirmationModal');
const { cleanupOrderSession } = require('../../utils/orderSessionManager');
const { handleDateModal } = require('./orderDateModal');

/**
 * Handles all modal submissions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleModalSubmit(interaction, client) {
  try {
    logger.debug(`Processing modal submission: ${interaction.customId}`);
    
    // Handle first order creation modal
    if (interaction.customId.startsWith('create_order_details_')) {
      await handleFirstOrderModal(interaction, client);
    }
    // Handle date selection modal
    else if (interaction.customId.startsWith('create_order_date_')) {
      await handleDateModal(interaction, client);
    }
    // Handle second modal with date inputs
    else if (interaction.customId.startsWith('create_order_date_')) {
      await handleSecondOrderModal(interaction, client);
    }
    // Handle confirmation modal
    else if (interaction.customId.startsWith('create_order_modal_')) {
      await handleOrderConfirmationModal(interaction, client);
    }
    else {
      logger.warn(`Unknown modal submission: ${interaction.customId}`);
      await interaction.reply({
        content: 'Error: Unknown modal type.',
        ephemeral: true
      });
    }
    
    logger.debug(`Modal submission completed: ${interaction.customId}`);
  } catch (error) {
    logger.error('Error in modal submission handler:', error);
    
    // Clean up session on error
    const userId = interaction.user.id;
    if (client.activeOrders.has(userId)) {
      client.activeOrders.delete(userId);
      logger.debug(`Cleaned up session for user ${userId} due to error`);
    }
    
    // Reply with error message
    await interaction.reply({
      content: 'An error occurred while processing your submission. Please try again.',
      ephemeral: true
    }).catch(console.error);
  }
}

module.exports = { handleModalSubmit };