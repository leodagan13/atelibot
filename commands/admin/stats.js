// commands/admin/stats.js - Command to display order statistics
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { orderDB, coderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const supabase = require('../../database/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Affiche les statistiques des commandes et des codeurs')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type de statistiques à afficher')
        .setRequired(false)
        .addChoices(
          { name: 'Général', value: 'general' },
          { name: 'Commandes', value: 'orders' },
          { name: 'Codeurs', value: 'coders' }
        )),

  name: 'stats',
  description: 'Affiche les statistiques des commandes et des codeurs',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command or prefix command
      const isSlash = interaction.isChatInputCommand?.();
      
      // Default to showing general stats
      let statsType = 'general';
      
      if (isSlash) {
        // For slash commands
        await interaction.deferReply();
        
        const requestedType = interaction.options.getString('type');
        if (requestedType) {
          statsType = requestedType;
        }
      } else {
        // For prefix commands
        if (args && args.length > 0) {
          const validTypes = ['general', 'orders', 'coders'];
          const requestedType = args[0].toLowerCase();
          
          if (validTypes.includes(requestedType)) {
            statsType = requestedType;
          }
        }
      }
      
      // Get and display requested stats
      let embed;
      
      switch (statsType) {
        case 'general':
          embed = await generateGeneralStats();
          break;
          
        case 'orders':
          embed = await generateOrderStats();
          break;
          
        case 'coders':
          embed = await generateCoderStats();
          break;
      }
      
      // Reply with embed
      if (isSlash) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
      
    } catch (error) {
      logger.error('Error displaying statistics:', error);
      const errorMessage = 'Une erreur est survenue lors de l\'affichage des statistiques.';
      
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

/**
 * Generate general statistics
 * @returns {EmbedBuilder} - Embed with general stats
 */
async function generateGeneralStats() {
  // Get statistics
  const stats = await orderDB.getOrderStats();
  
  // Calculate average completion times
  const avgTimes = await calculateAverageCompletionTimes();
  
  // Calculate completion and cancellation rates
  const completionRate = stats.total > 0 ? 
    Math.round((stats.completed / stats.total) * 100) : 0;
  const cancellationRate = stats.total > 0 ? 
    Math.round((stats.cancelled / stats.total) * 100) : 0;
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#4B0082')
    .setTitle('Statistiques Générales')
    .addFields(
      { name: '📊 Total des commandes', value: `${stats.total}`, inline: true },
      { name: '✅ Commandes terminées', value: `${stats.completed} (${completionRate}%)`, inline: true },
      { name: '❌ Commandes annulées', value: `${stats.cancelled} (${cancellationRate}%)`, inline: true },
      { name: '🔄 Commandes actives', value: `${stats.active}`, inline: true },
      { name: '⏱️ Temps moyen de complétion', value: avgTimes.formattedAvgTime, inline: true }
    )
    .setFooter({ text: 'Statistiques mises à jour' })
    .setTimestamp();
  
  return embed;
}

/**
 * Generate order statistics
 * @returns {EmbedBuilder} - Embed with order stats
 */
async function generateOrderStats() {
  // Get recent order statistics
  const recentOrders = await orderDB.getOrderHistory(5);
  
  // Get monthly statistics
  const monthlyStats = await getMonthlyStats();
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#4B0082')
    .setTitle('Statistiques Détaillées des Commandes')
    .setDescription('Aperçu des tendances et des commandes récentes')
    .setTimestamp();
  
  // Add monthly statistics
  if (monthlyStats && monthlyStats.length > 0) {
    let monthlyStatsText = '';
    monthlyStats.slice(0, 3).forEach(month => {
      const completionRate = month.total > 0 ? 
        Math.round((month.completed / month.total) * 100) : 0;
      monthlyStatsText += `**${month.month}:** ${month.total} commandes, ${completionRate}% terminées\n`;
    });
    
    embed.addFields({ name: '📅 Tendances Mensuelles', value: monthlyStatsText || 'Aucune donnée disponible' });
  }
  
  // Add recent orders
  if (recentOrders && recentOrders.length > 0) {
    let recentOrdersText = '';
    recentOrders.forEach(order => {
      const statusEmoji = order.status === 'COMPLETED' ? '✅' : '❌';
      const date = order.completedAt ? new Date(order.completedAt).toLocaleDateString() : 'N/A';
      
      recentOrdersText += `${statusEmoji} **#${order.orderid}** - Client confidentiel (${date})\n`;
    });
    
    embed.addFields({ name: '🕒 Commandes Récentes', value: recentOrdersText || 'Aucune donnée disponible' });
  }
  
  return embed;
}

/**
 * Generate coder statistics
 * @returns {EmbedBuilder} - Embed with coder stats
 */
async function generateCoderStats() {
  // Get coder statistics
  const coderStats = await getCoderStats();
  
  if (!coderStats || coderStats.length === 0) {
    const embed = new EmbedBuilder()
      .setColor('#4B0082')
      .setTitle('Statistiques des Codeurs')
      .setDescription('Aucune statistique de codeur disponible.')
      .setTimestamp();
    
    return embed;
  }
  
  // Create embed
  const embed = new EmbedBuilder()
    .setColor('#4B0082')
    .setTitle('Statistiques des Codeurs')
    .setDescription('Performances des codeurs du serveur')
    .setTimestamp();
  
  // Add top coders
  const topCoders = coderStats.slice(0, 5);
  let topCodersText = '';
  
  topCoders.forEach((coder, index) => {
    // Calculate completion rate
    const completionRate = coder.total > 0 ? 
      Math.round((coder.completed / coder.total) * 100) : 0;
    
    topCodersText += `**${index + 1}. <@${coder.userid}>** - ${coder.completed} commandes terminées (${completionRate}%)\n`;
  });
  
  embed.addFields({ name: '🏆 Meilleurs Codeurs', value: topCodersText || 'Aucune donnée disponible' });
  
  return embed;
}

/**
 * Calculate average completion time of orders
 * @returns {Object} - Average time in milliseconds and formatted
 */
async function calculateAverageCompletionTimes() {
  try {
    const { data, error } = await supabase.rpc('calculate_average_completion_time');
    
    if (error) throw error;
    
    let formattedAvgTime = 'Non disponible';
    let avgTimeMs = 0;
    
    if (data && data.avg_completion_time) {
      // Convert to milliseconds
      avgTimeMs = data.avg_completion_time * 1000;
      
      // Format to days, hours, minutes
      const days = Math.floor(avgTimeMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((avgTimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((avgTimeMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        formattedAvgTime = `${days} jour(s), ${hours} heure(s)`;
      } else {
        formattedAvgTime = `${hours} heure(s), ${minutes} minute(s)`;
      }
    }
    
    return { avgTimeMs, formattedAvgTime };
  } catch (error) {
    logger.error('Error calculating average completion time:', error);
    return { avgTimeMs: 0, formattedAvgTime: 'Non disponible' };
  }
}

/**
 * Get monthly order statistics
 * @returns {Array} - Monthly statistics
 */
async function getMonthlyStats() {
  try {
    const { data, error } = await supabase.rpc('get_monthly_order_stats');
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Error getting monthly stats:', error);
    return [];
  }
}

/**
 * Get coder statistics
 * @returns {Array} - Coder statistics
 */
async function getCoderStats() {
  try {
    const { data, error } = await supabase
      .from('coders')
      .select('userid, completedOrders')
      .order('completedOrders', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) return [];
    
    // Enrich data
    return data.map(coder => ({
      userid: coder.userid,
      completed: coder.completedOrders || 0,
      total: coder.completedOrders || 0 // Simplified example, could add more precise stats
    }));
  } catch (error) {
    logger.error('Error getting coder stats:', error);
    return [];
  }
}