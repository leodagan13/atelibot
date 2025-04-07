// interaction/modals/orderDateModal.js
const logger = require('../../utils/logger');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handles the date modal submission
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleDateModal(interaction, client) {
  try {
    const userId = interaction.user.id;
    
    // Get form values
    const year = interaction.fields.getTextInputValue('year');
    const month = interaction.fields.getTextInputValue('month');
    const day = interaction.fields.getTextInputValue('day');
    const tagsString = interaction.fields.getTextInputValue('tags') || '';
    
    // Process tags
    const tags = tagsString.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    // Get the order session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      logger.error(`No session found for user ${userId} in date modal handling`);
      return interaction.reply({
        content: 'Error: Your order creation session has expired. Please start again.',
        ephemeral: true
      });
    }
    
    // Update the session with the new data
    orderSession.data.tags = tags;
    
    // Process date inputs into a standardized format if all are provided
    if (day && month && year) {
      // Validate date format
      const paddedDay = day.padStart(2, '0');
      const paddedMonth = month.padStart(2, '0');
      
      // Simple validation
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (
        dayNum >= 1 && dayNum <= 31 &&
        monthNum >= 1 && monthNum <= 12 &&
        yearNum >= 2024 && yearNum <= 2100
      ) {
        // Create ISO date string (YYYY-MM-DD)
        const dateString = `${year}-${paddedMonth}-${paddedDay}`;
        orderSession.data.deadline = dateString;
        logger.debug(`Valid date set: ${dateString}`);
      } else {
        logger.warn(`Invalid date provided: ${day}/${month}/${year}`);
        // Don't set deadline if invalid
      }
    } else if (day || month || year) {
      // Some but not all date parts were provided
      logger.warn(`Incomplete date provided: day=${day}, month=${month}, year=${year}`);
    }
    
    // Update the session step
    orderSession.step = 'select_role_category';
    client.activeOrders.set(userId, orderSession);
    
    // Now start the role selection process
    await startRoleSelection(interaction, client);
  } catch (error) {
    logger.error('Error handling date modal:', error);
    throw error; // Re-throw to be caught by the modalHandler
  }
}

/**
 * Starts the role selection process
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function startRoleSelection(interaction, client) {
  const { StringSelectMenuBuilder } = require('discord.js');
  
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
    
    // Reply to the interaction
    await interaction.reply({
      content: `First, select a role category for your project.${deadlineInfo}`,
      components: [row1, row2],
      ephemeral: true
    });
    
    logger.debug(`Started role selection for user ${userId}`);
  } catch (error) {
    logger.error('Error starting role selection:', error);
    throw error;
  }
}

module.exports = { 
  handleDateModal
};