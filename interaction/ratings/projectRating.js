// interaction/ratings/projectRating.js - Correction du problème de bouton
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('../../utils/logger');
const { rateProject } = require('../../database/xpSystem');
const { getLogoAttachment } = require('../../utils/modernEmbedBuilder');

/**
 * Envoie un message d'évaluation avec boutons pour noter un projet
 * @param {Object} channel - Canal Discord où envoyer le message
 * @param {Object} projectData - Données du projet
 * @param {Object} developer - Utilisateur développeur
 * @param {Object} admin - Utilisateur administrateur
 * @returns {Promise<Object>} - Message envoyé
 */
async function sendRatingInterface(channel, projectData, developer, admin) {
  try {
    // Créer l'embed pour le vote
    const embed = new EmbedBuilder()
      .setColor('#2F3136') // Couleur gris foncé comme dans le screenshot
      .setTitle(`Project Evaluation #${projectData.orderid}`)
      .setDescription('Please evaluate the quality of the work done on this project.')
      .addFields(
        { name: 'Developer', value: `<@${developer.id}>`, inline: true },
        { name: 'Project Level', value: `${projectData.level ? `Level ${projectData.level}` : 'Not defined'}`, inline: true }
      )
      .setFooter({ 
        text: `Requested by ${admin.tag}`,
        iconURL: admin.displayAvatarURL()
      })
      .setTimestamp();

    // Créer les boutons de vote colorés
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_1`)
          .setLabel('1⭐')
          .setStyle(ButtonStyle.Secondary), // Gris
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_2`)
          .setLabel('2⭐')
          .setStyle(ButtonStyle.Primary), // Bleu
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_3`)
          .setLabel('3⭐')
          .setStyle(ButtonStyle.Primary), // Bleu
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_4`)
          .setLabel('4⭐')
          .setStyle(ButtonStyle.Success), // Vert
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_5`)
          .setLabel('5⭐')
          .setStyle(ButtonStyle.Success) // Vert
      );

    // Bouton d'échec séparé
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_0`)
          .setLabel('Failed ❌')
          .setStyle(ButtonStyle.Danger) // Rouge
      );

    // Configurer les couleurs personnalisées pour une progression visuelle attrayante
    row1.components[0].setStyle(ButtonStyle.Secondary); // Option 1: Gris - Basique
    row1.components[1].setStyle(ButtonStyle.Secondary); // Option 2: Gris - Mieux que basique
    row1.components[2].setStyle(ButtonStyle.Primary);   // Option 3: Bleu - Bon
    row1.components[3].setStyle(ButtonStyle.Primary);   // Option 4: Bleu - Très bon
    row1.components[4].setStyle(ButtonStyle.Success);   // Option 5: Vert - Excellent

    const logoAttachment = getLogoAttachment();

    // Envoyer le message
    return await channel.send({
      embeds: [embed],
      components: [row1, row2]
    });
  } catch (error) {
    logger.error('Erreur lors de l\'envoi de l\'interface de notation:', error);
    throw error;
  }
}

/**
 * Traite un vote de notation
 * @param {Object} interaction - Interaction de bouton
 * @returns {Promise<void>}
 */
