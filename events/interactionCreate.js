// events/interactionCreate.js - Gestionnaire pour les interactions

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Handle button interactions
      if (interaction.isButton()) {
        const customId = interaction.customId;
        
        // Handle order acceptance
        if (customId.startsWith('accept_order_')) {
          const orderId = customId.replace('accept_order_', '');
          await handleOrderAcceptance(interaction, orderId);
        }
        
        // Handle order completion
        else if (customId.startsWith('complete_order_')) {
          const orderId = customId.replace('complete_order_', '');
          await handleOrderCompletion(interaction, orderId);
        }
      }
      
      // Handle select menu interactions
      else if (interaction.isSelectMenu()) {
        const customId = interaction.customId;
        
        // Handle order status updates
        if (customId.startsWith('order_status_')) {
          const orderId = customId.replace('order_status_', '');
          await handleOrderStatusUpdate(interaction, orderId);
        }
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      // If the interaction is not already replied to, send an error message
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: 'Une erreur est survenue lors du traitement de cette interaction.',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: 'Une erreur est survenue lors du traitement de cette interaction.',
          ephemeral: true
        });
      }
    }
  }
};