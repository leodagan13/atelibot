// interactions/selectMenus/levelSelection.js - Handles level selection
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const logger = require('../../utils/logger');

/**
 * Handle level selection for a project
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleLevelSelection(interaction, client) {
  // Get user ID from the customId
  const userId = interaction.customId.replace('select_level_', '');
  
  // Get selected level
  const selectedLevel = interaction.values[0];
  
  // Get user's session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.update({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // Store the selected level
  orderSession.data.level = parseInt(selectedLevel);
  
  // Create the order creation modal
  const modal = new ModalBuilder()
    .setCustomId(`create_order_modal_${userId}`)
    .setTitle('Confirm Order Details');
  
  // Add form fields with pre-filled values from session
  const clientNameInput = new TextInputBuilder()
    .setCustomId('clientName')
    .setLabel('Client Name (Confidential)')
    .setValue(orderSession.data.clientName || '')
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  
  const compensationInput = new TextInputBuilder()
    .setCustomId('compensation')
    .setLabel('Compensation for Developer')
    .setValue(orderSession.data.compensation || '')
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  
  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Project Description')
    .setValue(orderSession.data.description || '')
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000);
  
  const tagsInput = new TextInputBuilder()
    .setCustomId('tags')
    .setLabel('Tags (comma separated)')
    .setValue(orderSession.data.tags ? orderSession.data.tags.join(', ') : '')
    .setRequired(false)
    .setStyle(TextInputStyle.Short);
  
  // Format required roles for display
  const requiredRolesText = orderSession.data.requiredRoles?.map(r => r.name).join(', ') || '';
  
  const requiredRolesInput = new TextInputBuilder()
    .setCustomId('requiredRoles')
    .setLabel('Required Roles (comma separated)')
    .setValue(requiredRolesText)
    .setRequired(false)
    .setStyle(TextInputStyle.Short);
  
  // Create rows for the modal
  const clientNameRow = new ActionRowBuilder().addComponents(clientNameInput);
  const compensationRow = new ActionRowBuilder().addComponents(compensationInput);
  const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
  const tagsRow = new ActionRowBuilder().addComponents(tagsInput);
  const requiredRolesRow = new ActionRowBuilder().addComponents(requiredRolesInput);
  
  // Add rows to modal
  modal.addComponents(clientNameRow, compensationRow, descriptionRow, tagsRow, requiredRolesRow);
  
  // Show the modal
  await interaction.showModal(modal);
}

module.exports = { handleLevelSelection };