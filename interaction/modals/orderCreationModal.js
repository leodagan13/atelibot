// interactions/modals/orderCreationModal.js - Handles order creation modal
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');
const { startDateSelection } = require('../../utils/dateSelection');

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
  
  // Process date inputs
  const year = interaction.fields.getTextInputValue('year') || '';
  const month = interaction.fields.getTextInputValue('month') || '';
  const day = interaction.fields.getTextInputValue('day') || '';

  // Combine into a date string if all parts are provided
  let deadline = null;
  if (year && month && day) {
    // Ensure padding with leading zeros for month and day
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    deadline = `${year}-${paddedMonth}-${paddedDay}`;
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
    
    // Start the date selection process
    await startDateSelection(interaction, client);
  } else {
    await interaction.reply({
      content: 'An error occurred: creation session lost.',
      ephemeral: true
    });
  }
}

module.exports = { handleOrderCreationModal };