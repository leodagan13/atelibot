// List orders command
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  name: 'order_list',
  description: 'List all active orders',
  permissions: adminRoles,
  
  async execute(message, args, client) {
    try {
      // Default to showing open orders
      let status = 'OPEN';
      
      // If args provided, filter by that status
      if (args.length > 0) {
        const validStatuses = ['OPEN', 'ASSIGNED', 'COMPLETED', 'ALL'];
        const requestedStatus = args[0].toUpperCase();
        
        if (validStatuses.includes(requestedStatus)) {
          status = requestedStatus;
        }
      }
      
      // Query the database
      let orders;
      if (status === 'ALL') {
        orders = await orderDB.findByStatus('ALL');
      } else {
        orders = await orderDB.findByStatus(status);
      }
      
      if (orders.length === 0) {
        return message.reply(`Aucune offre avec le statut "${status}" trouvée.`);
      }
      
      // Create embed for orders list
      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`Liste des offres - ${status}`)
        .setDescription(`${orders.length} offre(s) trouvée(s)`)
        .setTimestamp();
      
      // Add each order to the embed
      orders.forEach(order => {
        let statusEmoji;
        switch (order.status) {
          case 'OPEN': statusEmoji = '🟢'; break;
          case 'ASSIGNED': statusEmoji = '🟠'; break;
          case 'COMPLETED': statusEmoji = '✅'; break;
          case 'CANCELLED': statusEmoji = '❌'; break;
          default: statusEmoji = '⚪'; break;
        }
        
        embed.addFields({
          name: `${statusEmoji} Offre #${order.orderId}`,
          value: `**Client:** ${order.clientName}\n` +
                 `**Rémunération:** ${order.compensation}\n` +
                 `**Posté par:** <@${order.adminId}>\n` +
                 `**Créé le:** ${new Date(order.createdAt).toLocaleDateString()}\n` +
                 `${order.assignedTo ? `**Assigné à:** <@${order.assignedTo}>` : ''}`
        });
      });
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      logger.error('Error listing orders:', error);
      message.reply('Une erreur est survenue lors de la récupération des offres.');
    }
  }
};