// commands/order/history.js - Display completed orders history
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const { createOrderHistoryEmbed } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order_history')
    .setDescription('Affiche l\'historique des commandes')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filtrer par statut')
        .setRequired(false)
        .addChoices(
          { name: 'Terminées', value: 'COMPLETED' },
          { name: 'Annulées', value: 'CANCELLED' },
          { name: 'Toutes', value: 'ALL' }
        ))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Nombre maximum de commandes à afficher')
        .setRequired(false)),
  
  name: 'order_history',
  description: 'Affiche l\'historique des commandes terminées',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command or prefix command
      const isSlash = interaction.isChatInputCommand?.();
      
      // Default values
      let filter = 'ALL';
      let limit = 10;
      
      if (isSlash) {
        // For slash commands
        await interaction.deferReply();
        
        const requestedStatus = interaction.options.getString('status');
        if (requestedStatus) {
          filter = requestedStatus;
        }
        
        const requestedLimit = interaction.options.getInteger('limit');
        if (requestedLimit && requestedLimit > 0) {
          limit = Math.min(requestedLimit, 25); // Limit to 25 max
        }
      } else {
        // For prefix commands
        if (args && args.length > 0) {
          const validFilters = ['COMPLETED', 'CANCELLED', 'ALL'];
          const requestedFilter = args[0].toUpperCase();
          
          if (validFilters.includes(requestedFilter)) {
            filter = requestedFilter;
          }
          
          if (args.length > 1) {
            const requestedLimit = parseInt(args[1]);
            if (!isNaN(requestedLimit) && requestedLimit > 0) {
              limit = Math.min(requestedLimit, 25); // Limit to 25 max
            }
          }
        }
      }
      
      // Get order history
      const orders = await orderDB.getOrderHistory(limit, 0, filter);
      
      if (orders.length === 0) {
        const replyContent = `Aucune commande ${filter !== 'ALL' ? `au statut ${filter}` : ''} trouvée dans l'historique.`;
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
      }
      
      // Get global stats
      const stats = await orderDB.getOrderStats();
      
      // Create embed for history
      const embed = createOrderHistoryEmbed(orders, filter, stats, appearance.logoUrl);
      
      // Respond with embed
      if (isSlash) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
      
    } catch (error) {
      logger.error('Error fetching order history:', error);
      const errorMessage = 'Une erreur est survenue lors de la récupération de l\'historique des commandes.';
      
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