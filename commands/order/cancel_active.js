// commands/order/cancel_active.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const logger = require('../../utils/logger');
const { cleanupOrderSession } = require('../../utils/orderSessionManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cancel_active')
    .setDescription('Cancel your active order creation if one exists'),
  
  async execute(interaction, args, client) {
    const userId = interaction.user.id;
    
    if (!client.activeOrders.has(userId)) {
      return interaction.reply({
        content: 'You don\'t have any active order creations to cancel.',
        ephemeral: true
      });
    }
    
    cleanupOrderSession(client, userId);
    
    return interaction.reply({
      content: 'Your active order creation has been cancelled. You can now use `/add` again.',
      ephemeral: true
    });
  }
};