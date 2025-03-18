// interaction/buttons/adminComplete.js - Gestionnaire pour la clôture de projet par un administrateur
const { EmbedBuilder } = require('discord.js');
const { orderDB, coderDB } = require('../../database');
const { adminRoles, HISTORY_ORDERS_CHANNEL_ID } = require('../../config/config');
const logger = require('../../utils/logger');
const { createNotification, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

/**
 * Gère la clôture d'un projet par un administrateur
 * @param {Object} interaction - Interaction Discord (bouton)
 * @param {String} orderId - Identifiant de l'offre
 */
async function handleAdminCompletion(interaction, orderId) {
  try {
    const userId = interaction.user.id;
    
    // Récupérer les informations de l'offre depuis Supabase
    const order = await orderDB.findById(orderId);
    if (!order) {
      return interaction.reply({
        content: 'Cette offre n\'existe plus.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est un administrateur
    const isAdmin = interaction.member.roles.cache.some(role => 
      adminRoles.includes(role.name)
    );
    
    if (!isAdmin) {
      return interaction.reply({
        content: 'Vous n\'avez pas la permission de clôturer ce projet. Seuls les administrateurs peuvent le faire.',
        ephemeral: true
      });
    }
    
    // Vérifier que l'offre est au statut ASSIGNED
    if (order.status !== 'ASSIGNED') {
      return interaction.reply({
        content: `Ce projet ne peut pas être clôturé car il est au statut ${order.status}.`,
        ephemeral: true
      });
    }
    
    // Mettre à jour l'offre dans la base de données
    await orderDB.updateStatus(orderId, 'COMPLETED');
    
    // Si l'offre a un codeur assigné, mettre à jour son profil
    if (order.assignedto) {
      await coderDB.incrementCompletedOrders(order.assignedto);
    }
    
    // Mettre à jour le message d'origine
    await updateOriginalMessage(interaction, order);
    
    // Répondre à l'interaction
    await interaction.reply({
      content: 'Le projet a été clôturé avec succès.',
      ephemeral: true
    });
    
    // Envoyer un message de confirmation dans le canal
    const embed = createNotification(
        'Admin Verification Complete',
        `The project #${order.orderid} has been verified and marked as completed by an administrator.`,
        'SUCCESS'
    );
    
    const logoAttachment = getLogoAttachment();
    
    await interaction.channel.send({
      embeds: [embed],
      files: [logoAttachment]
    });
    
    // Envoyer un message dans le canal d'historique
    const historyChannel = interaction.guild.channels.cache.get(HISTORY_ORDERS_CHANNEL_ID);
    
    if (historyChannel) {
      const historyEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`✅ Commande terminée #${order.orderid}`)
        .setDescription(`La commande a été terminée avec succès.`)
        .addFields(
          { name: 'Client', value: 'Client confidentiel' },
          { name: 'Rémunération', value: order.compensation },
          { name: 'Codeur', value: order.assignedto ? `<@${order.assignedto}>` : 'Non assigné' },
          { name: 'Admin responsable', value: `<@${order.adminid}>` },
          { name: 'Clôturé par', value: `<@${userId}>` },
          { name: 'Durée du projet', value: getProjectDuration(order) }
        )
        .setTimestamp();
      
      await historyChannel.send({ 
        embeds: [historyEmbed],
        files: [logoAttachment]
      });
    }
    
  } catch (error) {
    logger.error('Error handling admin completion:', error);
    await interaction.reply({
      content: 'Une erreur est survenue lors de la clôture du projet.',
      ephemeral: true
    });
  }
}

/**
 * Met à jour le message original pour indiquer que le projet est clôturé
 * @param {Object} interaction - Interaction Discord
 * @param {Object} order - Données de l'offre
 */
async function updateOriginalMessage(interaction, order) {
  // Récupérer le message d'origine avec l'état du projet
  const messages = await interaction.channel.messages.fetch({ limit: 10 });
  const projectMessage = messages.find(m => 
    m.embeds.length > 0 && 
    m.embeds[0].title && 
    m.embeds[0].title.includes(`Projet #${order.orderid}`)
  );
  
  if (projectMessage) {
    const originalEmbed = EmbedBuilder.from(projectMessage.embeds[0]);
    originalEmbed.setColor('#FF0000');
    originalEmbed.setDescription('Ce projet a été clôturé par un administrateur.');
    
    // Désactiver tous les composants
    await projectMessage.edit({
      embeds: [originalEmbed],
      components: []
    });
  }
}

/**
 * Calcule la durée d'un projet
 * @param {Object} order - Données de la commande
 * @returns {String} - Durée formatée
 */
function getProjectDuration(order) {
  if (!order.assignedat || !order.completedat) {
    return 'Non disponible';
  }
  
  const assignedDate = new Date(order.assignedat);
  const completedDate = new Date(order.completedat);
  const durationMs = completedDate - assignedDate;
  
  // Convertir en jours, heures, minutes
  const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days} jour(s), ${hours} heure(s)`;
  } else {
    return `${hours} heure(s), ${minutes} minute(s)`;
  }
}

module.exports = {
  handleAdminCompletion
}; 