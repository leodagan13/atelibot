// interactions/buttons/ButtonHandler.js - Handles button interactions
const { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  StringSelectMenuBuilder 
} = require('discord.js');
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
    
    // Handle rating buttons (starting with 'rate_')
    if (buttonId.startsWith('rate_')) {
      await handleRatingVote(interaction);
    }
    
    // Order acceptance
    else if (buttonId.startsWith('accept_order_')) {
      const orderId = buttonId.replace('accept_order_', '');
      await handleOrderAcceptance(interaction, orderId);
    }
    
    // Order completion
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
    
    // Order confirmation - Addition for the new system
    else if (buttonId.startsWith('confirm_modal_order_')) {
      const orderId = buttonId.replace('confirm_modal_order_', '');
      await publishModalOrder(interaction, orderId, client);
    }
    
    // Order cancellation - Addition for the new system
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
    
    // Handle skip date selection
    else if (buttonId.startsWith('skip_date_')) {
      await handleSkipDate(interaction, client);
    }
    
    // Handle continue to roles
    else if (buttonId.startsWith('continue_to_roles_')) {
      await handleContinueToRoles(interaction, client);
    }
    
    // Handle showing date selection modal 
    else if (buttonId.startsWith('show_date_modal_')) {
      const userId = buttonId.replace('show_date_modal_', '');
      
      // Create date selection modal
      const modal = new ModalBuilder()
        .setCustomId(`create_order_date_${userId}`)
        .setTitle('Project Deadline');
        
      // Year input
      const yearInput = new TextInputBuilder()
        .setCustomId('year')
        .setLabel('Year (e.g., 2025)')
        .setPlaceholder('Enter the year')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);
        
      // Month input
      const monthInput = new TextInputBuilder()
        .setCustomId('month')
        .setLabel('Month (1-12)')
        .setPlaceholder('Enter the month number')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);
        
      // Day input
      const dayInput = new TextInputBuilder()
        .setCustomId('day')
        .setLabel('Day (1-31)')
        .setPlaceholder('Enter the day number')
        .setRequired(true)
        .setStyle(TextInputStyle.Short);
        
      // Add components to modal
      modal.addComponents(
        new ActionRowBuilder().addComponents(yearInput),
        new ActionRowBuilder().addComponents(monthInput),
        new ActionRowBuilder().addComponents(dayInput)
      );
      
      // Show the modal
      await interaction.showModal(modal);
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
    
    // Unrecognized buttons
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
      // If the interaction is still valid, reply
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing this interaction.',
          ephemeral: true
        });
      } else {
        // Otherwise, send in the channel
        await interaction.channel.send('An error occurred while processing this interaction.');
      }
    } catch (replyError) {
      logger.error('Error sending error response:', replyError);
    }
  }
}

/**
 * Handles skipping date selection
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleSkipDate(interaction, client) {
  try {
    const userId = interaction.user.id;
    
    // Get the session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      return interaction.update({
        content: 'Error: Your order creation session has expired. Please start again.',
        components: []
      });
    }
    
    // Update session step
    orderSession.step = 'select_role_category';
    client.activeOrders.set(userId, orderSession);
    
    // Start role selection
    await startRoleSelection(interaction, client);
  } catch (error) {
    logger.error('Error handling skip date:', error);
    throw error;
  }
}

/**
 * Handles continuing to role selection
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleContinueToRoles(interaction, client) {
  try {
    const userId = interaction.user.id;
    
    // Get the session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      return interaction.update({
        content: 'Error: Your order creation session has expired. Please start again.',
        components: []
      });
    }
    
    // Get selections from session data
    const { dateDay, dateMonth, dateYear } = orderSession.data;
    
    // If we have all three date components, create a date string
    if (dateDay && dateMonth && dateYear) {
      const paddedDay = String(dateDay).padStart(2, '0');
      const paddedMonth = String(dateMonth).padStart(2, '0');
      orderSession.data.deadline = `${dateYear}-${paddedMonth}-${paddedDay}`;
    }
    
    // Update session step
    orderSession.step = 'select_role_category';
    client.activeOrders.set(userId, orderSession);
    
    // Start role selection
    await startRoleSelection(interaction, client);
  } catch (error) {
    logger.error('Error handling continue to roles:', error);
    throw error;
  }
}

/**
 * Starts the role selection process
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function startRoleSelection(interaction, client) {
  try {
    const userId = interaction.user.id;
    
    // Create category selection menu
    const categorySelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_category_${userId}`)
      .setPlaceholder('Select a role category')
      .addOptions([
        { label: 'Dev Language', value: 'dev_language', emoji: '💻' },
        { label: 'Front End', value: 'front_end', emoji: '🖥️' },
        { label: 'Back End', value: 'back_end', emoji: '⚙️' },
        { label: 'Database', value: 'database', emoji: '🗄️' },
        { label: 'UI', value: 'ui', emoji: '🎨' },
        { label: 'Other', value: 'other', emoji: '📦' }
      ]);
    
    // Add a "Skip" button for users who don't want to select roles
    const skipButton = new ButtonBuilder()
      .setCustomId(`skip_roles_${userId}`)
      .setLabel('Skip Role Selection')
      .setStyle(ButtonStyle.Secondary);
    
    const row1 = new ActionRowBuilder().addComponents(categorySelectMenu);
    const row2 = new ActionRowBuilder().addComponents(skipButton);
    
    // Get any deadline information to display
    const orderSession = client.activeOrders.get(userId);
    const deadlineInfo = orderSession.data.deadline ? 
      `\nDeadline set: **${orderSession.data.deadline}**` : '';
    
    // Update the interaction
    await interaction.update({
      content: `Select a role category for your project.${deadlineInfo}`,
      components: [row1, row2]
    });
    
    logger.debug(`Started role selection for user ${userId}`);
  } catch (error) {
    logger.error('Error starting role selection:', error);
    throw error;
  }
}

module.exports = {
  handleBackToCategories,
  handleButtonInteraction,
  handleSkipDate,
  handleContinueToRoles,
  startRoleSelection
};