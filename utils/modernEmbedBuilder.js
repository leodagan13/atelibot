// utils/modernEmbedBuilder.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const config = require('../config/config');
const path = require('path');

/**
 * Colors for different embed types and statuses
 */
const COLORS = {
  // Status colors
  OPEN: '#38bdf8',      // Blue
  ASSIGNED: '#f59e0b',  // Amber
  IN_PROGRESS: '#f59e0b', // Amber (alias)
  COMPLETED: '#10b981', // Emerald
  SUCCESS: '#10b981',   // Emerald (alias)
  CANCELLED: '#ef4444', // Red
  ERROR: '#ef4444',     // Red (alias)
  
  // General purpose colors
  INFO: '#8b5cf6',      // Violet
  WARNING: '#f97316',   // Orange
  NEUTRAL: '#6b7280',   // Gray
  
  // Get color by status or type
  getColor(status) {
    return this[status] || this.NEUTRAL;
  }
};

/**
 * Status badges with emojis
 */
const STATUS_BADGES = {
  OPEN: '🟢 `Available`',
  ASSIGNED: '🟠 `In Progress`',
  IN_PROGRESS: '🟠 `In Progress`',
  COMPLETED: '✅ `Completed`',
  SUCCESS: '✅ `Success`',
  CANCELLED: '❌ `Cancelled`',
  ERROR: '❌ `Error`',
  
  // Get badge by status
  getBadge(status) {
    return this[status] || status;
  }
};

/**
 * Emoji icons for different field types
 */
const FIELD_ICONS = {
  compensation: '💰', // Using only compensation (not payment)
  description: '📝',
  details: '📋',
  timeframe: '⏱️', // Consolidated time concept
  date: '📅',
  admin: '🛡️',
  developer: '👨‍💻', // Using only developer (not coder)
  status: '🔄',
  orderid: '🔑', // Using only orderid (not id)
  tags: '🏷️',
  skills: '🧠',
  
  // Get icon by field name
  getIcon(field) {
    const key = field.toLowerCase().replace(/[^a-z]/g, '');
    return this[key] || '•';
  }
};

/**
 * Create a modern order card embed with sidebar style
 * @param {Object} order - Order data
 * @returns {Object} - Contains embed and action row
 */
function createSidebarOrderEmbed(order) {
  const embed = new EmbedBuilder()
    .setColor('#ff3366') // Red sidebar accent
    .setTitle(`New Project Opportunity`)
    .setDescription(`Here's a new project that matches your skills. Review the details and click the button below to accept this job.`)
    .setThumbnail('attachment://logo.png') // Reference to local logo file
    .addFields(
      { name: `${FIELD_ICONS.description} Project Description`, value: order.description },
      { name: '\u200B', value: '――――――――――――――――――――' }, // Divider
      { name: `${FIELD_ICONS.compensation} Compensation`, value: order.compensation, inline: true },
      { name: `${FIELD_ICONS.status} Status`, value: STATUS_BADGES.getBadge(order.status || 'OPEN'), inline: true },
      { name: `${FIELD_ICONS.orderid} Project ID`, value: `\`${order.orderid}\``, inline: true }
    )
    .setFooter({ 
      text: `Posted by ${order.adminName || 'Admin'} • ${new Date().toLocaleDateString()}`,
      iconURL: 'attachment://logo.png'
    })
    .setTimestamp();
    
  // Add skills/tags if available
  if (order.tags && order.tags.length > 0) {
    const formattedTags = order.tags.map(tag => `\`${tag}\``).join(' ');
    embed.addFields({ name: `${FIELD_ICONS.skills} Skills Needed`, value: formattedTags });
  }
  
  // Create button row for accepting the order
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_order_${order.orderid}`)
        .setLabel('Accept this Project')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✅')
    );
    
  return { embed, row };
}

/**
 * Create a private project channel embed with sidebar style
 * @param {Object} order - Order data
 * @param {String} developerID - ID of assigned developer
 * @param {String} logoUrl - URL to company logo
 * @returns {Object} - Contains embed and action row
 */
function createPrivateChannelEmbed(order, developerID, logoUrl) {
  const embed = new EmbedBuilder()
    .setColor('#ff3366') // Red sidebar accent
    .setTitle(`Project Channel`)
    .setDescription(`This channel has been created for project collaboration between the administrator and the developer.`)
    .setThumbnail('attachment://logo.png') // Reference to local logo file
    .addFields(
      { name: `${FIELD_ICONS.description} Project Description`, value: order.description },
      { name: '\u200B', value: '――――――――――――――――――――' }, // Divider
      { name: `${FIELD_ICONS.compensation} Compensation`, value: order.compensation, inline: true },
      { name: `${FIELD_ICONS.status} Status`, value: STATUS_BADGES.getBadge('ASSIGNED'), inline: true },
      { name: `${FIELD_ICONS.orderid} Project ID`, value: `\`${order.orderid}\``, inline: true },
      { name: '\u200B', value: '――――――――――――――――――――' }, // Divider
      { name: `${FIELD_ICONS.admin} Administrator`, value: `<@${order.adminid}>`, inline: true },
      { name: `${FIELD_ICONS.developer} Developer`, value: `<@${developerID}>`, inline: true },
      { name: `${FIELD_ICONS.date} Start Date`, value: `<t:${Math.floor(Date.now()/1000)}:D>`, inline: true }
    )
    .setFooter({ 
      text: `Project #${order.orderid}`,
      iconURL: 'attachment://logo.png'
    });
    
  // Add skills/tags if available
  if (order.tags && order.tags.length > 0) {
    const formattedTags = order.tags.map(tag => `\`${tag}\``).join(' ');
    embed.addFields({ name: `${FIELD_ICONS.skills} Required Skills`, value: formattedTags });
  }
  
  // Create button row for project actions
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`request_verification_${order.orderid}`)
        .setLabel('Request Verification')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✓'),
      new ButtonBuilder()
        .setCustomId(`admin_complete_${order.orderid}`)
        .setLabel('Admin Verification')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('👑')
    );
    
  return { embed, row };
}

