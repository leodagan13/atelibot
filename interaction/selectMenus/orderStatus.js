// interaction/selectMenus/orderStatus.js - Gestion des mises à jour de statut des offres

const { EmbedBuilder } = require('discord.js');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');
const { updateChannelEmbedWithLogo } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

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
    if (order.assignedto !== userId && order.adminid !== userId) {
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
        if (userId === order.assignedto) {
          await coderDB.incrementCompletedOrders(userId);
        }
        break;
        
      case 'cancelled':
        newStatus = 'CANCELLED';
        message = 'Le projet a été annulé.';
        
        // Libérer le codeur pour qu'il puisse prendre d'autres offres
        if (order.assignedto) {
          await coderDB.setActiveOrder(order.assignedto, null);
        }
        
        // Supprimer le message dans le canal de publication
        if (newStatus === 'CANCELLED') {
          try {
            const publishChannelId = require('../../config/config').PUBLISH_ORDERS_CHANNEL_ID;
            const publishChannel = interaction.guild.channels.cache.get(publishChannelId);
            
            if (publishChannel && order.messageid) {
              try {
                const orderMessage = await publishChannel.messages.fetch(order.messageid);
                if (orderMessage) {
                  await orderMessage.delete();
                  logger.info(`Deleted message ${order.messageid} for cancelled order ${orderId}`);
                }
              } catch (fetchError) {
                logger.error(`Failed to fetch message ${order.messageid} for order ${orderId}:`, fetchError);
              }
            } else {
              // Méthode alternative - rechercher le message par contenu
              try {
                const publishChannel = interaction.client.channels.cache.get(publishChannelId);
                if (publishChannel) {
                  // Fetch recent messages in the publish channel
                  const messages = await publishChannel.messages.fetch({ limit: 50 });
                  
                  // Find the message that contains the order ID
                  const orderMessage = messages.find(m => 
                    m.embeds.length > 0 && 
                    m.embeds[0].fields && 
                    m.embeds[0].fields.some(field => field.value && field.value.includes(order.orderid))
                  );
                  
                  if (orderMessage) {
                    // Delete the message
                    await orderMessage.delete();
                    logger.info(`Deleted message for cancelled order ${order.orderid} from publish channel (using content search)`);
                  } else {
                    logger.warn(`Could not find message for cancelled order ${order.orderid} in publish channel`);
                  }
                }
              } catch (searchErr) {
                logger.error(`Failed to search for message in publish channel for order ${orderId}:`, searchErr);
              }
            }
          } catch (err) {
            logger.error(`Failed to delete message for cancelled order ${orderId}:`, err);
          }
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
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const projectMessage = messages.find(m => 
      m.embeds.length > 0 && 
      m.embeds[0].title && 
      m.embeds[0].title.includes(`Projet #${order.orderid}`)
    );
    
    if (projectMessage) {
      await updateChannelEmbed(interaction, order, newStatus);
    }
    
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
          .setTitle(`${emoji} ${title} #${order.orderid}`)
          .setDescription(`La commande a été ${newStatus === 'COMPLETED' ? 'terminée' : 'annulée'}.`)
          .addFields(
            { name: 'Client', value: 'Client confidentiel' },
            { name: 'Rémunération', value: order.compensation },
            { name: 'Codeur', value: order.assignedto ? `<@${order.assignedto}>` : 'Non assigné' },
            { name: 'Admin responsable', value: `<@${order.adminid}>` },
            { name: `${newStatus === 'COMPLETED' ? 'Terminée' : 'Annulée'} par`, value: `<@${userId}>` }
          );
          
        // Ajouter la durée du projet si c'est une complétion
        if (newStatus === 'COMPLETED' && order.assignedat) {
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
    m.embeds[0].title.includes(`Projet #${order.orderid}`)
  );
  
  if (projectMessage) {
    await updateChannelEmbedWithLogo(projectMessage, order, newStatus, appearance.logoUrl);
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