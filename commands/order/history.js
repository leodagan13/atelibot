// commands/order/history.js - Affiche l'historique des commandes terminées
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  name: 'history',
  description: 'Affiche l\'historique des commandes terminées',
  permissions: adminRoles,
  
  async execute(message, args, client) {
    try {
      // Récupérer le nombre de commandes à afficher (par défaut 5)
      let limit = 5;
      if (args.length > 0 && !isNaN(args[0])) {
        limit = Math.min(Math.max(parseInt(args[0]), 1), 10); // Entre 1 et 10
      }
      
      // Récupérer le filtre des commandes (par défaut 'ALL')
      let filter = 'ALL';
      if (args.length > 1) {
        const validFilters = ['COMPLETED', 'CANCELLED', 'ALL'];
        const requestedFilter = args[1].toUpperCase();
        if (validFilters.includes(requestedFilter)) {
          filter = requestedFilter;
        }
      }
      
      // Récupérer l'historique des commandes
      const orders = await orderDB.getOrderHistory(limit, 0, filter);
      
      if (orders.length === 0) {
        return message.reply(`Aucune commande avec le statut "${filter}" trouvée dans l'historique.`);
      }
      
      // Récupérer les statistiques globales
      const stats = await orderDB.getOrderStats();
      
      // Créer un embed pour l'historique
      const embed = new EmbedBuilder()
        .setColor('#8884ff')
        .setTitle(`Historique des commandes ${filter !== 'ALL' ? `- ${filter}` : ''}`)
        .setDescription(`Affichage des ${orders.length} dernières commandes terminées.`)
        .setFooter({ text: `Total: ${stats.total} | Terminées: ${stats.completed} | Annulées: ${stats.cancelled} | Actives: ${stats.active}` })
        .setTimestamp();
      
      // Ajouter chaque commande à l'embed
      orders.forEach(order => {
        const completionDate = order.completedAt 
          ? new Date(order.completedAt).toLocaleDateString() 
          : 'Non spécifiée';
          
        let statusEmoji;
        switch (order.status) {
          case 'COMPLETED': statusEmoji = '✅'; break;
          case 'CANCELLED': statusEmoji = '❌'; break;
          default: statusEmoji = '⚪'; break;
        }
        
        embed.addFields({
          name: `${statusEmoji} Commande #${order.orderId} - ${order.clientName}`,
          value: `**Statut:** ${order.status}\n` +
                 `**Rémunération:** ${order.compensation}\n` +
                 `**Codeur:** ${order.assignedTo ? `<@${order.assignedTo}>` : 'Non assigné'}\n` +
                 `**Terminée le:** ${completionDate}`
        });
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      logger.error('Error fetching order history:', error);
      message.reply('Une erreur est survenue lors de la récupération de l\'historique des commandes.');
    }
  }
};