/**
 * Create an order list embed with sidebar style
 * @param {Array} orders - List of orders
 * @param {String} status - Filter status
 * @param {String} logoUrl - URL to company logo
 * @returns {EmbedBuilder} - Discord.js embed
 */
function createOrderListEmbed(orders, status, logoUrl) {
  const embed = new EmbedBuilder()
    .setColor('#ff3366') // Red sidebar accent
    .setTitle(`Project List - ${status}`)
    .setDescription(`Found ${orders.length} project(s) with status "${status}".`)
    .setThumbnail('attachment://logo.png') // Reference to local logo file
    .setFooter({ 
      text: `Projects as of ${new Date().toLocaleDateString()}`,
      iconURL: 'attachment://logo.png'
    })
    .setTimestamp();
    
  // Add each order to the embed
  orders.forEach(order => {
    const statusEmoji = order.status === 'OPEN' ? '🟢' : 
                        order.status === 'ASSIGNED' ? '🟠' : 
                        order.status === 'COMPLETED' ? '✅' : '❌';
    
    embed.addFields({
      name: `${statusEmoji} Project #${order.orderid}`,
      value: `**${FIELD_ICONS.compensation} Compensation:** ${order.compensation}\n` +
             `**${FIELD_ICONS.admin} Posted by:** <@${order.adminid}>\n` +
             `**${FIELD_ICONS.date} Created:** <t:${Math.floor(new Date(order.createdat).getTime()/1000)}:R>\n` +
             `${order.assignedto ? `**${FIELD_ICONS.developer} Assigned to:** <@${order.assignedto}>` : ''}`
    });
  });
    
  return embed;
}

/**
 * Create an order history embed with sidebar style
 * @param {Array} orders - List of order history
 * @param {String} filter - History filter
 * @param {Object} stats - Global stats
 * @param {String} logoUrl - URL to company logo
 * @returns {EmbedBuilder} - Discord.js embed
 */
function createOrderHistoryEmbed(orders, filter, stats, logoUrl) {
  const embed = new EmbedBuilder()
    .setColor('#ff3366') // Red sidebar accent
    .setTitle(`Project History ${filter !== 'ALL' ? `- ${filter}` : ''}`)
    .setDescription(`Showing the ${orders.length} most recent projects.`)
    .setThumbnail('attachment://logo.png') // Reference to local logo file
    .setFooter({ 
      text: `Total: ${stats.total} | Completed: ${stats.completed} | Cancelled: ${stats.cancelled} | Active: ${stats.active}`,
      iconURL: 'attachment://logo.png'
    })
    .setTimestamp();
    
  // Add each order to the embed
  orders.forEach(order => {
    const completionDate = order.completedat 
      ? `<t:${Math.floor(new Date(order.completedat).getTime()/1000)}:D>` 
      : 'Not specified';
      
    const statusEmoji = order.status === 'COMPLETED' ? '✅' : '❌';
    
    embed.addFields({
      name: `${statusEmoji} Project #${order.orderid}`,
      value: `**${FIELD_ICONS.status} Status:** ${order.status}\n` +
             `**${FIELD_ICONS.compensation} Compensation:** ${order.compensation}\n` +
             `**${FIELD_ICONS.developer} Developer:** ${order.assignedto ? `<@${order.assignedto}>` : 'Not assigned'}\n` +
             `**${FIELD_ICONS.date} Completed:** ${completionDate}`
    });
  });
    
  return embed;
}

/**
 * Create a statistics embed with sidebar style
 * @param {Object} stats - Statistics data
 * @param {String} logoUrl - URL to company logo
 * @returns {EmbedBuilder} - Discord.js embed
 */
