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
        const customid = interaction.customid;
        
        // Handle order acceptance
        if (customid.startsWith('accept_order_')) {
          const orderid = customid.replace('accept_order_', '');
          await handleOrderAcceptance(interaction, orderid);
        }
        
        // Handle order completion
        else if (customid.startsWith('complete_order_')) {
          const orderid = customid.replace('complete_order_', '');
          await handleOrderCompletion(interaction, orderid);
        }
        
        // Handle order confirmation/cancellation in creation flow
        else if (customid.startsWith('confirm_order_')) {
          const userid = customid.replace('confirm_order_', '');
          // Vérifier que l'utilisateur est celui qui a commencé l'ordre
          if (interaction.user.id === userid) {
            const orderCreation = require('../interaction/buttons/orderCreation');
            const orderSession = client.activeOrders.get(userid);
            if (orderSession) {
              await orderCreation.publishOrder(interaction, orderSession, client);
            } else {
              await interaction.update({
                content: 'Session de création d\'offre non trouvée ou expirée.',
                components: []
              });
            }
          }
        }
        else if (customid.startsWith('cancel_order_')) {
          const userid = customid.replace('cancel_order_', '');
          // Vérifier que l'utilisateur est celui qui a commencé l'ordre
          if (interaction.user.id === userid) {
            const orderCreation = require('../interaction/buttons/orderCreation');
            await orderCreation.cancelOrder(interaction, client);
          }
        }
      }
      
      // Handle select menu interactions
      else if (interaction.isSelectMenu()) {
        const customid = interaction.customid;
        
        // Handle order status updates
        if (customid.startsWith('order_status_')) {
          const orderid = customid.replace('order_status_', '');
          await handleOrderStatusUpdate(interaction, orderid);
        }
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      // If the interaction hasn't been replied to already, send an error message
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: 'Une erreur est survenue lors du traitement de cette interaction.',
            ephemeral: true
          });
        } catch (replyError) {
          logger.error('Error sending error response:', replyError);
        }
      }
    }
  }
};