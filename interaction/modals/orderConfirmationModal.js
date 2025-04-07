// interactions/modals/orderConfirmationModal.js - Handles order confirmation modal
const logger = require('../../utils/logger');
const { getPublishChannelId } = require('../buttons/orderCreation');
const { createSidebarOrderEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');

/**
 * Handles the order confirmation modal submission
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleOrderConfirmationModal(interaction, client) {
  try {
    await interaction.deferReply();
    
    // Get values from modal
    const clientName = interaction.fields.getTextInputValue('clientName');
    const compensation = interaction.fields.getTextInputValue('compensation');
    const description = interaction.fields.getTextInputValue('description');
    
    // Get user's session data
    const userId = interaction.user.id;
    const orderSession = client.activeOrders.get(userId);
    
    if (!orderSession) {
      logger.error(`No session found for user ${userId} in order confirmation modal.`);
      return interaction.editReply({
        content: 'Error: Your order creation session has expired. Please start again.',
        embeds: [],
        components: [],
        files: []
      });
    }
    
    // Get level from session instead of modal input
    let level = orderSession.data.level || 1;
    
    // Ensure level is valid
    if (isNaN(parseInt(level))) {
      level = 1;
    } else {
      level = Math.min(Math.max(parseInt(level), 1), 6);
    }
    
    // Check for level 6 - only a super administrator can create a level 6 project
    const SUPER_ADMIN_ID = "1351725292741197976";
    if (level === 6 && !interaction.member.roles.cache.has(SUPER_ADMIN_ID)) {
      // If the user is not a super admin and tries to create a level 6 project,
      // we limit it to 5 and inform them
      level = 5;
      await interaction.followUp({
        content: "⚠️ Only a super administrator can create a level 6 project. The level has been adjusted to 5.",
        ephemeral: true
      });
    }
      
    // Process required roles
    const requiredRolesInput = interaction.fields.getTextInputValue('requiredRoles');
    let requiredRoles = [];
    
    try {
      if (requiredRolesInput.trim()) {
        requiredRoles = requiredRolesInput.split(',')
          .map(role => role.trim())
          .filter(role => role.length > 0)
          .map(role => {
            // Remove @ if present
            const roleName = role.startsWith('@') ? role.substring(1) : role;
            // Try to find role in guild
            const guildRole = interaction.guild.roles.cache.find(r => r.name === roleName);
            return {
              name: roleName,
              id: guildRole ? guildRole.id : null
            };
          });
      }
    } catch (roleError) {
      logger.error('Error processing required roles:', roleError);
      requiredRoles = [];
    }
    
    // Process deadline - use from session if available
    let deadline = orderSession.data.deadline || null;
    
    // Generate unique order ID
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create order data for preview
    const orderData = {
      orderid: uniqueOrderId,
      description: description,
      compensation: compensation,
      requiredRoles: requiredRoles,
      adminName: interaction.user.tag,
      adminid: interaction.user.id,
      clientName: clientName,
      deadline: deadline,
      level: level
    };
    
    // Get the appropriate channel name for this level to show in preview
    const levelChannelId = getPublishChannelId(level, client);
    const levelChannel = client.channels.cache.get(levelChannelId);
    const channelName = levelChannel ? levelChannel.name : 'channel unavailable';
    
    // Create embed for preview
    const { embed, row } = createSidebarOrderEmbed(orderData, true);
    const logoAttachment = getLogoAttachment();
    
    // Update session with the latest data
    client.activeOrders.set(userId, {
      step: 'preview',
      data: {
        clientName,
        compensation,
        description,
        requiredRoles,
        deadline: deadline,
        level: level
      },
      channelId: interaction.channelId
    });
    
    // Send preview with buttons
    await interaction.editReply({
      content: `Here is a preview of your level ${level} order. It will be published in the #${channelName} channel. Check the details and confirm the publication.`,
      embeds: [embed],
      components: [row],
      files: [logoAttachment]
    });
    
  } catch (error) {
    logger.error('Error handling order confirmation modal:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'An error occurred while processing the form. Please try again.',
          embeds: [],
          components: [],
          files: []
        });
      } else {
        await interaction.reply({
          content: 'An error occurred while processing the form. Please try again.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error('Failed to respond with error message:', replyError);
    }
  }
}

module.exports = { handleOrderConfirmationModal };