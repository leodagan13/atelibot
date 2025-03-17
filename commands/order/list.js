// List orders command
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order_list')
    .setDescription('Liste toutes les offres actives')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filtrer par statut')
        .setRequired(false)
        .addChoices(
          { name: 'Ouvertes', value: 'OPEN' },
          { name: 'Assignées', value: 'ASSIGNED' },
          { name: 'Terminées', value: 'COMPLETED' },
          { name: 'Toutes', value: 'ALL' }
        )),
  
  name: 'order_list',
  description: 'List all active orders',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Default to showing open orders
      let status = 'OPEN';
      
      // Determine if this is a slash command or prefix command
      const isSlash = interaction.isChatInputCommand?.();
      
      if (isSlash) {
        // For slash commands, get the 'status' option
        const requestedStatus = interaction.options.getString('status');
        if (requestedStatus) {
          status = requestedStatus;
        }
        
        // Defer reply for slash commands
        await interaction.deferReply();
      } else {
        // For prefix commands, use arguments
        if (args && args.length > 0) {
          const validStatuses = ['OPEN', 'ASSIGNED', 'COMPLETED', 'ALL'];
          const requestedStatus = args[0].toUpperCase();
          
          if (validStatuses.includes(requestedStatus)) {
            status = requestedStatus;
          }
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
        const replyContent = `Aucune offre avec le statut "${status}" trouvée.`;
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
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
      
      // Respond with embed
      if (isSlash) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      logger.error('Error listing orders:', error);
      const errorMessage = 'Une erreur est survenue lors de la récupération des offres.';
      
      if (interaction.isChatInputCommand?.()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};