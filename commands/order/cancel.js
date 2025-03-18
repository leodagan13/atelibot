// commands/order/cancel.js - Fixed version with slash command support
const { SlashCommandBuilder } = require('@discordjs/builders');
const { adminRoles } = require('../../config/config');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order_cancel')
    .setDescription('Annuler une offre existante')
    .addStringOption(option =>
      option.setName('orderid')
        .setDescription('ID de l\'offre à annuler')
        .setRequired(true)),
  
  name: 'order_cancel',
  description: 'Cancel an existing job order',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command or prefix command
      const isSlash = interaction.isChatInputCommand?.();
      const userId = isSlash ? interaction.user.id : interaction.author.id;
      
      // Get order ID from args or slash command options
      let orderid;
      
      if (isSlash) {
        await interaction.deferReply();
        orderid = interaction.options.getString('orderid');
      } else {
        // For prefix commands
        if (!args.length) {
          return interaction.reply('Veuillez fournir l\'ID de l\'offre à annuler. Exemple: `$order cancel 1234`');
        }
        orderid = args[0];
      }
      
      // Find the order in database
      const order = await orderDB.findById(orderid);
      
      if (!order) {
        const replyContent = `Aucune offre trouvée avec l'ID ${orderid}.`;
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
      }
      
      // Check if user is the admin who created the order
      if (order.adminid !== userId) {
        const isAdmin = isSlash 
          ? interaction.member.roles.cache.some(role => adminRoles.includes(role.name))
          : interaction.member.roles.cache.some(role => adminRoles.includes(role.name));
        
        if (!isAdmin) {
          const replyContent = 'Vous ne pouvez annuler que les offres que vous avez créées.';
          return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
        }
      }
      
      // If the order is assigned to a coder, update the coder's status
      if (order.assignedto) {
        await coderDB.setActiveOrder(order.assignedto, null);
      }
      
      // Update order status
      await orderDB.updateStatus(orderid, 'CANCELLED');
      
      // Try to update the original message
      try {
        const guild = isSlash ? interaction.guild : interaction.guild;
        const channel = guild.channels.cache.get(order.channelid);
        if (channel) {
          const orderMessage = await channel.messages.fetch(order.messageid);
          if (orderMessage) {
            // Disable the button in the first action row
            const components = orderMessage.components;
            if (components.length > 0 && components[0].components.length > 0) {
              components[0].components[0].data.disabled = true;
              components[0].components[0].data.label = 'Offre annulée';
              components[0].components[0].data.style = 4; // DANGER style
              
              await orderMessage.edit({ components });
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to update message for cancelled order ${orderid}:`, err);
      }
      
      // If there's a private channel, notify and archive it
      if (order.privatechannelid) {
        try {
          const guild = isSlash ? interaction.guild : interaction.guild;
          const privateChannel = guild.channels.cache.get(order.privatechannelid);
          if (privateChannel) {
            await privateChannel.send({
              content: `⚠️ **Cette offre a été annulée par <@${userId}>.**`
            });
            
            // Archive channel if possible
            try {
              await privateChannel.setArchived(true);
            } catch (archiveErr) {
              logger.error(`Failed to archive channel for order ${orderid}:`, archiveErr);
            }
          }
        } catch (channelErr) {
          logger.error(`Failed to notify private channel for order ${orderid}:`, channelErr);
        }
      }
      
      const successMessage = `L'offre #${orderid} a été annulée avec succès.`;
      isSlash ? interaction.editReply(successMessage) : interaction.reply(successMessage);
      logger.info(`Order ${orderid} cancelled by ${userId}`);
      
    } catch (error) {
      logger.error(`Error cancelling order:`, error);
      const errorMessage = 'Une erreur est survenue lors de l\'annulation de l\'offre.';
      
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