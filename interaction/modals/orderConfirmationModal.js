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
    const tagsInput = interaction.fields.getTextInputValue('tags');
    
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
    
    // Vérification pour le niveau 6 - seul un super administrateur peut créer un projet niveau 6
    const SUPER_ADMIN_ID = "1351725292741197976";
    if (level === 6 && !interaction.member.roles.cache.has(SUPER_ADMIN_ID)) {
      // Si l'utilisateur n'est pas un super admin et tente de créer un projet niveau 6,
      // on limite à 5 et on l'informe
      level = 5;
      await interaction.followUp({
        content: "⚠️ Seul un super administrateur peut créer un projet de niveau 6. Le niveau a été ajusté à 5.",
        ephemeral: true
      });
    }
    
    // Process tags
    const tags = tagsInput.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
      
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
      tags: tags,
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
    const channelName = levelChannel ? levelChannel.name : 'canal indisponible';
    
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
        tags,
        requiredRoles,
        deadline: deadline,
        level: level
      },
      channelId: interaction.channelId
    });
    
    // Send preview with buttons
    await interaction.editReply({
      content: `Voici un aperçu de votre offre de niveau ${level}. Elle sera publiée dans le canal #${channelName}. Vérifiez les détails et confirmez la publication.`,
      embeds: [embed],
      components: [row],
      files: [logoAttachment]
    });
    
  } catch (error) {
    logger.error('Error handling order confirmation modal:', error);
    try {
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Une erreur est survenue lors du traitement du formulaire. Veuillez réessayer.',
          embeds: [],
          components: [],
          files: []
        });
      } else {
        await interaction.reply({
          content: 'Une erreur est survenue lors du traitement du formulaire. Veuillez réessayer.',
          ephemeral: true
        });
      }
    } catch (replyError) {
      logger.error('Failed to respond with error message:', replyError);
    }
  }
}

module.exports = { handleOrderConfirmationModal };