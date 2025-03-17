// commands/admin/stats.js - Commande pour afficher les statistiques des commandes

const { EmbedBuilder } = require('discord.js');
const { orderDB, coderDB } = require('../../database');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');
const supabase = require('../../database/supabase');

module.exports = {
  name: 'stats',
  description: 'Affiche les statistiques des commandes et des codeurs',
  permissions: adminRoles,
  
  async execute(message, args, client) {
    try {
      // Déterminer le type de statistiques à afficher
      let statsType = 'general';
      if (args.length > 0) {
        const validTypes = ['general', 'orders', 'coders'];
        const requestedType = args[0].toLowerCase();
        
        if (validTypes.includes(requestedType)) {
          statsType = requestedType;
        }
      }
      
      // Obtenir et afficher les statistiques demandées
      switch (statsType) {
        case 'general':
          await showGeneralStats(message);
          break;
          
        case 'orders':
          await showOrderDetailStats(message);
          break;
          
        case 'coders':
          await showCoderStats(message);
          break;
      }
      
    } catch (error) {
      logger.error('Error displaying statistics:', error);
      message.reply('Une erreur est survenue lors de l\'affichage des statistiques.');
    }
  }
};

/**
 * Affiche les statistiques générales
 * @param {Object} message - Message Discord
 */
async function showGeneralStats(message) {
  // Récupérer les statistiques
  const stats = await orderDB.getOrderStats();
  
  // Calculer les temps moyens
  const avgTimes = await calculateAverageCompletionTimes();
  
  // Calculer les taux de complétion et d'annulation
  const completionRate = stats.total > 0 ? 
    Math.round((stats.completed / stats.total) * 100) : 0;
  const cancellationRate = stats.total > 0 ? 
    Math.round((stats.cancelled / stats.total) * 100) : 0;
  
  // Créer l'embed
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
  
  await message.reply({ embeds: [embed] });
}

/**
 * Affiche les statistiques détaillées des commandes
 * @param {Object} message - Message Discord
 */
async function showOrderDetailStats(message) {
  // Récupérer les statistiques des commandes récentes
  const recentOrders = await orderDB.getOrderHistory(5);
  
  // Récupérer les statistiques mensuelles
  const monthlyStats = await getMonthlyStats();
  
  // Créer l'embed
  const embed = new EmbedBuilder()
    .setColor('#4B0082')
    .setTitle('Statistiques Détaillées des Commandes')
    .setDescription('Aperçu des tendances et des commandes récentes')
    .setTimestamp();
  
  // Ajouter les statistiques mensuelles
  if (monthlyStats && monthlyStats.length > 0) {
    let monthlyStatsText = '';
    monthlyStats.slice(0, 3).forEach(month => {
      const completionRate = month.total > 0 ? 
        Math.round((month.completed / month.total) * 100) : 0;
      monthlyStatsText += `**${month.month}:** ${month.total} commandes, ${completionRate}% terminées\n`;
    });
    
    embed.addFields({ name: '📅 Tendances Mensuelles', value: monthlyStatsText || 'Aucune donnée disponible' });
  }
  
  // Ajouter les commandes récentes
  if (recentOrders && recentOrders.length > 0) {
    let recentOrdersText = '';
    recentOrders.forEach(order => {
      const statusEmoji = order.status === 'COMPLETED' ? '✅' : '❌';
      const date = order.completedAt ? new Date(order.completedAt).toLocaleDateString() : 'N/A';
      
      recentOrdersText += `${statusEmoji} **#${order.orderId}** - ${order.clientName} (${date})\n`;
    });
    
    embed.addFields({ name: '🕒 Commandes Récentes', value: recentOrdersText || 'Aucune donnée disponible' });
  }
  
  await message.reply({ embeds: [embed] });
}

/**
 * Affiche les statistiques des codeurs
 * @param {Object} message - Message Discord
 */
async function showCoderStats(message) {
  // Récupérer les statistiques des codeurs
  const coderStats = await getCoderStats();
  
  if (!coderStats || coderStats.length === 0) {
    return message.reply('Aucune statistique de codeur disponible.');
  }
  
  // Créer l'embed
  const embed = new EmbedBuilder()
    .setColor('#4B0082')
    .setTitle('Statistiques des Codeurs')
    .setDescription('Performances des codeurs du serveur')
    .setTimestamp();
  
  // Ajouter les meilleurs codeurs
  const topCoders = coderStats.slice(0, 5);
  let topCodersText = '';
  
  topCoders.forEach((coder, index) => {
    // Calcul du taux de complétion
    const completionRate = coder.total > 0 ? 
      Math.round((coder.completed / coder.total) * 100) : 0;
    
    topCodersText += `**${index + 1}. <@${coder.userId}>** - ${coder.completed} commandes terminées (${completionRate}%)\n`;
  });
  
  embed.addFields({ name: '🏆 Meilleurs Codeurs', value: topCodersText || 'Aucune donnée disponible' });
  
  await message.reply({ embeds: [embed] });
}

/**
 * Calcule le temps moyen de complétion des commandes
 * @returns {Object} - Temps moyen en millisecondes et formaté
 */
async function calculateAverageCompletionTimes() {
  try {
    const { data, error } = await supabase.rpc('calculate_average_completion_time');
    
    if (error) throw error;
    
    let formattedAvgTime = 'Non disponible';
    let avgTimeMs = 0;
    
    if (data && data.avg_completion_time) {
      // Convertir en millisecondes
      avgTimeMs = data.avg_completion_time * 1000;
      
      // Formater en jours, heures, minutes
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
 * Récupère les statistiques mensuelles des commandes
 * @returns {Array} - Statistiques mensuelles
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
 * Récupère les statistiques des codeurs
 * @returns {Array} - Statistiques des codeurs
 */
async function getCoderStats() {
  try {
    const { data, error } = await supabase
      .from('coders')
      .select('userId, completedOrders')
      .order('completedOrders', { ascending: false });
    
    if (error) throw error;
    
    if (!data || data.length === 0) return [];
    
    // Enrichir les données
    return data.map(coder => ({
      userId: coder.userId,
      completed: coder.completedOrders || 0,
      total: coder.completedOrders || 0 // Simplifié pour l'exemple, on pourrait ajouter des stats plus précises
    }));
  } catch (error) {
    logger.error('Error getting coder stats:', error);
    return [];
  }
}