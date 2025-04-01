// interactions/modals/orderCreationModal.js - Handles order creation modal
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

/**
 * Handles the order creation modal submission
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleOrderCreationModal(interaction, client) {
  const userId = interaction.user.id;
  
  // Get values from the form
  const clientName = interaction.fields.getTextInputValue('clientName');
  const compensation = interaction.fields.getTextInputValue('compensation');
  const description = interaction.fields.getTextInputValue('description');
  
  // Process tags
  const tagsString = interaction.fields.getTextInputValue('tags') || '';
  const tags = tagsString.split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  
  // Process deadline
  let deadline = null;
  try {
    const deadlineString = interaction.fields.getTextInputValue('deadline') || '';
    if (deadlineString.trim()) {
      // Validate deadline format (basic validation)
      if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineString.trim())) {
        deadline = new Date(deadlineString.trim());
        
        // Check if it's a valid date
        if (isNaN(deadline.getTime())) {
          logger.warn(`Invalid date for deadline: ${deadlineString}`);
        } else {
          // Valid date, format as ISO string
          deadline = deadline.toISOString();
          logger.info(`Valid deadline parsed: ${deadline}`);
        }
      } else {
        logger.warn(`Invalid deadline format: ${deadlineString}`);
      }
    }
  } catch (dateError) {
    logger.warn(`Error processing deadline: ${dateError.message}`);
  }
  
  // Store these values in the session
  const orderSession = client.activeOrders.get(userId);
  if (orderSession) {
    orderSession.data = {
      clientName,
      compensation,
      description,
      tags,
      deadline,
      requiredRoles: []
    };
    orderSession.step = 'select_role_category';
    
    // Create the category selection menu instead of directly showing all roles
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

    // Respond with the category selection menu
    await interaction.reply({
      content: 'First, select a role category:',
      components: [row1, row2],
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: 'An error occurred: creation session lost.',
      ephemeral: true
    });
  }
}

module.exports = { handleOrderCreationModal };