async function handleRatingVote(interaction) {
  try {
    await interaction.deferUpdate();
    
    // Analyser l'ID personnalisé
    // Format: rate_PROJECT-ID_DEVELOPER-ID_RATING
    const parts = interaction.customId.split('_');
    const projectId = parts[1];
    const developerId = parts[2];
    const rating = parseInt(parts[3]);
    
    // Vérifier que l'utilisateur est un administrateur
    const { adminRoleIds } = require('../../config/config');
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.roles.cache.some(role => adminRoleIds.includes(role.id));
    
    if (!isAdmin) {
      return interaction.followUp({
        content: 'Seuls les administrateurs peuvent évaluer les projets.',
        ephemeral: true
      });
    }
    
    // Récupérer les informations du projet
    const { orderDB } = require('../../database');
    const project = await orderDB.findById(projectId);
    
    if (!project) {
      return interaction.followUp({
        content: 'Ce projet n\'existe plus.',
        ephemeral: true
      });
    }
    
    logger.debug(`Évaluation du projet ${projectId} (niveau: ${project.level}) avec note ${rating}`);
    
    // Récupérer l'utilisateur développeur
    let developer;
    try {
      developer = await interaction.client.users.fetch(developerId);
    } catch (userError) {
      logger.error(`Erreur lors de la récupération du développeur ${developerId}:`, userError);
      return interaction.followUp({
        content: 'Impossible de récupérer les informations du développeur.',
        ephemeral: true
      });
    }
    
    // Désactiver les boutons une fois le vote effectué
    const originalMessage = interaction.message;
    const disabledRows = [];
    
    for (const row of originalMessage.components) {
      const disabledRow = ActionRowBuilder.from(row);
      
      for (const button of disabledRow.components) {
        button.setDisabled(true);
      }
      
      disabledRows.push(disabledRow);
    }
    
    // Mettre à jour le message original
    const resultEmbed = new EmbedBuilder()
      .setColor(rating === 0 ? '#FF0000' : '#00FF00')
      .setTitle(`Evaluation Completed: ${rating === 0 ? 'Failed ❌' : rating + '⭐'}`)
      .setDescription(`The project #${projectId} has been evaluated by <@${interaction.user.id}>\n` +
                    `Note: ${rating === 0 ? 'Failed ❌' : '⭐'.repeat(rating)}`);
    
    await originalMessage.edit({
      embeds: [resultEmbed],
      components: disabledRows
    });
    
    logger.debug(`Appel de rateProject avec developerId=${developerId}, projectId=${projectId}, adminId=${interaction.user.id}, projectLevel=${project.level || 1}, rating=${rating}`);
    
    // Traiter la note avec le système XP
    const result = await rateProject(
      developerId, 
      projectId, 
      interaction.user.id, 
      project.level || 1, 
      rating
    );
    
    logger.debug(`Résultat de l'évaluation: ${JSON.stringify(result)}`);
    
    // Créer un message de confirmation
    let confirmEmbed;
    
    switch (result.status) {
      case 'BANNED':
        confirmEmbed = new EmbedBuilder()
          .setColor('#000000')
          .setTitle('⛔ Developer Banned')
          .setDescription(`Due to the failure of the project, <@${developerId}> has been banned from the XP system.`)
          .setThumbnail(developer.displayAvatarURL());
        break;
      case 'LEVEL_DOWN':
        confirmEmbed = new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('📉 Level Lost')
          .setDescription(`<@${developerId}> has been demoted to level ${result.newLevel} due to the failure of the project.`)
          .setThumbnail(developer.displayAvatarURL());
        break;
      case 'LEVEL_UP':
        confirmEmbed = new EmbedBuilder()
          .setColor('#3BA55D')
          .setTitle(`🎉 Level ${result.newLevel} Reached!`)
          .setDescription(`<@${developerId}> has been promoted to level ${result.newLevel} thanks to their work on this project!`)
          .addFields(
            { name: 'Note', value: '⭐'.repeat(rating), inline: true },
            { name: 'XP Earned', value: `+${result.xpEarned} XP`, inline: true },
            { name: 'XP Total', value: `${result.totalXP} XP`, inline: true }
          )
          .setThumbnail(developer.displayAvatarURL());
        break;
      default:
        confirmEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`💫 XP Earned: +${result.xpEarned} XP`)
          .setDescription(`<@${developerId}> has earned ${result.xpEarned} XP for their work.`)
          .addFields(
            { name: 'Note', value: '⭐'.repeat(rating), inline: true },
            { name: 'Current Level', value: `Level ${result.newLevel}`, inline: true },
            { name: 'XP Total', value: `${result.totalXP} XP`, inline: true }
          )
          .setThumbnail(developer.displayAvatarURL());
          
        if (result.nextLevelXP) {
          const progressBar = createProgressBar(result.progressPercentage);
          confirmEmbed.addFields(
            { name: `Progression to Level ${result.newLevel + 1}`, value: progressBar }
          );
        }
    }
    
    const logoAttachment = getLogoAttachment();
    
    // Envoyer la confirmation
    await interaction.channel.send({
      embeds: [confirmEmbed]
    });
    
    // Marquer le projet comme complété dans la base de données
    await orderDB.updateStatus(projectId, 'COMPLETED');
    
    // Notification au développeur par message privé
    try {
      let dmEmbed;
      
      switch (result.status) {
        case 'BANNED':
          dmEmbed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('⛔ You have been banned from the system')
            .setDescription(`Due to the failure of the project #${projectId}, you have been banned from the progression system.`)
            .setFooter({ text: 'Contact an administrator for more information.' });
          break;
        case 'LEVEL_DOWN':
          dmEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('📉 You have lost a level')
            .setDescription(`Due to the failure of the project #${projectId}, you have been demoted to level ${result.newLevel}.`)
            .setFooter({ text: 'Keep improving to regain your level!' });
          break;
        case 'LEVEL_UP':
          dmEmbed = new EmbedBuilder()
            .setColor('#3BA55D')
            .setTitle(`🎉 Congratulations! Level ${result.newLevel} reached!`)
            .setDescription(`You have just passed to level ${result.newLevel} thanks to your work on the project #${projectId}!`)
            .addFields(
              { name: 'Note', value: '⭐'.repeat(rating), inline: true },
              { name: 'XP Earned', value: `+${result.xpEarned} XP`, inline: true }
            );
          break;
        default:
          dmEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`💫 +${result.xpEarned} XP earned`)
            .setDescription(`You have earned ${result.xpEarned} XP for your work on the project #${projectId}.`)
            .addFields(
              { name: 'Note', value: '⭐'.repeat(rating), inline: true }
            );
            
          if (result.nextLevelXP) {
            const progressBar = createProgressBar(result.progressPercentage);
            dmEmbed.addFields(
              { name: `Progression to Level ${result.newLevel + 1}`, value: progressBar },
              { name: 'XP total', value: `${result.totalXP} / ${result.nextLevelXP} XP` }
            );
          }
      }
      
      await developer.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      logger.warn(`Impossible d'envoyer un message privé à ${developer.tag}:`, dmError);
    }
    
    // Annoncer les montées de niveau importantes (niveau 4+) dans un canal dédié
    if (result.status === 'LEVEL_UP' && result.newLevel >= 4) {
      try {
        const announcementChannel = interaction.client.channels.cache.get(
          require('../../config/config').ANNOUNCEMENT_CHANNEL_ID || '0'
        );
        
        if (announcementChannel) {
          const announcementEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`🏆 Level ${result.newLevel} reached!`)
            .setThumbnail(developer.displayAvatarURL())
            .setDescription(`Congratulations to <@${developer.id}> who has just reached level ${result.newLevel}!\n\nA true expert in development!`);
          
          await announcementChannel.send({ embeds: [announcementEmbed] });
        }
      } catch (announceError) {
        logger.warn(`Impossible d'annoncer la montée de niveau:`, announceError);
      }
    }
    
  } catch (error) {
    logger.error('Erreur lors du traitement du vote de notation:', error);
    
    try {
      await interaction.followUp({
        content: 'An error occurred while processing your vote.',
        ephemeral: true
      });
    } catch (followupError) {
      logger.error('Erreur lors de l\'envoi du message d\'erreur:', followupError);
    }
  }
}

/**
 * Crée une barre de progression visuelle
 * @param {Number} percentage - Pourcentage (0-100)
 * @returns {String} - Barre de progression formatée
 */
function createProgressBar(percentage) {
  const filledSquares = Math.round(percentage / 10);
  const emptySquares = 10 - filledSquares;
  
  const filledPart = '█'.repeat(filledSquares);
  const emptyPart = '░'.repeat(emptySquares);
  
  return `\`${filledPart}${emptyPart}\` ${percentage}%`;
}

module.exports = {
  sendRatingInterface,
  handleRatingVote
};