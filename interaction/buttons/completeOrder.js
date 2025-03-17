// interaction/buttons/completeOrder.js - Logique pour la complétion d'offres

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');

/**
 * Gère la complétion d'une offre par un codeur ou un administrateur
 * @param {Object} interaction - Interaction Discord (bouton)
 * @param {String} orderId - Identifiant de l'offre
 */
async function handleOrderCompletion(interaction, orderId) {
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
    
    // Vérifier si l'utilisateur est le codeur assigné ou l'admin qui a posté l'offre
    if (order.assignedto !== userId && order.adminid !== userId) {
      return interaction.reply({
        content: 'Vous n\'êtes pas autorisé à terminer cette offre.',
        ephemeral: true
      });
    }
    
    // Vérifier que l'offre est au statut ASSIGNED
    if (order.status !== 'ASSIGNED') {
      return interaction.reply({
        content: `Cette offre ne peut pas être terminée car elle est au statut ${order.status}.`,
        ephemeral: true
      });
    }
    
    // Mettre à jour l'offre dans la base de données
    await orderDB.updateStatus(orderId, 'COMPLETED');
    
    // Si c'est le codeur qui complète l'offre, mettre à jour son profil
    if (userId === order.assignedto) {
      await coderDB.incrementCompletedOrders(userId);
    }
    
    // Mettre à jour le message d'origine
    await updateOriginalMessage(interaction, order);
    
    // Répondre à l'interaction
    await interaction.reply({
      content: 'Félicitations! L\'offre a été marquée comme terminée.',
      ephemeral: true
    });
    
    // Envoyer un message de confirmation dans le canal
    await interaction.channel.send({
      content: `🎉 **Projet terminé!** 🎉\n\nLe projet #${orderId} a été marqué comme terminé par <@${userId}>.\nMerci pour votre travail!`,
      embeds: [createCompletionEmbed(order, userId)]
    });
    
    // Envoyer un message dans le canal d'historique
    const historyChannel = interaction.guild.channels.cache.get(
      require('../../config/config').HISTORY_ORDERS_CHANNEL_ID
    );
    
    if (historyChannel) {
      const historyEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle(`✅ Commande terminée #${order.orderid}`)
        .setDescription(`La commande pour **${order.clientname}** a été terminée avec succès.`)
        .addFields(
          { name: 'Client', value: order.clientname },
          { name: 'Rémunération', value: order.compensation },
          { name: 'Codeur', value: `<@${order.assignedto}>` },
          { name: 'Admin responsable', value: `<@${order.adminid}>` },
          { name: 'Durée du projet', value: getProjectDuration(order) }
        )
        .setTimestamp();
      
      await historyChannel.send({ embeds: [historyEmbed] });
    }
    
  } catch (error) {
    logger.error('Error handling order completion:', error);
    await interaction.reply({
      content: 'Une erreur est survenue lors de la complétion de l\'offre.',
      ephemeral: true
    });
  }
}

/**
 * Met à jour le message original pour indiquer que l'offre est terminée
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
    originalEmbed.setColor('#00FF00');
    originalEmbed.setDescription('Ce projet a été marqué comme terminé.');
    
    // Désactiver tous les composants
    const components = [];
    if (projectMessage.components.length > 0) {
      const originalRow = ActionRowBuilder.from(projectMessage.components[0]);
      originalRow.components.forEach(comp => {
        if (comp.type === 3) { // SelectMenu
          comp.setDisabled(true);
          comp.setPlaceholder('Projet terminé');
        }
      });
      components.push(originalRow);
    }
    
    await projectMessage.edit({
      embeds: [originalEmbed],
      components: components
    });
  }
}

/**
 * Crée un embed pour la confirmation de complétion
 * @param {Object} order - Données de l'offre
 * @param {String} completedBy - ID de l'utilisateur ayant complété l'offre
 * @returns {EmbedBuilder} - Embed de complétion
 */
function createCompletionEmbed(order, completedBy) {
  return new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('Projet terminé')
    .setDescription(`Le projet pour ${order.clientname} a été terminé avec succès.`)
    .addFields(
      { name: 'ID du projet', value: order.orderid },
      { name: 'Terminé par', value: `<@${completedBy}>` },
      { name: 'Date de complétion', value: new Date().toLocaleDateString() }
    )
    .setTimestamp();
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
  handleOrderCompletion,
  getProjectDuration
};