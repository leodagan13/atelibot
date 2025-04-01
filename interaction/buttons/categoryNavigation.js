// interactions/buttons/categoryNavigation.js - Handles category navigation for role selection
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Handle back to categories button
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleBackToCategories(interaction, client) {
  // Add debug logging
  console.log('Button clicked by user:', interaction.user.id);
  console.log('Active orders before:', Array.from(client.activeOrders.keys()));
  
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const userId = interaction.user.id;
  
  console.log('Checking for session with ID:', userId);
  console.log('Session exists:', client.activeOrders.has(userId));
  
  // Get the order session with recovery mechanism
  if (!client.activeOrders.has(userId)) {
    console.log('Recreating lost session for user:', userId);
    
    // Get any previous data from interaction components if possible
    let previousData = {};
    try {
      // Try to extract previous roles from message content
      const messageContent = interaction.message.content;
      if (messageContent.includes('Currently selected roles:')) {
        // Extract role information if available
        console.log('Attempting to recover session data from message content');
      }
    } catch (e) {
      console.error('Error recovering session data:', e);
    }
    
    // Create a fresh session
    client.activeOrders.set(userId, {
      step: 'select_role_category',
      data: {
        requiredRoles: [],
        ...previousData
      },
      channelId: interaction.channelId
    });
    
    console.log('New session created:', client.activeOrders.get(userId));
  }
  
  const orderSession = client.activeOrders.get(userId);
  
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
    // Make sure we're using the correct method based on the interaction state
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2]
      });
    } else {
      await interaction.update({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2]
      });
    }
  } catch (error) {
    console.error('Error in back to categories handler:', error);
    // Try one last method if the others fail
    try {
      await interaction.followUp({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2],
        ephemeral: true
      });
    } catch (followUpError) {
      console.error('Failed to respond in handleBackToCategories:', followUpError);
    }
  }
}

module.exports = { handleBackToCategories };