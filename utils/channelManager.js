// utils/channelManager.js
const { ChannelType } = require('discord.js');
const logger = require('./logger');

/**
 * Moves a channel to the current month's category and removes access from the coder
 * @param {Object} channel - Discord channel to move
 * @param {Object} guild - Discord server
 * @param {String} coderId - ID of the coder to remove access from
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
        reason: 'Automatic archiving of completed projects'
      });
    }
    
    // Remove access from the coder
    if (coderId) {
      await channel.permissionOverwrites.edit(coderId, {
        ViewChannel: false
      });
      logger.info(`Access removed from coder ${coderId} for channel ${channel.name}`);
    }
    
    // Move the channel without modifying other permissions
    await channel.setParent(category.id, { lockPermissions: false });
    
    return true;
  } catch (error) {
    logger.error('Error moving channel:', error);
    return false;
  }
}

module.exports = {
  moveChannelToMonthlyCategory
};