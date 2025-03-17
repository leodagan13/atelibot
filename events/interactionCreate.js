// events/interactionCreate.js - Handler for interactions

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const { publishOrder, cancelOrder } = require('../interaction/buttons/orderCreation');
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
        
        try {
          // Ordre d'acceptation
          if (customId.startsWith('accept_order_')) {
            const orderId = customId.replace('accept_order_', '');
            await handleOrderAcceptance(interaction, orderId);
          }
          
          // Ordre de complétion
          else if (customId.startsWith('complete_order_')) {
            const orderId = customId.replace('complete_order_', '');
            await handleOrderCompletion(interaction, orderId);
          }
          
          // Confirmation d'ordre - nouvelle méthode utilisant des identifiants uniques
          else if (customId.startsWith('confirm_order_')) {
            // Cette partie est désormais gérée par le collector dans orderCreation.js
            // On ne fait rien ici, pour éviter une double manipulation
          }
          
          // Annulation d'ordre - nouvelle méthode utilisant des identifiants uniques
          else if (customId.startsWith('cancel_order_')) {
            // Cette partie est désormais gérée par le collector dans orderCreation.js
            // On ne fait rien ici, pour éviter une double manipulation
          }
          
          // Boutons non reconnus
          else {
            logger.warn(`Unrecognized button customId: ${customId}`);
          }
        } catch (error) {
          logger.error(`Error handling button interaction (${customId}):`, error);
          
          try {
            // Si l'interaction est encore valide, répondre
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'Une erreur est survenue lors du traitement de cette interaction.',
                ephemeral: true
              });
            } else {
              // Sinon, envoyer dans le canal
              await interaction.channel.send('Une erreur est survenue lors du traitement de cette interaction.');
            }
          } catch (replyError) {
            logger.error('Error sending error response:', replyError);
          }
        }
      }
      
      // Handle select menu interactions
      else if (interaction.isSelectMenu()) {
        const customId = interaction.customId;
        
        try {
          // Handle order status updates
          if (customId.startsWith('order_status_')) {
            const orderId = customId.replace('order_status_', '');
            await handleOrderStatusUpdate(interaction, orderId);
          } else {
            logger.warn(`Unrecognized select menu customId: ${customId}`);
          }
        } catch (error) {
          logger.error(`Error handling select menu interaction (${customId}):`, error);
          
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'Une erreur est survenue lors du traitement de cette interaction.',
                ephemeral: true
              });
            } else {
              await interaction.channel.send('Une erreur est survenue lors du traitement de cette interaction.');
            }
          } catch (replyError) {
            logger.error('Error sending error response:', replyError);
          }
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
          try {
            await interaction.channel.send('Une erreur est survenue lors du traitement de cette interaction.');
          } catch (channelError) {
            logger.error('Failed to send error message to channel:', channelError);
          }
        }
      }
    }
  }
};