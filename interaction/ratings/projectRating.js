// interaction/ratings/projectRating.js - Version corrigée
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
      .setTitle(`Évaluation du Projet #${projectData.orderid}`)
      .setDescription(`Évaluez le travail de <@${developer.id}> sur ce projet.\nChaque niveau d'étoile accorde un montant différent d'XP.`)
      .addFields(
        { name: 'Projet', value: `#${projectData.orderid}`, inline: true },
        { name: 'Développeur', value: `<@${developer.id}>`, inline: true },
        { name: 'Niveau du projet', value: `${projectData.level ? `Niveau ${projectData.level}` : 'Non défini'}`, inline: true }
      )
      .setFooter({ 
        text: `Demandé par ${admin.tag}`,
        iconURL: admin.displayAvatarURL()
      })
      .setTimestamp();

    // Créer les boutons de vote colorés
    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_1`)
          .setLabel('1⭐')
          .setStyle(ButtonStyle.Success), // Vert
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_2`)
          .setLabel('2⭐')
          .setStyle(ButtonStyle.Primary), // Bleu
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_3`)
          .setLabel('3⭐')
          .setStyle(ButtonStyle.Danger), // Rouge
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_4`)
          .setLabel('4⭐')
          .setStyle(ButtonStyle.Secondary), // Gris
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_5`)
          .setLabel('5⭐')
          .setStyle(ButtonStyle.Primary) // Bleu
      );

    // Bouton d'échec séparé
    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`rate_${projectData.orderid}_${developer.id}_0`)
          .setLabel('Failed ❌')
          .setStyle(ButtonStyle.Danger) // Rouge
      );

    // Configurer les couleurs personnalisées avec des options hexadécimales
    row1.components[0].setStyle(ButtonStyle.Success); // Option 1: Vert (#3BA55D)
    row1.components[1].setStyle(ButtonStyle.Primary); // Option 2: Bleu (#5865F2)
    row1.components[2].setStyle(ButtonStyle.Danger);  // Option 3: Rouge (#ED4245)
    row1.components[3].setStyle(ButtonStyle.Secondary); // Option 4: Gris (#4F545C)
    row1.components[4].data.style = 5; // Option 5: Bleu violet (#5865F2)

    const logoAttachment = getLogoAttachment();

    // Envoyer le message
    return await channel.send({
      embeds: [embed],
      components: [row1, row2],
      files: [logoAttachment]
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
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.roles.cache.some(role => 
      ['Administrator', 'Admin', 'Administrateur', 'Modérateur', 'Moderator'].includes(role.name)
    );
    
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
    const votedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
      .setColor(rating === 0 ? '#ED4245' : '#5865F2')
      .setTitle(`Évaluation Terminée: ${rating === 0 ? 'Échec ❌' : rating + '⭐'}`)
      .setDescription(`Le projet #${projectId} a été évalué par <@${interaction.user.id}>\n` +
                    `Note: ${rating === 0 ? 'Échec ❌' : '⭐'.repeat(rating)}`);
    
    await originalMessage.edit({
      embeds: [votedEmbed],
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
          .setTitle('⛔ Développeur Banni')
          .setDescription(`Suite à l'échec du projet, <@${developerId}> a été banni du système d'XP.`)
          .setThumbnail(developer.displayAvatarURL());
        break;
      case 'LEVEL_DOWN':
        confirmEmbed = new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('📉 Niveau Perdu')
          .setDescription(`<@${developerId}> est redescendu au niveau ${result.newLevel} suite à l'échec du projet.`)
          .setThumbnail(developer.displayAvatarURL());
        break;
      case 'LEVEL_UP':
        confirmEmbed = new EmbedBuilder()
          .setColor('#3BA55D')
          .setTitle(`🎉 Niveau ${result.newLevel} Atteint!`)
          .setDescription(`<@${developerId}> est passé au niveau ${result.newLevel} grâce à son travail sur ce projet!`)
          .addFields(
            { name: 'Note', value: '⭐'.repeat(rating), inline: true },
            { name: 'XP Gagné', value: `+${result.xpEarned} XP`, inline: true },
            { name: 'XP Total', value: `${result.totalXP} XP`, inline: true }
          )
          .setThumbnail(developer.displayAvatarURL());
        break;
      default:
        confirmEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`💫 XP Gagné: +${result.xpEarned} XP`)
          .setDescription(`<@${developerId}> a reçu ${result.xpEarned} XP pour son travail.`)
          .addFields(
            { name: 'Note', value: '⭐'.repeat(rating), inline: true },
            { name: 'Niveau actuel', value: `Niveau ${result.newLevel}`, inline: true },
            { name: 'XP Total', value: `${result.totalXP} XP`, inline: true }
          )
          .setThumbnail(developer.displayAvatarURL());
          
        if (result.nextLevelXP) {
          const progressBar = createProgressBar(result.progressPercentage);
          confirmEmbed.addFields(
            { name: `Progression vers Niveau ${result.newLevel + 1}`, value: progressBar }
          );
        }
    }
    
    const logoAttachment = getLogoAttachment();
    
    // Envoyer la confirmation
    await interaction.channel.send({
      embeds: [confirmEmbed],
      files: [logoAttachment]
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
            .setTitle('⛔ Vous avez été banni du système')
            .setDescription(`Suite à l'échec du projet #${projectId}, vous avez été banni du système de progression.`)
            .setFooter({ text: 'Contactez un administrateur pour plus d\'informations.' });
          break;
        case 'LEVEL_DOWN':
          dmEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('📉 Vous avez perdu un niveau')
            .setDescription(`Suite à l'échec du projet #${projectId}, vous êtes redescendu au niveau ${result.newLevel}.`)
            .setFooter({ text: 'Continuez à vous améliorer pour regagner votre niveau!' });
          break;
        case 'LEVEL_UP':
          dmEmbed = new EmbedBuilder()
            .setColor('#3BA55D')
            .setTitle(`🎉 Félicitations! Niveau ${result.newLevel} atteint!`)
            .setDescription(`Vous venez de passer au niveau ${result.newLevel} grâce à votre travail sur le projet #${projectId}!`)
            .addFields(
              { name: 'Note', value: '⭐'.repeat(rating), inline: true },
              { name: 'XP Gagné', value: `+${result.xpEarned} XP`, inline: true }
            );
          break;
        default:
          dmEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`💫 +${result.xpEarned} XP gagné`)
            .setDescription(`Vous avez reçu ${result.xpEarned} XP pour votre travail sur le projet #${projectId}.`)
            .addFields(
              { name: 'Note', value: '⭐'.repeat(rating), inline: true }
            );
            
          if (result.nextLevelXP) {
            const progressBar = createProgressBar(result.progressPercentage);
            dmEmbed.addFields(
              { name: `Progression vers Niveau ${result.newLevel + 1}`, value: progressBar },
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
            .setTitle(`🏆 Niveau ${result.newLevel} atteint!`)
            .setThumbnail(developer.displayAvatarURL())
            .setDescription(`Félicitations à <@${developer.id}> qui vient d'atteindre le niveau ${result.newLevel}!\n\nUn véritable expert en développement!`);
          
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
        content: 'Une erreur est survenue lors du traitement de votre vote.',
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