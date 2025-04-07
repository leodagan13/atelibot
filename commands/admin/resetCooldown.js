// commands/admin/resetCooldown.js - Command to reset verification cooldown
const { SlashCommandBuilder } = require('@discordjs/builders');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const { createNotification, getLogoAttachment } = require('../../utils/modernEmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_cooldown')
    .setDescription('Reset the verification request cooldown for a project')
    .addStringOption(option =>
      option.setName('orderid')
        .setDescription('Project ID')
        .setRequired(true)),
  
  name: 'reset_cooldown',
  description: 'Reset the verification request cooldown for a project',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command
      const isSlash = interaction.isChatInputCommand?.();
      
      // Get the order ID
      let orderId;
      if (isSlash) {
        await interaction.deferReply({ ephemeral: true });
        orderId = interaction.options.getString('orderid');
      } else {
        if (!args || args.length === 0) {
          return interaction.reply('Please provide the project ID.');
        }
        orderId = args[0];
      }
      
      // Verify that the order exists
      const order = await orderDB.findById(orderId);
      if (!order) {
        const replyContent = `No project found with ID ${orderId}.`;
        return isSlash ? interaction.editReply({ content: replyContent, ephemeral: true }) : interaction.reply(replyContent);
      }
      
      // Verify that the order has an active verification cooldown
      if (!order.lastverificationrequest) {
        const replyContent = `Project #${orderId} does not have an active verification cooldown.`;
        return isSlash ? interaction.editReply({ content: replyContent, ephemeral: true }) : interaction.reply(replyContent);
      }
      
      // Reset the cooldown
      await orderDB.resetVerificationCooldown(orderId);
      
      // Notification
      const embed = createNotification(
          'Cooldown Reset',
          `The verification cooldown for project #${orderId} has been reset.`,
          'SUCCESS'
      );
      
      const logoAttachment = getLogoAttachment();
      
      // Reply with the notification
      if (isSlash) {
        await interaction.editReply({
          content: `The verification cooldown for project #${orderId} has been reset. The developer can now request a new verification.`,
          embeds: [embed],
          files: [logoAttachment],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `The verification cooldown for project #${orderId} has been reset. The developer can now request a new verification.`,
          embeds: [embed],
          files: [logoAttachment]
        });
      }
      
      // If the project has a private channel, send a notification
      if (order.privatechannelid) {
        const channel = client.channels.cache.get(order.privatechannelid);
        if (channel) {
          await channel.send({
            content: `✅ An administrator has reset the verification cooldown for this project. The developer <@${order.assignedto}> can now request a new verification.`,
            ephemeral: false
          });
        }
      }
      
      logger.info(`Verification cooldown reset for order ${orderId} by ${interaction.user.id}`);
      
    } catch (error) {
      logger.error('Error resetting verification cooldown:', error);
      const errorMessage = 'An error occurred while resetting the verification cooldown.';
      
      if (interaction.isChatInputCommand?.()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};