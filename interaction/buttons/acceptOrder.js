// interaction/buttons/acceptOrder.js - Logique pour l'acceptation d'offres

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType, 
  PermissionsBitField
} = require('discord.js');
const { activeCoders } = require('../../config/config');
const { orderDB, coderDB } = require('../../database');
const { createPrivateChannelEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const logger = require('../../utils/logger');
const { appearance } = require('../../config/config');

/**
 * Gère l'acceptation d'une offre par un codeur
 * @param {Object} interaction - Interaction Discord (bouton)
 * @param {String} orderId - Identifiant de l'offre
 */
async function handleOrderAcceptance(interaction, orderId) {
  try {
    const coderId = interaction.user.id;
    
    // Log for debugging
    logger.info(`User ${coderId} attempting to accept order ${orderId}`);
    
    // Check if coder is already working on another project
    const coderData = await coderDB.findByUserId(coderId);
    if (coderData && coderData.activeorderid) {
      return interaction.reply({
        content: 'Vous travaillez déjà sur un autre projet. Terminez-le avant d\'en accepter un nouveau.',
        ephemeral: true
      });
    }
    
    // Get the order from database with better error handling
    const order = await orderDB.findById(orderId);
    
    // Check if order exists
    if (!order) {
      logger.error(`Order with ID ${orderId} not found in database`);
      return interaction.reply({
        content: 'Cette offre n\'existe plus ou a déjà été prise.',
        ephemeral: true
      });
    }
    
    // Log for debugging
    logger.debug(`Order data retrieved for acceptance: ${JSON.stringify(order)}`);
    
    // Check if order is still open
    if (order.status !== 'OPEN') {
      return interaction.reply({
        content: 'Cette offre n\'est plus disponible.',
        ephemeral: true
      });
    }
    
    // Update the order in the database
    await orderDB.updateStatus(orderId, 'ASSIGNED', coderId);
    logger.info(`Order ${orderId} status updated to ASSIGNED for coder ${coderId}`);
    
    // Update coder in database
    await coderDB.setActiveOrder(coderId, orderId);
    logger.info(`Coder ${coderId} now has active order ${orderId}`);
    
    // Add coder to active coders list in memory
    activeCoders.add(coderId);
    
    // Create private channel with all data
    const guild = interaction.guild;
    const privateChannel = await createPrivateChannel(guild, order, coderId);
    logger.info(`Created private channel ${privateChannel.id} for order ${orderId}`);
    
    // Send initial message in new channel
    await sendInitialMessage(privateChannel, order, coderId);
    
    // Reply to interaction
    await interaction.reply({
      content: `Vous avez accepté le travail! Un canal privé a été créé: ${privateChannel}`,
      ephemeral: true
    });
    
    // Disable button in original message
    await updateOriginalMessage(interaction);
    
  } catch (error) {
    logger.error(`Error handling order acceptance for ID ${orderId}:`, error);
    await interaction.reply({
      content: 'Une erreur est survenue lors de l\'acceptation de l\'offre.',
      ephemeral: true
    });
  }
}

/**
 * Crée un canal privé pour le projet
 * @param {Object} guild - Serveur Discord
 * @param {Object} order - Données de l'offre
 * @param {String} coderId - ID du codeur
 * @returns {Object} - Le canal créé
 */
async function createPrivateChannel(guild, order, coderId) {
  // ID de la catégorie principale où les canaux de projets actifs doivent être créés
  const PROJECTS_CATEGORY_ID = '1351732830144561192';
  
  // Vérifier si la catégorie existe
  const category = guild.channels.cache.get(PROJECTS_CATEGORY_ID);
  if (!category) {
    logger.warn(`Catégorie de projets avec ID ${PROJECTS_CATEGORY_ID} non trouvée. Le canal sera créé sans catégorie parente.`);
  }
  
  return await guild.channels.create({
    name: `projet-${order.orderid}`,
    type: ChannelType.GuildText,
    parent: category ? category.id : null, // Définir la catégorie parente
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: coderId, // Codeur
        allow: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: order.adminid, // Admin qui a posté
        allow: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: guild.client.user.id, // Le bot
        allow: [PermissionsBitField.Flags.ViewChannel]
      }
    ]
  });
}

/**
 * Envoie un message initial dans le canal du projet
 * @param {Object} channel - Canal Discord
 * @param {Object} order - Données de l'offre
 * @param {String} coderId - ID du codeur
 */
async function sendInitialMessage(channel, order, coderId) {
  logger.debug(`Creating channel message with order: ${JSON.stringify(order)}`);
  
  // Récupérer les tags de l'ordre
  const tagsFormatted = order.tags && order.tags.length > 0
    ? order.tags.map(tag => `🔴 \`${tag}\``).join('\n')
    : 'Aucun tag';
    
  // Create embed with order summary
  const { embed, row } = createPrivateChannelEmbed(order, coderId, appearance.logoUrl);
  const logoAttachment = getLogoAttachment();

  await channel.send({
    embeds: [embed],
    components: [row],
    files: [logoAttachment]
  });
  
  await channel.send(`Bienvenue dans le canal du projet! <@${coderId}> et <@${order.adminid}>, vous pouvez communiquer ici à propos du travail.`);
  
  // Si une deadline est définie, ajouter un message spécifique
  if (order.deadline) {
    const deadlineDate = new Date(order.deadline);
    const discordTimestamp = Math.floor(deadlineDate.getTime() / 1000);
    
    await channel.send({
      content: `⚠️ **Rappel:** Ce projet a une deadline fixée au <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>). Veuillez planifier votre travail en conséquence.`
    });
  }
}

/**
 * Met à jour le message original pour désactiver le bouton
 * @param {Object} interaction - Interaction Discord
 */
async function updateOriginalMessage(interaction) {
  const originalRow = ActionRowBuilder.from(interaction.message.components[0]);
  const button = ButtonBuilder.from(originalRow.components[0]);
  button.setDisabled(true).setLabel('Travail accepté');
  originalRow.setComponents(button);
  
  await interaction.message.edit({
    embeds: interaction.message.embeds,
    components: [originalRow]
  });
}

module.exports = {
  handleOrderAcceptance
}; 