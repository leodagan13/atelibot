// interactions/buttons/orderCancellation.js - Handles order cancellation
const logger = require('../../utils/logger');

/**
 * Annule la création d'offre via modal
 * @param {Object} interaction - Interaction Discord (button)
 * @param {Object} client - Discord client
 */
async function cancelModalOrder(interaction, client) {
  try {
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Update the message without embeds or files (logo)
    await interaction.update({
      content: '❌ Création d\'offre annulée.',
      embeds: [],
      components: [],
      files: [] // This explicitly removes any files (including the logo)
    });
    
    logger.info(`Order creation cancelled by ${interaction.user.tag}`);
    
  } catch (error) {
    logger.error('Error cancelling modal order:', error);
    try {
      if (!interaction.replied) {
        await interaction.update({
          content: 'Une erreur est survenue lors de l\'annulation de l\'offre.',
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