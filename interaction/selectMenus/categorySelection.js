// interactions/selectMenus/categorySelection.js - Handles category selection for roles
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRolesByCategory, formatCategoryName } = require('../utils/roleCategories');
const logger = require('../../utils/logger');

/**
 * Handle selection of a role category
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleCategorySelection(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const userId = interaction.customId.split('_').pop();
  const category = interaction.values[0];
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // Get roles for the selected category
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
    emoji: role.unicodeEmoji || undefined
  }));
  
  // If no roles in category, add a placeholder option
  if (roleOptions.length === 0) {
    roleOptions.push({
      label: 'No roles in this category',
      value: 'no_roles',
      default: true
    });
  }
  
  if (roleOptions.length < 20) {
    // Add dummy options to reach minimum
    for (let i = roleOptions.length; i < 20; i++) {
      roleOptions.push({
        label: `No selection ${i}`,
        value: `no_selection_${i}`,
        default: false
      });
    }
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
  
  // Show current selections, if any
  const selectedRoles = orderSession.data.requiredRoles || [];
  const selectedRolesText = selectedRoles.length > 0 
    ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
    : '';
  
  await interaction.editReply({
    content: `Select roles from the ${formatCategoryName(category)} category:${selectedRolesText}`,
    components: [row1, row2]
  });
}

module.exports = { handleCategorySelection };