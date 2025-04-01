// interactions/selectMenus/roleSelection.js - Handles role selection
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRolesByCategory, formatCategoryName } = require('../utils/roleCategories');
const logger = require('../../utils/logger');

/**
 * Handle role selection from a category
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleRoleSelection(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const parts = interaction.customId.split('_');
  const category = parts[2];
  const userId = parts[3];
  const selectedRoleIds = interaction.values;
  
  // Skip if "no_roles" placeholder was selected
  if (selectedRoleIds.includes('no_roles')) {
    return;
  }
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // Initialize requiredRoles array if it doesn't exist
  if (!orderSession.data.requiredRoles) {
    orderSession.data.requiredRoles = [];
  }
  
  // Process selected roles
  for (const roleId of selectedRoleIds) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (role) {
      // Check if role is already selected
      const existingIndex = orderSession.data.requiredRoles.findIndex(r => r.id === roleId);
      
      if (existingIndex >= 0) {
        // Role already exists, do nothing
      } else {
        // Add new role
        orderSession.data.requiredRoles.push({
          id: roleId,
          name: role.name
        });
      }
    }
  }
  
  // Refresh the current category view
  const roles = getRolesByCategory(interaction.guild, category);
  
  // Create role selection menu
  const roleSelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_roles_${category}_${userId}`)
    .setPlaceholder(`Select ${formatCategoryName(category)} roles (max 20)`)
    .setMinValues(0)
    .setMaxValues(20);
  
  // Add roles as options (limit to 25 which is Discord's max)
  const roleOptions = roles.slice(0, 25).map(role => ({
    label: role.name,
    value: role.id,
    emoji: role.unicodeEmoji || undefined,
    // Mark as default if already selected
    default: orderSession.data.requiredRoles.some(r => r.id === role.id)
  }));
  
  if (roleOptions.length === 0) {
    roleOptions.push({
      label: 'No roles in this category',
      value: 'no_roles',
      default: true
    });
  }
  
  roleSelectMenu.addOptions(roleOptions);
  
  // Create navigation buttons
  const backButton = new ButtonBuilder()
    .setCustomId(`back_to_categories_${userId}`)
    .setLabel('Back to Categories')
    .setStyle(ButtonStyle.Secondary);
  
  const continueButton = new ButtonBuilder()
    .setCustomId(`continue_to_level_${userId}`)
    .setLabel('Continue to Next Step')
    .setStyle(ButtonStyle.Primary);
  
  const row1 = new ActionRowBuilder().addComponents(roleSelectMenu);
  const row2 = new ActionRowBuilder().addComponents(backButton, continueButton);
  
  // Show current selections
  const selectedRoles = orderSession.data.requiredRoles || [];
  const selectedRolesText = selectedRoles.length > 0 
    ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
    : '';
  
  await interaction.editReply({
    content: `Role(s) selected! Select more from the ${formatCategoryName(category)} category or navigate using the buttons below.${selectedRolesText}`,
    components: [row1, row2]
  });
}

module.exports = { handleRoleSelection };