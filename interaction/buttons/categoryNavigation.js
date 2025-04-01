// interactions/buttons/categoryNavigation.js - Handles category navigation for role selection
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');

/**
 * Handle back to categories button
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleBackToCategories(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate().catch(err => logger.error('Error deferring update:', err));
  
  // Always use interaction.user.id for consistency
  const userId = interaction.user.id;
  
  logger.debug(`Button clicked by user: ${userId}`);
  logger.debug(`Active orders keys: ${Array.from(client.activeOrders.keys())}`);
  logger.debug(`Session exists: ${client.activeOrders.has(userId)}`);
  
  // Get or create the order session
  let orderSession = client.activeOrders.get(userId);
  
  if (!orderSession) {
    logger.warn(`Session not found for user: ${userId}. Creating new session.`);
    
    // Create a basic session structure
    orderSession = {
      step: 'select_role_category',
      data: {
        requiredRoles: [],
        clientName: '',
        compensation: '',
        description: '',
        tags: []
      },
      channelId: interaction.channelId
    };
    
    // Try to recover any role data from message content
    try {
      const messageContent = interaction.message.content;
      if (messageContent && messageContent.includes('Currently selected roles:')) {
        const roleList = messageContent.split('Currently selected roles:')[1].trim();
        const roleLines = roleList.split('\n');
        
        for (const line of roleLines) {
          // Extract role name from "- RoleName" format
          const roleName = line.replace(/^- /, '').trim();
          if (roleName) {
            // Try to find role ID
            const role = interaction.guild.roles.cache.find(r => r.name === roleName);
            if (role) {
              orderSession.data.requiredRoles.push({
                name: roleName,
                id: role.id
              });
            } else {
              orderSession.data.requiredRoles.push({
                name: roleName,
                id: null
              });
            }
          }
        }
        logger.debug(`Recovered ${orderSession.data.requiredRoles.length} roles from message`);
      }
    } catch (e) {
      logger.error('Error recovering session data:', e);
    }
    
    // Save session
    client.activeOrders.set(userId, orderSession);
    logger.debug(`New session created for ${userId}`);
  }
  
  // Recreate the category selection menu
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
  
  // Add buttons for skipping or continuing
  const skipButton = new ButtonBuilder()
    .setCustomId(`skip_roles_${userId}`)
    .setLabel('Skip Role Selection')
    .setStyle(ButtonStyle.Secondary);
  
  const continueButton = new ButtonBuilder()
    .setCustomId(`continue_to_level_${userId}`)
    .setLabel('Continue to Next Step')
    .setStyle(ButtonStyle.Primary);
  
  const row1 = new ActionRowBuilder().addComponents(categorySelectMenu);
  const row2 = new ActionRowBuilder().addComponents(skipButton, continueButton);
  
  // Show current selections
  const selectedRoles = orderSession.data.requiredRoles || [];
  const selectedRolesText = selectedRoles.length > 0 
    ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
    : '\n\nNo roles selected yet.';
  
  try {
    await interaction.editReply({
      content: `Select a role category:${selectedRolesText}`,
      components: [row1, row2]
    });
  } catch (error) {
    logger.error('Error in back to categories handler:', error);
    try {
      // If editReply fails, try update instead
      await interaction.update({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2]
      });
    } catch (updateError) {
      logger.error('Error with update fallback:', updateError);
      try {
        // Last resort
        await interaction.followUp({
          content: `Select a role category:${selectedRolesText}`,
          components: [row1, row2],
          ephemeral: true
        });
      } catch (followUpError) {
        logger.error('All response methods failed:', followUpError);
      }
    }
  }
}

module.exports = { handleBackToCategories };