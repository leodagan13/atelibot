// events/interactionCreate.js - Handler for interactions

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const logger = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        
        if (!command) {
          logger.error(`Slash command not found: ${interaction.commandName}`);
          return interaction.reply({
            content: 'Cette commande n\'existe pas.',
            ephemeral: true
          });
        }
        
        try {
          logger.info(`Executing slash command: ${interaction.commandName}`);
          await command.execute(interaction, [], client);
        } catch (error) {
          logger.error(`Error executing slash command ${interaction.commandName}:`, error);
          
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
              content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
              ephemeral: true
            });
          }
        }
      }
      
      // Handle button interactions
      else if (interaction.isButton()) {
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
        
        // Handle order confirmation/cancellation in creation flow
        else if (customId.startsWith('confirm_order_')) {
          const userId = customId.replace('confirm_order_', '');
          // Verify user is the one who started the order
          if (interaction.user.id === userId) {
            const orderCreation = require('../interaction/buttons/orderCreation');
            await orderCreation.publishOrder(interaction, orderSession, client);
          }
        }
        else if (customId.startsWith('cancel_order_')) {
          const userId = customId.replace('cancel_order_', '');
          // Verify user is the one who started the order
          if (interaction.user.id === userId) {
            const orderCreation = require('../interaction/buttons/orderCreation');
            await orderCreation.cancelOrder(interaction, client);
          }
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
      
      // If the interaction hasn't been replied to already, send an error message
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