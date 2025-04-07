// interactions/buttons/orderCancellation.js - Handles order cancellation
const logger = require('../../utils/logger');

/**
 * Cancels order creation via modal
 * @param {Object} interaction - Discord interaction (button)
 * @param {Object} client - Discord client
 */
async function cancelModalOrder(interaction, client) {
  try {
    // Check if user has an active session
    const hasSession = client.activeOrders.has(interaction.user.id);
    logger.debug(`Cancelling order for user ${interaction.user.id}. Has session: ${hasSession}`);
    
    // Clear the active order - do this BEFORE updating the UI to avoid race conditions
    client.activeOrders.delete(interaction.user.id);
    
    // Update the message without embeds or files (logo)
    await interaction.update({
      content: '❌ Order creation cancelled.',
      embeds: [],
      components: [],
      files: [] // This explicitly removes any files (including the logo)
    });
    
    logger.info(`Order creation cancelled by ${interaction.user.tag}`);
    
  } catch (error) {
    logger.error('Error cancelling modal order:', error);
    
    // Make sure the session is still cleared even if the UI update fails
    if (client && interaction.user?.id) {
      client.activeOrders.delete(interaction.user.id);
    }
    
    try {
      if (!interaction.replied) {
        await interaction.update({
          content: 'An error occurred while cancelling the order.',
          embeds: [],
          components: [],
          files: [] // Also remove files in error case
        });
      }
    } catch (followupError) {
      logger.error('Failed to send error followup:', followupError);
    }
  }
}

module.exports = { cancelModalOrder };