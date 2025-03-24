// commands/admin/resetCooldown.js - Command to reset verification cooldown
const { SlashCommandBuilder } = require('@discordjs/builders');
const { orderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const { createNotification, getLogoAttachment } = require('../../utils/modernEmbedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset_cooldown')
    .setDescription('Réinitialise le délai de demande de vérification pour un projet')
    .addStringOption(option =>
      option.setName('orderid')
        .setDescription('ID du projet')
        .setRequired(true)),
  
  name: 'reset_cooldown',
  description: 'Réinitialise le délai de demande de vérification pour un projet',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Déterminer si c'est une interaction slash command
      const isSlash = interaction.isChatInputCommand?.();
      
      // Obtenir l'ID de l'offre
      let orderId;
      if (isSlash) {
        await interaction.deferReply({ ephemeral: true });
        orderId = interaction.options.getString('orderid');
      } else {
        if (!args || args.length === 0) {
          return interaction.reply('Veuillez fournir l\'ID du projet.');
        }
        orderId = args[0];
      }
      
      // Vérifier que l'offre existe
      const order = await orderDB.findById(orderId);
      if (!order) {
        const replyContent = `Aucun projet trouvé avec l'ID ${orderId}.`;
        return isSlash ? interaction.editReply({ content: replyContent, ephemeral: true }) : interaction.reply(replyContent);
      }
      
      // Vérifier que l'offre a bien un délai de vérification actif
      if (!order.lastverificationrequest) {
        const replyContent = `Le projet #${orderId} n'a pas de délai de vérification actif.`;
        return isSlash ? interaction.editReply({ content: replyContent, ephemeral: true }) : interaction.reply(replyContent);
      }
      
      // Réinitialiser le délai
      await orderDB.resetVerificationCooldown(orderId);
      
      // Notification
      const embed = createNotification(
          'Cooldown Reset',
          `The verification cooldown for project #${orderId} has been reset.`,
          'SUCCESS'
      );
      
      const logoAttachment = getLogoAttachment();
      
      // Répondre avec la notification
      if (isSlash) {
        await interaction.editReply({
          content: `Le délai de vérification pour le projet #${orderId} a été réinitialisé. Le développeur peut maintenant demander une nouvelle vérification.`,
          embeds: [embed],
          files: [logoAttachment],
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `Le délai de vérification pour le projet #${orderId} a été réinitialisé. Le développeur peut maintenant demander une nouvelle vérification.`,
          embeds: [embed],
          files: [logoAttachment]
        });
      }
      
      // Si le projet a un canal privé, envoyer une notification
      if (order.privatechannelid) {
        const channel = client.channels.cache.get(order.privatechannelid);
        if (channel) {
          await channel.send({
            content: `✅ Un administrateur a réinitialisé le délai de vérification pour ce projet. Le développeur <@${order.assignedto}> peut maintenant demander une nouvelle vérification.`,
            ephemeral: false
          });
        }
      }
      
      logger.info(`Verification cooldown reset for order ${orderId} by ${interaction.user.id}`);
      
    } catch (error) {
      logger.error('Error resetting verification cooldown:', error);
      const errorMessage = 'Une erreur est survenue lors de la réinitialisation du délai de vérification.';
      
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