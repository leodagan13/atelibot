// interactions/modals/modalHandler.js - Handles modal submissions
const logger = require('../../utils/logger');
const { handleFirstOrderModal } = require('./orderCreationModal');
const { handleSecondOrderModal } = require('./orderSecondModal');
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
      await handleFirstOrderModal(interaction, client);
    }
    // Handle second modal with date inputs
    else if (interaction.customId.startsWith('create_order_date_')) {
      await handleSecondOrderModal(interaction, client);
    }
    // Handle confirmation modal
    else if (interaction.customId.startsWith('create_order_modal_')) {
      await handleOrderConfirmationModal(interaction, client);
    }
    // Handle tags modal submission
    else if (interaction.customId.startsWith('add_tags_modal_')) {
      await handleTagsModal(interaction, client);
    }
    else {
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

/**
 * Handles tags modal submission
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleTagsModal(interaction, client) {
  try {
    const userId = interaction.user.id;
    
    // Get tags from modal
    const tagsString = interaction.fields.getTextInputValue('tags') || '';
    
    // Process tags
    const tags = tagsString.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    // Get the order session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      return interaction.reply({
        content: 'Error: Your order creation session has expired. Please start again.',
        ephemeral: true
      });
    }
    
    // Store tags
    orderSession.data.tags = tags;
    client.activeOrders.set(userId, orderSession);
    
    // Show confirmation
    await interaction.reply({
      content: `Tags added: ${tags.length > 0 ? tags.map(t => `\`${t}\``).join(', ') : 'None'}`,
      ephemeral: true
    });
  } catch (error) {
    logger.error('Error handling tags modal:', error);
    throw error;
  }
}

module.exports = { handleModalSubmit };