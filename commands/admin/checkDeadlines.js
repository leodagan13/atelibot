// commands/admin/checkDeadlines.js - Commande pour vérifier les deadlines approchantes
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
    .setDescription('Vérifie les deadlines approchantes et notifie les utilisateurs concernés'),
  
  name: 'check_deadlines',
  description: 'Vérifie les deadlines approchantes',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Déterminer si c'est une interaction slash command
      const isSlash = interaction.isChatInputCommand?.();
      
      if (isSlash) {
        await interaction.deferReply();
      } else {
        await interaction.reply('Vérification des deadlines en cours...');
      }
      
      // Récupérer les offres avec deadlines approchantes
      const approachingDeadlines = await orderDB.getApproachingDeadlines();
      
      if (approachingDeadlines.length === 0) {
        const replyContent = 'Aucune deadline approchante trouvée.';
        return isSlash ? interaction.editReply(replyContent) : interaction.reply(replyContent);
      }
      
      // Créer un embed pour afficher les deadlines approchantes
      const embed = new EmbedBuilder()
        .setColor('#FF9900') // Orange pour l'urgence
        .setTitle('⏰ Deadlines Approchantes')
        .setDescription(`${approachingDeadlines.length} projet(s) ont des deadlines dans les prochaines 48 heures.`)
        .setThumbnail('attachment://logo.png')
        .setTimestamp();
      
      let notificationsSent = 0;
      
      // Ajouter chaque deadline à l'embed et envoyer des notifications
      for (const order of approachingDeadlines) {
        const deadlineDate = new Date(order.deadline);
        const discordTimestamp = Math.floor(deadlineDate.getTime() / 1000);
        
        embed.addFields({
          name: `Projet #${order.orderid}`,
          value: `**Deadline:** <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>)\n` +
                 `**Développeur:** ${order.assignedto ? `<@${order.assignedto}>` : 'Non assigné'}\n` +
                 `**Administrateur:** <@${order.adminid}>\n` +
                 `**Compensation:** ${order.compensation}`
        });
        
        // Trouver le canal privé du projet
        const privateChannel = client.channels.cache.find(
          c => c.name === `projet-${order.orderid}` || c.name === `project-${order.orderid}`
        );
        
        if (privateChannel && order.assignedto) {
          // Envoyer une notification dans le canal privé
          await privateChannel.send({
            content: `⚠️ **RAPPEL IMPORTANT:** <@${order.assignedto}> <@${order.adminid}> La deadline de ce projet est <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>). Veuillez vérifier l'avancement du travail.`
          });
          
          notificationsSent++;
        }
      }
      
      const logoAttachment = getLogoAttachment();
      
      // Répondre avec l'embed
      if (isSlash) {
        await interaction.editReply({ 
          content: `${notificationsSent} notification(s) envoyée(s) dans les canaux de projet.`,
          embeds: [embed],
          files: [logoAttachment]
        });
      } else {
        await interaction.reply({ 
          content: `${notificationsSent} notification(s) envoyée(s) dans les canaux de projet.`,
          embeds: [embed],
          files: [logoAttachment]
        });
      }
      
      logger.info(`${notificationsSent} notifications de deadline envoyées pour ${approachingDeadlines.length} projets`);
      
    } catch (error) {
      logger.error('Error checking deadlines:', error);
      const errorMessage = 'Une erreur est survenue lors de la vérification des deadlines.';
      
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