function createStatsEmbed(stats, logoUrl) {
  // Calculate percentages
  const completionRate = stats.total > 0 ? 
    Math.round((stats.completed / stats.total) * 100) : 0;
  const cancellationRate = stats.total > 0 ? 
    Math.round((stats.cancelled / stats.total) * 100) : 0;
  
  // Create progress bar for completion rate
  const progressBar = createProgressBar(completionRate);
  
  const embed = new EmbedBuilder()
    .setColor('#ff3366') // Red sidebar accent
    .setTitle('📊 Project Statistics')
    .setThumbnail('attachment://logo.png') // Reference to local logo file
    .addFields(
      { name: '――――――― Overview ―――――――', value: '\u200B' },
      { name: '📈 Total Projects', value: `${stats.total}`, inline: true },
      { name: '🟢 Active Projects', value: `${stats.active}`, inline: true },
      { name: '✅ Completed', value: `${stats.completed}`, inline: true },
      { name: '❌ Cancelled', value: `${stats.cancelled}`, inline: true },
      { name: '🏆 Completion Rate', value: progressBar, inline: false },
      { name: `${FIELD_ICONS.timeframe} Average Completion Time`, value: stats.avgCompletionTime || 'N/A', inline: true }
    )
    .setFooter({ 
      text: `Statistics as of ${new Date().toLocaleDateString()}`,
      iconURL: 'attachment://logo.png'
    })
    .setTimestamp();
  
  // Add top developers if available
  if (stats.topDevelopers && stats.topDevelopers.length > 0) {
    let developersText = '';
    stats.topDevelopers.forEach((dev, index) => {
      developersText += `**${index + 1}.** <@${dev.userid}> • ${dev.completed} projects\n`;
    });
    
    embed.addFields(
      { name: '――――――― Top Developers ―――――――', value: developersText || 'No data available' }
    );
  }
  
  return embed;
}

/**
 * Create a notification embed with sidebar style
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {String} type - Notification type (success, error, info, warning)
 * @param {String} logoUrl - URL to company logo
 * @returns {EmbedBuilder} - Discord.js embed
 */
function createNotification(title, message, type = 'info', logoUrl) {
  const typeUpper = type.toUpperCase();
  const icon = typeUpper === 'SUCCESS' ? '✅' : 
               typeUpper === 'ERROR' ? '❌' : 
               typeUpper === 'WARNING' ? '⚠️' : 'ℹ️';
  
  return new EmbedBuilder()
    .setColor('#ff3366') // Red sidebar accent, can also use COLORS.getColor(typeUpper)
    .setTitle(`${icon} ${title}`)
    .setDescription(message)
    .setThumbnail('attachment://logo.png') // Reference to local logo file
    .setFooter({ 
      text: `Notification • ${new Date().toLocaleDateString()}`,
      iconURL: 'attachment://logo.png'
    })
    .setTimestamp();
}

/**
 * Update channel embed with logo after status change
 * @param {Object} projectMessage - Original message with embed
 * @param {Object} order - Order data
 * @param {String} newStatus - New status
 * @param {String} logoUrl - URL to company logo
 */
async function updateChannelEmbedWithLogo(projectMessage, order, newStatus, logoUrl) {
  const originalEmbed = EmbedBuilder.from(projectMessage.embeds[0]);
  
  // Update color based on status
  originalEmbed.setColor('#ff3366'); // Keep consistent sidebar color
  
  // Keep the logo
  originalEmbed.setThumbnail('attachment://logo.png');
  
  // Update the status field
  const statusField = originalEmbed.data.fields.find(f => f.name.includes('Status'));
  if (statusField) {
    statusField.value = STATUS_BADGES.getBadge(newStatus);
  } else {
    originalEmbed.addFields({ 
      name: `${FIELD_ICONS.status} Status`, 
      value: STATUS_BADGES.getBadge(newStatus) 
    });
  }
  
  // Disable components if the order is completed or cancelled
  let components = [];
  if (newStatus !== 'COMPLETED' && newStatus !== 'CANCELLED' && projectMessage.components.length > 0) {
    components = projectMessage.components;
  }
  
  await projectMessage.edit({
    embeds: [originalEmbed],
    components: components
  });
}

/**
 * Create a visual progress bar
 * @param {Number} percentage - Percentage (0-100)
 * @returns {String} - Formatted progress bar
 */
function createProgressBar(percentage) {
  const filledSquares = Math.round(percentage / 10);
  const emptySquares = 10 - filledSquares;
  
  const filledPart = '█'.repeat(filledSquares);
  const emptyPart = '░'.repeat(emptySquares);
  
  return `\`${filledPart}${emptyPart}\` ${percentage}%`;
}

/**
 * Calculate and format duration between two dates
 * @param {String|Date} startDate - Start date
 * @param {String|Date} endDate - End date
 * @returns {String} - Formatted duration
 */
function calculateDuration(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end - start;
  
  // Convert to days, hours, minutes
  const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Get logo attachment for embeds
 * @returns {AttachmentBuilder} - Discord.js attachment for logo
 */
function getLogoAttachment() {
  const logoPath = path.join(__dirname, '../assets/', config.appearance.logoFilename);
  return new AttachmentBuilder(logoPath, { name: 'logo.png' });
}

module.exports = {
  COLORS,
  STATUS_BADGES,
  FIELD_ICONS,
  createSidebarOrderEmbed,
  createPrivateChannelEmbed,
  createOrderListEmbed,
  createOrderHistoryEmbed,
  createStatsEmbed,
  createNotification,
  updateChannelEmbedWithLogo,
  createProgressBar,
  calculateDuration,
  getLogoAttachment
};