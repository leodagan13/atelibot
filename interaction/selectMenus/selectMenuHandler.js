// interactions/selectMenus/selectMenuHandler.js - Handles select menu interactions
const { handleOrderStatusUpdate } = require('../../interaction/selectMenus/orderStatus');
const { handleYearOrMonthSelection, handleDaySelection, dateSelections } = require('../../utils/dateSelection');
const { handleCategorySelection } = require('./categorySelection.js');
const { handleLevelSelection } = require('./levelSelection');
const { cleanupOrderSession } = require('../../utils/orderSessionManager');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { formatCategoryName } = require('../utils/roleCategories');
const logger = require('../../utils/logger');

/**
 * Handles role selection from a category
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function handleRoleSelection(interaction, client) {
  try {
    // Defer update to avoid timeout
    await interaction.deferUpdate();
    
    const parts = interaction.customId.split('_');
    const category = parts[2];
    const userId = interaction.user.id;
    const selectedRoleIds = interaction.values;
    
    logger.debug(`Role selection in ${category} by user ${userId}`);
    
    // Skip if "no_roles" placeholder was selected
    if (selectedRoleIds.includes('no_roles')) {
      return;
    }
    
    // Get the order session
    let orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      logger.warn(`No session found for user ${userId} in role selection. Creating recovery session.`);
      orderSession = {
        step: 'select_role_category',
        data: {
          requiredRoles: [],
          clientName: 'Recovered Session',
          compensation: 'To be determined',
          description: 'Session was recovered after being lost.',
          tags: []
        },
        channelId: interaction.channelId
      };
      client.activeOrders.set(userId, orderSession);
    }
    
    // Initialize requiredRoles array if it doesn't exist
    if (!orderSession.data.requiredRoles) {
      orderSession.data.requiredRoles = [];
    }
    
    // Filter out the dummy options
    const validRoleIds = selectedRoleIds.filter(id => !id.startsWith('no_selection_'));
    
    // Process selected roles
    for (const roleId of validRoleIds) {
      // Skip placeholder role
      if (roleId === 'no_roles') continue;
      
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        // Check if role is already selected
        const existingIndex = orderSession.data.requiredRoles.findIndex(r => r.id === roleId);
        
        if (existingIndex === -1) {
          // Add new role
          orderSession.data.requiredRoles.push({
            id: roleId,
            name: role.name
          });
        }
      }
    }
    
    // Save session
    client.activeOrders.set(userId, orderSession);
    
    // Create navigation buttons
    const backButton = new ButtonBuilder()
      .setCustomId(`back_to_categories_${userId}`)
      .setLabel('Back to Categories')
      .setStyle(ButtonStyle.Secondary);
    
    const continueButton = new ButtonBuilder()
      .setCustomId(`continue_to_level_${userId}`)
      .setLabel('Continue to Next Step')
      .setStyle(ButtonStyle.Primary);
    
    const buttonRow = new ActionRowBuilder().addComponents(backButton, continueButton);
    
    // Show current selections
    const selectedRoles = orderSession.data.requiredRoles || [];
    const selectedRolesText = selectedRoles.length > 0 
      ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
      : '';
    
    await interaction.editReply({
      content: `Role(s) selected! You can go back to select more categories or continue to the next step.${selectedRolesText}`,
      components: [buttonRow]
    });
  } catch (error) {
    logger.error(`Error handling role selection:`, error);
    throw error; // Re-throw to be caught by the caller
  }
}

/**
 * Handles select menu interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleSelectMenuInteraction(interaction, client) {
  try {
    const menuId = interaction.customId;
    logger.debug(`Processing select menu interaction: ${menuId}`);
    
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
    
    // Handle date day selection
    else if (menuId.startsWith('date_day_')) {
      await handleDateDaySelection(interaction, client);
    }
    
    // Handle date month selection
    else if (menuId.startsWith('date_month_')) {
      await handleDateMonthSelection(interaction, client);
    }
    
    // Handle date year selection
    else if (menuId.startsWith('date_year_')) {
      await handleDateYearSelection(interaction, client);
    }
    
    else {
      logger.warn(`Unrecognized string select menu customId: ${menuId}`);
    }
    
    logger.debug(`Select menu interaction completed: ${menuId}`);
  } catch (error) {
    logger.error(`Error handling string select menu interaction (${interaction.customId}):`, error);
    
    // Clean up the session to prevent issues
    if (interaction.user?.id) {
      cleanupOrderSession(client, interaction.user.id);
    }
    
    try {
      // If the interaction is already replied to, use followUp
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'Une erreur est survenue lors du traitement de cette interaction. Veuillez réessayer.',
          ephemeral: true
        });
      } else {
        // Otherwise use reply
        await interaction.reply({
          content: 'Une erreur est survenue lors du traitement de cette interaction. Veuillez réessayer.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error("Impossible d'envoyer le message d'erreur", replyError);
    }
  }
}

/**
 * Handles day selection for date
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleDateDaySelection(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    const userId = interaction.user.id;
    const selectedDay = parseInt(interaction.values[0]);
    
    // Get the order session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      return;
    }
    
    // Store the selected day
    orderSession.data.dateDay = selectedDay;
    client.activeOrders.set(userId, orderSession);
    
    // Update the message with the date selection information
    await updateDateSelectionMessage(interaction, client);
  } catch (error) {
    logger.error('Error handling day selection:', error);
    throw error;
  }
}

/**
 * Handles month selection for date
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleDateMonthSelection(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    const userId = interaction.user.id;
    const selectedMonth = parseInt(interaction.values[0]);
    
    // Get the order session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      return;
    }
    
    // Store the selected month
    orderSession.data.dateMonth = selectedMonth;
    client.activeOrders.set(userId, orderSession);
    
    // Update the message with the date selection information
    await updateDateSelectionMessage(interaction, client);
  } catch (error) {
    logger.error('Error handling month selection:', error);
    throw error;
  }
}

/**
 * Handles year selection for date
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleDateYearSelection(interaction, client) {
  try {
    await interaction.deferUpdate();
    
    const userId = interaction.user.id;
    const selectedYear = parseInt(interaction.values[0]);
    
    // Get the order session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      return;
    }
    
    // Store the selected year
    orderSession.data.dateYear = selectedYear;
    client.activeOrders.set(userId, orderSession);
    
    // Update the message with the date selection information
    await updateDateSelectionMessage(interaction, client);
  } catch (error) {
    logger.error('Error handling year selection:', error);
    throw error;
  }
}

/**
 * Updates the message with date selection status
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function updateDateSelectionMessage(interaction, client) {
  try {
    const userId = interaction.user.id;
    const orderSession = client.activeOrders.get(userId);
    
    if (!orderSession) {
      return;
    }
    
    const { dateDay, dateMonth, dateYear } = orderSession.data;
    
    // Get month name if month is selected
    let monthName = 'Not selected';
    if (dateMonth) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
      monthName = months[dateMonth - 1];
    }
    
    // Create status message
    const message = `Please enter the deadline details for your project:
**Day:** ${dateDay || 'Not selected'}
**Month:** ${monthName}
**Year:** ${dateYear || 'Not selected'}`;
    
    // Check if we have a complete date
    const isComplete = dateDay && dateMonth && dateYear;
    if (isComplete) {
      // Highlight the Continue button
      const components = interaction.message.components;
      
      // Find the continue button and make it primary
      for (let i = 0; i < components.length; i++) {
        const row = components[i];
        for (let j = 0; j < row.components.length; j++) {
          const component = row.components[j];
          if (component.customId === `continue_to_roles_${userId}`) {
            component.style = ButtonStyle.Success;
          }
        }
      }
      
      // Update the message
      await interaction.editReply({
        content: `${message}\n✅ Date selection complete! You can continue to the next step.`,
        components: components
      });
    } else {
      // Just update the message content
      await interaction.editReply({
        content: message,
        components: interaction.message.components
      });
    }
  } catch (error) {
    logger.error('Error updating date selection message:', error);
    throw error;
  }
}

module.exports = {
  handleSelectMenuInteraction,
  handleRoleSelection,
  handleDateDaySelection,
  handleDateMonthSelection,
  handleDateYearSelection,
  updateDateSelectionMessage
};