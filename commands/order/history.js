// commands/order/history.js - Display completed orders history
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const { createOrderHistoryEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order_history')
    .setDescription('Display order history')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Filter by status')
        .setRequired(false)
        .addChoices(
          { name: 'Completed', value: 'COMPLETED' },
          { name: 'Cancelled', value: 'CANCELLED' },
          { name: 'All', value: 'ALL' }
        ))
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Maximum number of orders to display')
        .setRequired(false)),
  
  name: 'order_history',
  description: 'Display completed orders history',
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
        const replyContent = `No orders ${filter !== 'ALL' ? `with status ${filter}` : ''} found in history.`;
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
      }
      
      // Get global stats
      const stats = await orderDB.getOrderStats();
      
      // Create embed for history
      const embed = createOrderHistoryEmbed(orders, filter, stats);
      const logoAttachment = getLogoAttachment();
      
      // Respond with embed
      if (isSlash) {
        await interaction.editReply({ 
          embeds: [embed],
          files: [logoAttachment]
        });
      } else {
        await interaction.reply({ 
          embeds: [embed],
          files: [logoAttachment],
          ephemeral: true
        });
      }
      
    } catch (error) {
      logger.error('Error fetching order history:', error);
      const errorMessage = 'An error occurred while retrieving the order history.';
      
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