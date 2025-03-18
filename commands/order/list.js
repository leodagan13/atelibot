// List orders command
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const { createOrderListEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

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
      const embed = createOrderListEmbed(orders, status);
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