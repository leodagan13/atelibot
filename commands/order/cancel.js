// Cancel order command
const { adminRoles } = require('../../config/config');
const { orderDB, coderDB } = require('../../database');
const logger = require('../../utils/logger');

module.exports = {
  name: 'order_cancel',
  description: 'Cancel an existing job order',
  permissions: adminRoles,
  
  async execute(message, args, client) {
    // Check if order ID was provided
    if (!args.length) {
      return message.reply('Veuillez fournir l\'ID de l\'offre à annuler. Exemple: `$order cancel 1234`');
    }
    
    const orderid = args[0];
    
    try {
      // Find the order in database
      const order = await orderDB.findById(orderId);
      
      if (!order) {
        return message.reply(`Aucune offre trouvée avec l'ID ${orderId}.`);
      }
      
      // Check if user is the admin who created the order
      if (order.adminid !== message.author.id) {
        const isAdmin = message.member.roles.cache.some(role => 
          adminRoles.includes(role.name)
        );
        
        if (!isAdmin) {
          return message.reply('Vous ne pouvez annuler que les offres que vous avez créées.');
        }
      }
      
      // If the order is assigned to a coder, update the coder's status
      if (order.assignedTo) {
        await coderDB.update(order.assignedTo, {
          activeOrderid: null
        });
      }
      
      // Update order status
      await orderDB.update(orderid, {
        status: 'CANCELLED'
      });
      
      // Try to update the original message
      try {
        const channel = message.guild.channels.cache.get(order.channelid);
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
      if (order.privateChannelid) {
        try {
          const privateChannel = message.guild.channels.cache.get(order.privateChannelid);
          if (privateChannel) {
            await privateChannel.send({
              content: `⚠️ **Cette offre a été annulée par <@${message.author.id}>.**`
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
      
      message.reply(`L'offre #${orderid} a été annulée avec succès.`);
      logger.info(`Order ${orderid} cancelled by ${message.author.id}`);
      
    } catch (error) {
      logger.error(`Error cancelling order ${orderid}:`, error);
      message.reply('Une erreur est survenue lors de l\'annulation de l\'offre.');
    }
  }
};