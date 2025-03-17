// interaction/selectMenus/orderStatus.js - Gestion des mises à jour de statut des offres

const { EmbedBuilder } = require('discord.js');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');

/**
 * Gère la mise à jour du statut d'une offre
 * @param {Object} interaction - Interaction Discord (select menu)
 * @param {String} orderId - Identifiant de l'offre
 */
async function handleOrderStatusUpdate(interaction, orderId) {
  try {
    const userId = interaction.user.id;
    const selectedValue = interaction.values[0];
    
    // Récupérer les informations de l'offre depuis Supabase
    const order = await orderDB.findById(orderId);
    if (!order) {
      return interaction.reply({
        content: 'Cette offre n\'existe plus.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le codeur assigné ou l'admin qui a posté l'offre
    if (order.assignedTo !== userId && order.adminId !== userId) {
      return interaction.reply({
        content: 'Vous n\'êtes pas autorisé à mettre à jour le statut de cette offre.',
        ephemeral: true
      });
    }
    
    // Traiter la sélection de statut
    let newStatus = order.status;
    let message = '';
    
    switch (selectedValue) {
      case 'in_progress':
        newStatus = 'ASSIGNED'; // Déjà assigné, juste une confirmation
        message = 'Le projet est marqué comme étant en cours.';
        break;
        
      case 'completed':
        newStatus = 'COMPLETED';
        message = 'Félicitations! Le projet a été marqué comme terminé.';
        
        // Si c'est le codeur qui complète l'offre, mettre à jour son profil
        if (userId === order.assignedTo) {
          await coderDB.incrementCompletedOrders(userId);
        }
        break;
        
      case 'cancelled':
        newStatus = 'CANCELLED';
        message = 'Le projet a été annulé.';
        
        // Libérer le codeur pour qu'il puisse prendre d'autres offres
        if (order.assignedTo) {
          await coderDB.setActiveOrder(order.assignedTo, null);
        }
        break;
        
      default:
        return interaction.reply({
          content: 'Statut non reconnu.',
          ephemeral: true
        });
    }
    
    // Mettre à jour l'offre dans la base de données
    await orderDB.updateStatus(orderId, newStatus);
    
    // Mettre à jour le message avec l'embed
    await updateChannelEmbed(interaction, order, newStatus);
    
    // Répondre à l'interaction
    await interaction.reply({
      content: message,
      ephemeral: true
    });
    
    // Envoyer un message de notification dans le canal
    await interaction.channel.send({
      content: `**Mise à jour du projet #${orderId}**: Le statut est maintenant "${getStatusLabel(newStatus)}" (mis à jour par <@${userId}>).`
    });
    
    // Si le statut est CANCELLED, envoyer un message dans le canal d'historique
    if (newStatus === 'CANCELLED' || newStatus === 'COMPLETED') {
      const historyChannel = interaction.guild.channels.cache.get(
        require('../../config/config').HISTORY_ORDERS_CHANNEL_ID
      );
      
      if (historyChannel) {
        const color = newStatus === 'COMPLETED' ? '#00FF00' : '#FF0000';
        const emoji = newStatus === 'COMPLETED' ? '✅' : '❌';
        const title = newStatus === 'COMPLETED' ? 'Commande terminée' : 'Commande annulée';
        
        const historyEmbed = new EmbedBuilder()
          .setColor(color)
          .setTitle(`${emoji} ${title} #${order.orderId}`)
          .setDescription(`La commande pour **${order.clientName}** a été ${newStatus === 'COMPLETED' ? 'terminée' : 'annulée'}.`)
          .addFields(
            { name: 'Client', value: order.clientName },
            { name: 'Rémunération', value: order.compensation },
            { name: 'Codeur', value: order.assignedTo ? `<@${order.assignedTo}>` : 'Non assigné' },
            { name: 'Admin responsable', value: `<@${order.adminId}>` },
            { name: `${newStatus === 'COMPLETED' ? 'Terminée' : 'Annulée'} par`, value: `<@${userId}>` }
          );
          
        // Ajouter la durée du projet si c'est une complétion
        if (newStatus === 'COMPLETED' && order.assignedAt) {
          // Importe la fonction getProjectDuration
          const completeOrderModule = require('../buttons/completeOrder');
          const getProjectDuration = completeOrderModule.getProjectDuration;
          
          historyEmbed.addFields({ name: 'Durée du projet', value: getProjectDuration(order) });
        }
        
        historyEmbed.setTimestamp();
        
        await historyChannel.send({ embeds: [historyEmbed] });
      }
    }
    
  } catch (error) {
    logger.error('Error handling order status update:', error);
    await interaction.reply({
      content: 'Une erreur est survenue lors de la mise à jour du statut.',
      ephemeral: true
    });
  }
}

/**
 * Met à jour l'embed du canal avec le nouveau statut
 * @param {Object} interaction - Interaction Discord
 * @param {Object} order - Données de l'offre
 * @param {String} newStatus - Nouveau statut
 */
async function updateChannelEmbed(interaction, order, newStatus) {
  // Récupérer le message d'origine avec l'état du projet
  const messages = await interaction.channel.messages.fetch({ limit: 10 });
  const projectMessage = messages.find(m => 
    m.embeds.length > 0 && 
    m.embeds[0].title && 
    m.embeds[0].title.includes(`Projet #${order.orderId}`)
  );
  
  if (projectMessage) {
    const originalEmbed = EmbedBuilder.from(projectMessage.embeds[0]);
    
    // Mettre à jour la couleur selon le statut
    switch (newStatus) {
      case 'ASSIGNED':
        originalEmbed.setColor('#FFA500'); // Orange
        break;
      case 'COMPLETED':
        originalEmbed.setColor('#00FF00'); // Vert
        break;
      case 'CANCELLED':
        originalEmbed.setColor('#FF0000'); // Rouge
        break;
    }
    
    // Ajouter ou mettre à jour le champ de statut
    const statusField = originalEmbed.fields.find(f => f.name === 'Statut');
    if (statusField) {
      statusField.value = getStatusLabel(newStatus);
    } else {
      originalEmbed.addFields({ name: 'Statut', value: getStatusLabel(newStatus) });
    }
    
    // Désactiver les composants si l'offre est terminée ou annulée
    let components = [];
    if (newStatus !== 'COMPLETED' && newStatus !== 'CANCELLED' && projectMessage.components.length > 0) {
      components = projectMessage.components;
    }
    
    await projectMessage.edit({
      embeds: [originalEmbed],
      components: components
    });
  }
}

/**
 * Obtient le libellé correspondant au statut
 * @param {String} status - Code du statut
 * @returns {String} - Libellé du statut
 */
function getStatusLabel(status) {
  switch (status) {
    case 'OPEN': return '🟢 Ouvert';
    case 'ASSIGNED': return '🟠 En cours';
    case 'COMPLETED': return '✅ Terminé';
    case 'CANCELLED': return '❌ Annulé';
    default: return status;
  }
}

module.exports = {
  handleOrderStatusUpdate
};