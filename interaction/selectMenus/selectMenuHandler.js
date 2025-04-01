// interactions/selectMenus/selectMenuHandler.js - Handles select menu interactions
const { handleOrderStatusUpdate } = require('../../interaction/selectMenus/orderStatus');
const { handleCategorySelection } = require('./categorySelection.js');
const { handleRoleSelection } = require('./roleSelection');
const { handleLevelSelection } = require('./levelSelection');
const logger = require('../../utils/logger');

/**
 * Handles select menu interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleSelectMenuInteraction(interaction, client) {
  try {
    const menuId = interaction.customId;
    
    // Handle order status updates
    if (menuId.startsWith('order_status_')) {
      const orderId = menuId.replace('order_status_', '');
      await handleOrderStatusUpdate(interaction, orderId);
    } 
    
    // Handle category selection for role selection
    else if (menuId.startsWith('select_category_')) {
      await handleCategorySelection(interaction, client);
    }
    
    // Handle role selection from a category
    else if (menuId.startsWith('select_roles_')) {
      await handleRoleSelection(interaction, client);
    }
    
    // Handle level selection
    else if (menuId.startsWith('select_level_')) {
      await handleLevelSelection(interaction, client);
    } 
    
    else {
      logger.warn(`Unrecognized string select menu customId: ${menuId}`);
    }
  } catch (error) {
    logger.error(`Error handling string select menu interaction (${interaction.customId}):`, error);
    
    try {
      await interaction.followUp({
        content: 'Une erreur est survenue lors du traitement de cette interaction. Veuillez réessayer.',
        ephemeral: true
      });
    } catch (replyError) {
      logger.error("Impossible d'envoyer le message d'erreur", replyError);
    }
  }
}

module.exports = {
    handleRoleSelection
};