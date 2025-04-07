// interaction/buttons/requestVerification.js - Updated with 24h cooldown
const { orderDB } = require('../../database');
const logger = require('../../utils/logger');
const { createNotification, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

/**
 * Handles verification request for a project by a developer
 * @param {Object} interaction - Discord interaction (button)
 * @param {String} orderId - Order identifier
 */
async function handleVerificationRequest(interaction, orderId) {
  try {
    const userId = interaction.user.id;
    
    // Retrieve order information from Supabase
    const order = await orderDB.findById(orderId);
    if (!order) {
      return interaction.reply({
        content: 'This order no longer exists.',
        ephemeral: true
      });
    }
    
    // Check if user is the coder assigned to the project
    if (order.assignedto !== userId) {
      return interaction.reply({
        content: 'You are not authorized to request verification for this project.',
        ephemeral: true
      });
    }
    
    // Check that the order is in ASSIGNED status
    if (order.status !== 'ASSIGNED') {
      return interaction.reply({
        content: `This project cannot be verified because it has status ${order.status}.`,
        ephemeral: true
      });
    }
    
    // Check if a verification request has been made in the last 24 hours
    if (order.lastverificationrequest) {
      const lastRequest = new Date(order.lastverificationrequest);
      const now = new Date();
      const hoursSinceLastRequest = (now - lastRequest) / (1000 * 60 * 60);
      
      if (hoursSinceLastRequest < 24) {
        const timeRemaining = Math.ceil(24 - hoursSinceLastRequest);
        const timeFormat = timeRemaining === 1 ? 'hour' : 'hours';
        
        return interaction.reply({
          content: `You have already requested verification recently. Please wait ${timeRemaining} ${timeFormat} before making a new request.`,
          ephemeral: true
        });
      }
    }
    
    // Update the timestamp of the last verification request
    await orderDB.updateLastVerificationRequest(orderId);
    
    // Mention the administrator role to request verification
    await interaction.channel.send({
      content: `<@&1350494624342347878> The developer <@${userId}> has completed their work on project #${orderId} and requests verification to close the project.`
    });
    
    // Reply to the interaction
    const embed = createNotification(
        'Verification Requested',
        `A verification has been requested for project #${order.orderid}.`,
        'INFO'
    );
    
    const logoAttachment = getLogoAttachment();
    
    await interaction.reply({
      embeds: [embed],
      files: [logoAttachment],
      ephemeral: true
    });
    
    logger.info(`Verification requested for order ${orderId} by ${userId}`);
    
  } catch (error) {
    logger.error('Error handling verification request:', error);
    await interaction.reply({
      content: 'An error occurred while requesting verification.',
      ephemeral: true
    });
  }
}

module.exports = {
  handleVerificationRequest
}; 