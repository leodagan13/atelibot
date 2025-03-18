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
    
    // Vérifier si le codeur travaille déjà sur un autre projet
    const coderData = await coderDB.findByUserId(coderId);
    if (coderData && coderData.activeorderid) {
      return interaction.reply({
        content: 'Vous travaillez déjà sur un autre projet. Terminez-le avant d\'en accepter un nouveau.',
        ephemeral: true
      });
    }
    
    // Récupérer les informations de l'offre depuis Supabase
    const order = await orderDB.findById(orderId);
    if (!order) {
      return interaction.reply({
        content: 'Cette offre n\'existe plus ou a déjà été prise.',
        ephemeral: true
      });
    }
    
    if (order.status !== 'OPEN') {
      return interaction.reply({
        content: 'Cette offre n\'est plus disponible.',
        ephemeral: true
      });
    }
    
    // Mettre à jour l'offre dans la base de données
    await orderDB.updateStatus(orderId, 'ASSIGNED', coderId);
    
    // Mettre à jour le codeur dans la base de données
    await coderDB.setActiveOrder(coderId, orderId);
    
    // Ajouter le codeur à la liste des codeurs actifs en mémoire
    activeCoders.add(coderId);
    
    // Créer un channel privé
    const guild = interaction.guild;
    const privateChannel = await createPrivateChannel(guild, order, coderId);
    
    // Envoyer un message dans le nouveau canal
    await sendInitialMessage(privateChannel, order, coderId);
    
    // Répondre à l'interaction
    await interaction.reply({
      content: `Vous avez accepté le travail! Un canal privé a été créé: ${privateChannel}`,
      ephemeral: true
    });
    
    // Désactiver le bouton dans le message original
    await updateOriginalMessage(interaction);
    
  } catch (error) {
    logger.error('Error handling order acceptance:', error);
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
  return await guild.channels.create({
    name: `projet-${order.orderid}`,
    type: ChannelType.GuildText,
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