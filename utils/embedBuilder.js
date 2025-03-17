// utils/embedBuilder.js - Utilitaire pour créer des embeds cohérents
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SelectMenuBuilder } = require('discord.js');

/**
 * Crée un embed pour le canal privé
 * @param {Object} order - Données de l'offre
 * @param {String} coderId - ID du codeur
 * @returns {Object} - Objet contenant l'embed et la ligne de composants
 */
function createChannelEmbed(order, coderid) {
  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle(`Projet #${order.orderid}`)
    .setDescription('Ce canal a été créé pour la communication entre l\'administrateur, le codeur et le client.')
    .addFields(
      { name: 'Client', value: order.clientName },
      { name: 'Rémunération', value: order.compensation },
      { name: 'Description', value: order.description },
      { name: 'Codeur', value: `<@${coderid}>` },
      { name: 'Administrateur', value: `<@${order.adminid}>` }
    )
    .setTimestamp();
  
  // Create status selection menu
  const statusMenu = new ActionRowBuilder()
    .addComponents(
      new SelectMenuBuilder()
        .setCustomId(`order_status_${order.orderid}`)
        .setPlaceholder('Mettre à jour le statut')
        .addOptions([
          {
            label: 'En cours',
            description: 'Marquer le travail comme en cours',
            value: 'in_progress',
            emoji: '🔄'
          },
          {
            label: 'Terminé',
            description: 'Marquer le travail comme terminé',
            value: 'completed',
            emoji: '✅'
          },
          {
            label: 'Annulé',
            description: 'Annuler ce travail',
            value: 'cancelled',
            emoji: '❌'
          }
        ])
    );
  
  return { embed, row: statusMenu };
}

module.exports = {
  createChannelEmbed
};