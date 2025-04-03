// events/interactionCreate.js - With improved error handling

const { handleCommand } = require('../interaction/commands/commandHandler');
const { handleButtonInteraction } = require('../interaction/buttons/ButtonHandler');
const { handleSelectMenuInteraction } = require('../interaction/selectMenus/selectMenuHandler'); 
const { handleModalSubmit } = require('../interaction/modals/modalHandler');
const { cleanupOrderSession, getSessionDebugInfo } = require('../utils/orderSessionManager');
const logger = require('../utils/logger');
const { createNotification, getLogoAttachment } = require('../utils/modernEmbedBuilder');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Log session state at beginning of interaction
      logger.debug(`Interaction started - user: ${interaction.user.id}`);
      logger.debug(`Active order sessions: ${Array.from(client.activeOrders.keys()).join(', ') || 'none'}`);

      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        await handleCommand(interaction, client);
      }
      // Handle modal submissions
      else if (interaction.isModalSubmit()) {
        await handleModalSubmit(interaction, client);
      }
      // Handle button interactions
      else if (interaction.isButton()) {
        await handleButtonInteraction(interaction, client);
      }
      // Handle string select menu interactions
      else if (interaction.isStringSelectMenu()) {
        await handleSelectMenuInteraction(interaction, client);
      }
      
      // Debug session state after interaction
      logger.debug(`Interaction completed - session state: ${getSessionDebugInfo(client)}`);
      
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      // Make sure to clean up the session in case of errors
      if (interaction.user?.id) {
        cleanupOrderSession(client, interaction.user.id);
      }
      
      // If the interaction hasn't been replied to already, send an error message
      if (!interaction.replied && !interaction.deferred) {
        try {
          const embed = createNotification(
            'Error Occurred',
            'An error occurred while processing your request.',
            'ERROR'
          );
          
          const logoAttachment = getLogoAttachment();
          
          await interaction.reply({
            embeds: [embed],
            files: [logoAttachment],
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