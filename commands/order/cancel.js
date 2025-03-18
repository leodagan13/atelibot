// commands/order/cancel.js - Fixed version with slash command support
const { SlashCommandBuilder } = require('@discordjs/builders');
const { adminRoles } = require('../../config/config');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');
const { createNotification, updateChannelEmbedWithLogo } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

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
      
      // Supprimer le message dans le canal de publication
      const newStatus = 'CANCELLED';
      if (newStatus === 'CANCELLED') {
        try {
          const publishChannelId = require('../../config/config').PUBLISH_ORDERS_CHANNEL_ID;
          const publishChannel = isSlash ? interaction.guild.channels.cache.get(publishChannelId) : interaction.guild.channels.cache.get(publishChannelId);
          
          if (publishChannel && order.messageid) {
            try {
              const orderMessage = await publishChannel.messages.fetch(order.messageid);
              if (orderMessage) {
                await orderMessage.delete();
                logger.info(`Deleted message ${order.messageid} for cancelled order ${orderid}`);
              }
            } catch (fetchError) {
              logger.error(`Failed to fetch message ${order.messageid} for order ${orderid}:`, fetchError);
            }
          } else {
            // Méthode alternative - rechercher le message par contenu
            try {
              const publishChannel = client.channels.cache.get(publishChannelId);
              if (publishChannel) {
                // Fetch recent messages in the publish channel
                const messages = await publishChannel.messages.fetch({ limit: 50 });
                
                // Find the message that contains the order ID
                const orderMessage = messages.find(m => 
                  m.embeds.length > 0 && 
                  m.embeds[0].fields && 
                  m.embeds[0].fields.some(field => field.value && field.value.includes(orderid))
                );
                
                if (orderMessage) {
                  // Delete the message
                  await orderMessage.delete();
                  logger.info(`Deleted message for cancelled order ${orderid} from publish channel (using content search)`);
                } else {
                  logger.warn(`Could not find message for cancelled order ${orderid} in publish channel`);
                }
              }
            } catch (searchErr) {
              logger.error(`Failed to search for message in publish channel for order ${orderid}:`, searchErr);
            }
          }
        } catch (err) {
          logger.error(`Failed to delete message for cancelled order ${orderid}:`, err);
        }
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
      
      const embed = createNotification(
          'Project Cancelled',
          `The project #${order.orderid} has been cancelled.`,
          'ERROR',
          appearance.logoUrl
      );
      
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