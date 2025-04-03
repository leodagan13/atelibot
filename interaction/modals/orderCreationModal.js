// interactions/modals/orderCreationModal.js - Handles first order creation modal
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../../utils/logger');

/**
 * Handles the first order creation modal submission and shows the second modal for date inputs
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleFirstOrderModal(interaction, client) {
  try {
    const userId = interaction.user.id;
    
    // Get values from the first form
    const clientName = interaction.fields.getTextInputValue('clientName');
    const compensation = interaction.fields.getTextInputValue('compensation');
    const description = interaction.fields.getTextInputValue('description');
    
    // Store these values in the session
    const orderSession = client.activeOrders.get(userId);
    if (!orderSession) {
      logger.error(`No session found for user ${userId} in first modal handling`);
      return interaction.reply({
        content: 'Error: Your order creation session has expired. Please start again.',
        ephemeral: true
      });
    }
    
    // Update session with captured data
    orderSession.data = {
      clientName,
      compensation,
      description,
      tags: [],
      requiredRoles: []
    };
    orderSession.step = 'date_modal';
    client.activeOrders.set(userId, orderSession);
    
    // Add a function to create date selection components
    function createDateSelectionComponents(userId, client) {
      // Save order in progress for next step
      const orderSession = client.activeOrders.get(userId);
      orderSession.step = 'date_selection';
      client.activeOrders.set(userId, orderSession);

      // Create day selection
      const dayOptions = [];
      for (let i = 1; i <= 31; i++) {
        dayOptions.push({
          label: `${i}`,
          value: `${i}`,
          description: i === 1 ? "1st" : i === 2 ? "2nd" : i === 3 ? "3rd" : `${i}th`
        });
      }
      
      const daySelect = new StringSelectMenuBuilder()
        .setCustomId(`date_day_${userId}`)
        .setPlaceholder('Select Day')
        .addOptions(dayOptions.slice(0, 25)); // Discord limit
      
      // Create month selection
      const monthOptions = [
        { label: 'January', value: '1', emoji: '❄️' },
        { label: 'February', value: '2', emoji: '💘' },
        { label: 'March', value: '3', emoji: '🌱' },
        { label: 'April', value: '4', emoji: '🌧️' },
        { label: 'May', value: '5', emoji: '🌷' },
        { label: 'June', value: '6', emoji: '☀️' },
        { label: 'July', value: '7', emoji: '🏖️' },
        { label: 'August', value: '8', emoji: '🔥' },
        { label: 'September', value: '9', emoji: '🍂' },
        { label: 'October', value: '10', emoji: '🎃' },
        { label: 'November', value: '11', emoji: '🦃' },
        { label: 'December', value: '12', emoji: '🎄' }
      ];
      
      const monthSelect = new StringSelectMenuBuilder()
        .setCustomId(`date_month_${userId}`)
        .setPlaceholder('Select Month')
        .addOptions(monthOptions);

      // Create year selection
      const currentYear = new Date().getFullYear();
      const yearOptions = [];
      for (let i = 0; i < 5; i++) {
        yearOptions.push({
          label: `${currentYear + i}`,
          value: `${currentYear + i}`,
          description: i === 0 ? "Current year" : `${i} year${i > 1 ? 's' : ''} ahead`
        });
      }
      
      const yearSelect = new StringSelectMenuBuilder()
        .setCustomId(`date_year_${userId}`)
        .setPlaceholder('Select Year')
        .addOptions(yearOptions);
      
      // Add tags input
      const tagsButton = new ButtonBuilder()
        .setCustomId(`add_tags_${userId}`)
        .setLabel('Add Tags (Optional)')
        .setStyle(ButtonStyle.Secondary);
        
      const skipButton = new ButtonBuilder()
        .setCustomId(`skip_date_${userId}`)
        .setLabel('Skip Date Selection')
        .setStyle(ButtonStyle.Secondary);
        
      const continueButton = new ButtonBuilder()
        .setCustomId(`continue_to_roles_${userId}`)
        .setLabel('Continue to Next Step')
        .setStyle(ButtonStyle.Primary);
      
      // Create rows
      const dayRow = new ActionRowBuilder().addComponents(daySelect);
      const monthRow = new ActionRowBuilder().addComponents(monthSelect);
      const yearRow = new ActionRowBuilder().addComponents(yearSelect);
      const buttonRow = new ActionRowBuilder().addComponents(tagsButton, skipButton, continueButton);
      
      return [dayRow, monthRow, yearRow, buttonRow];
    }
    
    // Can't show another modal directly, use reply with components instead
    await interaction.reply({
      content: "Please enter the deadline details for your project:",
      ephemeral: true,
      components: createDateSelectionComponents(userId, client)
    });
    
    logger.debug(`Showed second modal (date inputs) to user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling first order modal:', error);
    throw error; // Re-throw to be caught by the modalHandler
  }
}

module.exports = { handleFirstOrderModal };