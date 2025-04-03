// interactions/buttons/buttonHandler.js - Handles button interactions
const { handleOrderAcceptance } = require('../../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../../interaction/buttons/completeOrder');
const { handleVerificationRequest } = require('../../interaction/buttons/requestVerification');
const { handleAdminCompletion } = require('../../interaction/buttons/adminComplete');
const { publishModalOrder } = require('../../interaction/buttons/orderCreation');
const { handleRatingVote } = require('../../interaction/ratings/projectRating');
const { handleBackToCategories } = require('./categoryNavigation');
const { handleContinueToLevel } = require('./levelNavigation');
const { cancelModalOrder } = require('./orderCancellation');
const { cleanupOrderSession } = require('../../utils/orderSessionManager');
const { handleDateContinue, dateSelections } = require('../../utils/dateSelection');
const logger = require('../../utils/logger');
const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

/**
 * Handles button interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleButtonInteraction(interaction, client) {
  // Get the customId from the interaction
  const buttonId = interaction.customId;
  
  try {
    logger.debug(`Processing button interaction: ${buttonId}`);
    
    // Gestion des boutons de notation (commençant par 'rate_')
    if (buttonId.startsWith('rate_')) {
      await handleRatingVote(interaction);
    }
    
    // Ordre d'acceptation
    else if (buttonId.startsWith('accept_order_')) {
      const orderId = buttonId.replace('accept_order_', '');
      await handleOrderAcceptance(interaction, orderId);
    }
    
    // Ordre de complétion
    else if (buttonId.startsWith('complete_order_')) {
      const orderId = buttonId.replace('complete_order_', '');
      await handleOrderCompletion(interaction, orderId);
    }
    
    // Handle verification request button
    else if (buttonId.startsWith('request_verification_')) {
      const orderId = buttonId.replace('request_verification_', '');
      await handleVerificationRequest(interaction, orderId);
    }
    
    // Handle admin completion button
    else if (buttonId.startsWith('admin_complete_')) {
      const orderId = buttonId.replace('admin_complete_', '');
      await handleAdminCompletion(interaction, orderId);
    }
    
    // Confirmation d'ordre - Ajout pour le nouveau système
    else if (buttonId.startsWith('confirm_modal_order_')) {
      const orderId = buttonId.replace('confirm_modal_order_', '');
      await publishModalOrder(interaction, orderId, client);
    }
    
    // Annulation d'ordre - Ajout pour le nouveau système
    else if (buttonId.startsWith('cancel_modal_order_')) {
      await cancelModalOrder(interaction, client);
    }
    
    // Handle back to categories button for role selection
    else if (buttonId.startsWith('back_to_categories_')) {
      await handleBackToCategories(interaction, client);
    }
    
    // Handle skipping role selection or continuing to next step
    else if (buttonId.startsWith('skip_roles_') || buttonId.startsWith('continue_to_level_')) {
      await handleContinueToLevel(interaction, client);
    }
    
    // Handle date continue button
    else if (buttonId.startsWith('date_continue_')) {
      await handleDateContinue(interaction, client);
    }
    
    // Handle date day button selection
    else if (buttonId.startsWith('date_day_')) {
      const parts = buttonId.split('_');
      const selectedDay = parts[2];
      const userId = parts[3];
      
      // Get user's selection
      const userSelection = dateSelections.get(userId);
      userSelection.day = parseInt(selectedDay);
      
      // Format the final date in YYYY-MM-DD format
      const formattedDate = `${userSelection.year}-${userSelection.month.toString().padStart(2, '0')}-${userSelection.day.toString().padStart(2, '0')}`;
      
      // Get the order session
      const orderSession = client.activeOrders.get(userId);
      if (orderSession) {
        // Store the date in the session
        orderSession.data.deadline = formattedDate;
        client.activeOrders.set(userId, orderSession);
      }
      
      // Show success message with continue button
      const continueButton = new ButtonBuilder()
        .setCustomId(`date_continue_${userId}`)
        .setLabel('Continue')
        .setStyle(ButtonStyle.Success);
      
      const buttonRow = new ActionRowBuilder().addComponents(continueButton);
      
      await interaction.update({
        content: `✅ Date set successfully: **${formattedDate}**\n\nThis date will be used as the project deadline. Click "Continue" to proceed.`,
        components: [buttonRow]
      });
    }
    
    // Confirmation d'ordre - ancienne méthode  
    else if (buttonId.startsWith('confirm_order_')) {
      // Cette partie est désormais gérée par le collector dans orderCreation.js
      // On ne fait rien ici, pour éviter une double manipulation
    }
    
    // Annulation d'ordre - ancienne méthode
    else if (buttonId.startsWith('cancel_order_')) {
      // Cette partie est désormais gérée par le collector dans orderCreation.js
      // On ne fait rien ici, pour éviter une double manipulation
    }
    
    // Boutons non reconnus
    else {
      logger.warn(`Unrecognized button customId: ${buttonId}`);
    }
    
    logger.debug(`Button interaction completed: ${buttonId}`);
    
  } catch (error) {
    logger.error(`Error handling button interaction (${buttonId}):`, error);
    
    // Clean up the session to prevent issues if there was an error
    if (interaction.user?.id) {
      cleanupOrderSession(client, interaction.user.id);
    }
    
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

module.exports = {
    handleBackToCategories,
    handleButtonInteraction
};