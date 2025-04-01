// interactions/buttons/levelNavigation.js - Handles level selection navigation
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

/**
 * Handle skipping role selection or continuing to next step
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleContinueToLevel(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const userId = interaction.customId.split('_').pop();
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // If this is a skip_roles action, ensure an empty requiredRoles array
  if (interaction.customId.startsWith('skip_roles_')) {
    orderSession.data.requiredRoles = [];
  }
  
  // Move to level selection step
  orderSession.step = 'select_level';
  
  // Check if user is a super admin
  const isSuperAdmin = interaction.member.roles.cache.has("1351725292741197976");
  
  // Create level selection menu
  const levelSelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_level_${userId}`)
        .setPlaceholder('Select difficulty level')
        .addOptions([
          { label: 'Level 1 - Easy', value: '1', emoji: '🟩', description: 'Simple project for beginners' },
          { label: 'Level 2 - Beginner', value: '2', emoji: '🟨', description: 'Some knowledge required' },
          { label: 'Level 3 - Intermediate', value: '3', emoji: '🟧', description: 'Medium difficulty' },
          { label: 'Level 4 - Advanced', value: '4', emoji: '🟥', description: 'Complex project' },
          { label: 'Level 5 - Expert', value: '5', emoji: '🔴', description: 'Expertise required' },
          // Level 6 only for super admin
          ...(isSuperAdmin ? [
            { label: 'Level 6 - Super Expert', value: '6', emoji: '⚫', description: 'Reserved for exceptional projects' }
          ] : [])
        ])
    );
  
  await interaction.editReply({
    content: 'Now, select the difficulty level for this project:',
    components: [levelSelectRow]
  });
}

module.exports = { handleContinueToLevel };