// utils/channelManager.js
const { ChannelType } = require('discord.js');
const logger = require('./logger');

/**
 * Déplace un canal vers la catégorie du mois en cours et retire l'accès au codeur
 * @param {Object} channel - Canal Discord à déplacer
 * @param {Object} guild - Serveur Discord
 * @param {String} coderId - ID du codeur à qui retirer l'accès
 */
async function moveChannelToMonthlyCategory(channel, guild, coderId) {
  try {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentDate = new Date();
    const currentMonth = months[currentDate.getMonth()];
    const currentYear = currentDate.getFullYear();
    const categoryName = `${currentYear} - ${currentMonth}`;
    
    const knownCategoryIds = {
      'March': '1351273681787158640',
      'April': '1351708751803187321'
    };
    
    let category = guild.channels.cache.get(knownCategoryIds[currentMonth]);
    
    if (!category) {
      category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === categoryName
      );
    }
    
    if (!category) {
      category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
        reason: 'Archivage automatique des projets terminés'
      });
    }
    
    // Retirer l'accès au codeur
    if (coderId) {
      await channel.permissionOverwrites.edit(coderId, {
        ViewChannel: false
      });
      logger.info(`Accès retiré au codeur ${coderId} pour le canal ${channel.name}`);
    }
    
    // Déplacer le canal sans modifier les autres permissions
    await channel.setParent(category.id, { lockPermissions: false });
    
    return true;
  } catch (error) {
    logger.error('Erreur lors du déplacement du canal:', error);
    return false;
  }
}

module.exports = { moveChannelToMonthlyCategory };