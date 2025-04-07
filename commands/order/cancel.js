// commands/order/cancel.js - Updated to support level-based channels
const { SlashCommandBuilder } = require('@discordjs/builders');
const { adminRoles, LEVEL_CHANNELS } = require('../../config/config');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');
const { createNotification, updateChannelEmbedWithLogo, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order_cancel')
    .setDescription('Cancel an existing order')
    .addStringOption(option =>
      option.setName('orderid')
        .setDescription('ID of the order to cancel')
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
          return interaction.reply('Please provide the order ID to cancel. Example: `$order cancel 1234`');
        }
        orderid = args[0];
      }
      
      // Find the order in database
      const order = await orderDB.findById(orderid);
      
      if (!order) {
        const replyContent = `No order found with ID ${orderid}.`;
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
      }
      
      // Check if user is the admin who created the order
      if (order.adminid !== userId) {
        const isAdmin = isSlash 
          ? interaction.member.roles.cache.some(role => adminRoles.includes(role.name))
          : interaction.member.roles.cache.some(role => adminRoles.includes(role.name));
        
        if (!isAdmin) {
          const replyContent = 'You can only cancel orders that you have created.';
          return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
        }
      }
      
      // If the order is assigned to a coder, update the coder's status
      if (order.assignedto) {
        await coderDB.setActiveOrder(order.assignedto, null);
      }
      
      // Update order status
      await orderDB.updateStatus(orderid, 'CANCELLED');
      
      // Delete the message in the appropriate publication channel
      const newStatus = 'CANCELLED';
      if (newStatus === 'CANCELLED') {
        try {
          // Determine which channel the order was published to
          const level = order.level || 1;
          const publishChannelId = LEVEL_CHANNELS[level] || LEVEL_CHANNELS[1];
          
          const publishChannel = isSlash ? 
            interaction.guild.channels.cache.get(publishChannelId) : 
            interaction.guild.channels.cache.get(publishChannelId);
          
          if (publishChannel && order.messageid) {
            try {
              const orderMessage = await publishChannel.messages.fetch(order.messageid);
              if (orderMessage) {
                await orderMessage.delete();
                logger.info(`Deleted message ${order.messageid} for cancelled order ${orderid} from level ${level} channel`);
              }
            } catch (fetchError) {
              logger.error(`Failed to fetch message ${order.messageid} for order ${orderid}:`, fetchError);
            }
          } else {
            // Alternative method - search for the message by content in all level channels
            try {
              // Look in all possible level channels
              for (const [levelKey, channelId] of Object.entries(LEVEL_CHANNELS)) {
                const channel = client.channels.cache.get(channelId);
                if (!channel) continue;
                
                // Fetch recent messages in the channel
                const messages = await channel.messages.fetch({ limit: 50 });
                
                // Find the message that contains the order ID
                const orderMessage = messages.find(m => 
                  m.embeds.length > 0 && 
                  m.embeds[0].fields && 
                  m.embeds[0].fields.some(field => field.value && field.value.includes(orderid))
                );
                
                if (orderMessage) {
                  // Delete the message
                  await orderMessage.delete();
                  logger.info(`Deleted message for cancelled order ${orderid} from level ${levelKey} channel (using content search)`);
                  break; // Exit the loop after finding and deleting the message
                }
              }
            } catch (searchErr) {
              logger.error(`Failed to search for message in publish channels for order ${orderid}:`, searchErr);
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
              content: `⚠️ **This order has been cancelled by <@${userId}>.**`
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
          'ERROR'
      );
      
      const logoAttachment = getLogoAttachment();
      
      const successMessage = `Order #${orderid} has been successfully cancelled.`;
      isSlash ? 
        interaction.editReply({ 
          content: successMessage, 
          embeds: [embed], 
          files: [logoAttachment] 
        }) : 
        interaction.reply({ 
          content: successMessage, 
          embeds: [embed], 
          files: [logoAttachment] 
        });
      logger.info(`Order ${orderid} cancelled by ${userId}`);
      
    } catch (error) {
      logger.error(`Error cancelling order:`, error);
      const errorMessage = 'An error occurred while cancelling the order.';
      
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