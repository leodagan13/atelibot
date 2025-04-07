// interactions/modals/orderCreationModal.js - Handles first order creation modal
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const logger = require('../../utils/logger');

/**
 * Handles the first order creation modal submission and shows buttons for date selection
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
    
    // Create button to show date modal
    const dateButton = new ButtonBuilder()
      .setCustomId(`show_date_modal_${userId}`)
      .setLabel('Set Deadline Date')
      .setStyle(ButtonStyle.Primary);
    
    const skipButton = new ButtonBuilder()
      .setCustomId(`skip_date_${userId}`)
      .setLabel('Skip (No Deadline)')
      .setStyle(ButtonStyle.Secondary);
    
    const buttonRow = new ActionRowBuilder().addComponents(dateButton, skipButton);
    
    // Reply with button
    await interaction.reply({
      content: "Project details captured successfully. Click the button below to set a deadline.",
      components: [buttonRow],
      ephemeral: true
    });
    
    logger.debug(`Showed deadline buttons to user ${userId}`);
    
  } catch (error) {
    logger.error('Error handling first order modal:', error);
    throw error; // Re-throw to be caught by the modalHandler
  }
}

module.exports = { handleFirstOrderModal };