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
  await interaction.deferReply();
  
  // Get values from modal
  const clientName = interaction.fields.getTextInputValue('clientName');
  const compensation = interaction.fields.getTextInputValue('compensation');
  const description = interaction.fields.getTextInputValue('description');
  const tagsInput = interaction.fields.getTextInputValue('tags');
  const levelInput = interaction.fields.getTextInputValue('level') || '1';
  
  // Process level - validate it's between 1-6
  let level = 1;
  if (levelInput && !isNaN(parseInt(levelInput))) {
    level = Math.min(Math.max(parseInt(levelInput), 1), 6);
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
  
  // Process deadline
  let deadline = null;
  try {
    const deadlineString = interaction.fields.getTextInputValue('deadline') || '';
    if (deadlineString.trim()) {
      // Validate deadline format (basic validation)
      if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineString.trim())) {
        deadline = new Date(deadlineString.trim());
        
        // Check if it's a valid date
        if (isNaN(deadline.getTime())) {
          throw new Error('Invalid date');
        }
        
        logger.debug(`Valid deadline parsed: ${deadline.toISOString()}`);
      } else {
        throw new Error('Format incorrect');
      }
    }
  } catch (dateError) {
    logger.warn(`Invalid deadline format: ${interaction.fields.getTextInputValue('deadline')}`);
    // On continue sans deadline en cas d'erreur
    deadline = null;
  }
  
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
    deadline: deadline ? deadline.toISOString() : null,
    level: level
  };
  
  // Get the appropriate channel name for this level to show in preview
  const levelChannelId = getPublishChannelId(level, client);
  const levelChannel = client.channels.cache.get(levelChannelId);
  const channelName = levelChannel ? levelChannel.name : 'canal indisponible';
  
  // Create embed for preview
  const { embed, row } = createSidebarOrderEmbed(orderData);
  const logoAttachment = getLogoAttachment();
  
  // Store order data temporarily
  client.activeOrders.set(interaction.user.id, {
    step: 'preview',
    data: {
      clientName,
      compensation,
      description,
      tags,
      requiredRoles,
      deadline: deadline ? deadline.toISOString() : null,
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
}

module.exports = { handleOrderConfirmationModal };