// commands/admin/checkDeadlines.js - Command to check approaching deadlines
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const { createNotification, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check_deadlines')
    .setDescription('Check approaching deadlines and notify concerned users'),
  
  name: 'check_deadlines',
  description: 'Check approaching deadlines',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command
      const isSlash = interaction.isChatInputCommand?.();
      
      if (isSlash) {
        await interaction.deferReply();
      } else {
        await interaction.reply('Checking deadlines...');
      }
      
      // Get orders with approaching deadlines
      const approachingDeadlines = await orderDB.getApproachingDeadlines();
      
      if (approachingDeadlines.length === 0) {
        const replyContent = 'No approaching deadlines found.';
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
      }
      
      // Create an embed to display approaching deadlines
      const embed = new EmbedBuilder()
        .setColor('#FF9900') // Orange for urgency
        .setTitle('⏰ Approaching Deadlines')
        .setDescription(`${approachingDeadlines.length} project(s) have deadlines in the next 48 hours.`)
        .setThumbnail('attachment://logo.png')
        .setTimestamp();
      
      let notificationsSent = 0;
      
      // Add each deadline to the embed and send notifications
      for (const order of approachingDeadlines) {
        const deadlineDate = new Date(order.deadline);
        const discordTimestamp = Math.floor(deadlineDate.getTime() / 1000);
        
        embed.addFields({
          name: `Project #${order.orderid}`,
          value: `**Deadline:** <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>)\n` +
                 `**Developer:** ${order.assignedto ? `<@${order.assignedto}>` : 'Not assigned'}\n` +
                 `**Administrator:** <@${order.adminid}>\n` +
                 `**Compensation:** ${order.compensation}`
        });
        
        // Find the project's private channel
        const privateChannel = client.channels.cache.find(
          c => c.name === `projet-${order.orderid}` || c.name === `project-${order.orderid}`
        );
        
        if (privateChannel && order.assignedto) {
          // Send a notification in the private channel
          await privateChannel.send({
            content: `⚠️ **IMPORTANT REMINDER:** <@${order.assignedto}> <@${order.adminid}> The deadline for this project is <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>). Please check the work progress.`
          });
          
          notificationsSent++;
        }
      }
      
      const logoAttachment = getLogoAttachment();
      
      // Reply with embed
      if (isSlash) {
        await interaction.editReply({ 
          content: `${notificationsSent} notification(s) sent in project channels.`,
          embeds: [embed],
          files: [logoAttachment]
        });
      } else {
        await interaction.reply({ 
          content: `${notificationsSent} notification(s) sent in project channels.`,
          embeds: [embed],
          files: [logoAttachment]
        });
      }
      
      logger.info(`${notificationsSent} deadline notifications sent for ${approachingDeadlines.length} projects`);
      
    } catch (error) {
      logger.error('Error checking deadlines:', error);
      const errorMessage = 'An error occurred while checking deadlines.';
      
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