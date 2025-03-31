// database/xpSystem.js
const supabase = require('./supabase');
const logger = require('../utils/logger');

/**
 * Structure des niveaux et XP nécessaires
 */
const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, maxXp: 100, projectsRequired: 1 },
  { level: 2, minXp: 100, maxXp: 700, projectsRequired: 2 },
  { level: 3, minXp: 700, maxXp: 5200, projectsRequired: 5 },
  { level: 4, minXp: 5200, maxXp: 32200, projectsRequired: 10 },
  { level: 5, minXp: 32200, maxXp: 194200, projectsRequired: 20 },
  { level: 6, minXp: 194200, maxXp: null, projectsRequired: null }
];

/**
 * Table d'XP par niveau de projet et note
 */
const XP_REWARDS = {
  1: { 0: 0, 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 },
  2: { 0: 0, 1: 60, 2: 120, 3: 180, 4: 240, 5: 300 },
  3: { 0: 0, 1: 180, 2: 360, 3: 540, 4: 720, 5: 900 },
  4: { 0: 0, 1: 540, 2: 1080, 3: 1620, 4: 2160, 5: 2700 },
  5: { 0: 0, 1: 1620, 2: 3240, 3: 4860, 4: 6480, 5: 8100 },
  6: { 0: 0, 1: 4860, 2: 9720, 3: 14580, 4: 19440, 5: 24300 }
};

/**
 * Rates a project and awards XP to the developer
 * @param {String} developerId - Discord ID of the developer
 * @param {String} projectId - Project ID
 * @param {String} adminId - Discord ID of the admin who rated
 * @param {Number} projectLevel - Level of the project (1-6)
 * @param {Number} rating - Rating given (0-5)
 * @returns {Object} - Result with status and XP information
 */
async function rateProject(developerId, projectId, adminId, projectLevel, rating) {
    try {
        logger.info(`Rating project ${projectId} by developer ${developerId} with ${rating} stars`);
        
        // Default response with placeholder data
        // In a real implementation, this would interact with the database
        const result = {
            status: 'SUCCESS',
            xpEarned: calculateXP(projectLevel, rating),
            newLevel: 1,
            totalXP: 100,
            progressPercentage: 50,
            nextLevelXP: 200
        };
        
        // If rating is 0 (failed), special handling
        if (rating === 0) {
            result.status = 'LEVEL_DOWN';
            result.xpEarned = 0;
        }
        
        // If XP would push to next level
        if (rating >= 4) {
            result.status = 'LEVEL_UP';
            result.newLevel = 2;
        }
        
        logger.info(`XP result for ${developerId}: ${JSON.stringify(result)}`);
        return result;
    } catch (error) {
        logger.error(`Error rating project:`, error);
        // Return a basic response to avoid breaking the UI
        return {
            status: 'ERROR',
            xpEarned: 0,
            newLevel: 1,
            totalXP: 0,
            progressPercentage: 0
        };
    }
}

/**
 * Calculate XP based on project level and rating
 * @param {Number} projectLevel - Level of the project (1-6)
 * @param {Number} rating - Rating given (0-5)
 * @returns {Number} - XP earned
 */
function calculateXP(projectLevel, rating) {
    if (rating === 0) return 0;
    
    // Base XP per level
    const baseXP = {
        1: 10,  // Easy
        2: 20,  // Beginner
        3: 40,  // Intermediate
        4: 80,  // Advanced
        5: 150, // Expert
        6: 300  // Super Expert
    };
    
    // Rating multiplier
    const ratingMultiplier = {
        1: 0.6,  // Poor performance
        2: 0.8,  // Below average
        3: 1.0,  // Average
        4: 1.2,  // Good
        5: 1.5   // Excellent
    };
    
    // Calculate XP
    const level = Math.min(Math.max(projectLevel || 1, 1), 6);
    const calculatedXP = baseXP[level] * ratingMultiplier[rating];
    
    return Math.round(calculatedXP);
}

/**
 * Get developer experience data
 * @param {String} developerId - Discord ID of the developer
 * @returns {Object} - Developer XP data
 */
async function getDeveloperXP(developerId) {
    try {
        // In a real implementation, this would query from the database
        // For now, return placeholder data
        return {
            level: 1,
            totalXP: 100,
            projectsCompleted: 5,
            averageRating: 4.2,
            nextLevelXP: 200
        };
    } catch (error) {
        logger.error(`Error getting developer XP:`, error);
        return null;
    }
}

/**
 * Détermine le niveau en fonction de l'XP
 * @param {Number} xp - Points d'expérience
 * @returns {Number} - Niveau correspondant (1-6)
 */
function getLevelForXP(xp) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      return LEVEL_THRESHOLDS[i].level;
    }
  }
  return 1; // Niveau par défaut
}

/**
 * Obtient les statistiques XP du codeur
 * @param {String} coderId - ID du codeur
 * @returns {Object} - Statistiques XP
 */
async function getCoderXPStats(coderId) {
  try {
    const { data, error } = await supabase.rpc('get_coder_xp_stats', { coder_userid: coderId });
    
    if (error) throw error;
    
    // Si aucune donnée, créer statistiques par défaut
    if (!data || data.length === 0) {
      return {
        total_projects: 0,
        perfect_projects: 0,
        avg_rating: 0,
        total_xp: 0,
        current_level: 1,
        next_level_xp: 100,
        xp_progress: 0
      };
    }
    
    return data[0];
  } catch (error) {
    logger.error(`Erreur lors de la récupération des statistiques XP du codeur ${coderId}:`, error);
    throw error;
  }
}

/**
 * Obtient l'historique des évaluations du codeur
 * @param {String} coderId - ID du codeur
 * @param {Number} limit - Nombre maximum d'entrées
 * @returns {Array} - Historique des évaluations
 */
async function getCoderRatingHistory(coderId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('project_ratings')
      .select(`
        id,
        project_id,
        admin_id,
        rating,
        xp_earned,
        level_before,
        level_after,
        rated_at,
        orders:project_id (
          level,
          description,
          tags
        )
      `)
      .eq('coder_id', coderId)
      .order('rated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error(`Erreur lors de la récupération de l'historique des évaluations du codeur ${coderId}:`, error);
    throw error;
  }
}

/**
 * Obtient le classement des codeurs par niveau et XP
 * @param {Number} limit - Nombre maximum d'entrées
 * @returns {Array} - Classement des codeurs
 */
async function getCodersLeaderboard(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('coders')
      .select('userid, xp, level')
      .eq('banned', false)
      .order('level', { ascending: false })
      .order('xp', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    logger.error(`Erreur lors de la récupération du classement des codeurs:`, error);
    throw error;
  }
}

module.exports = {
  calculateXP,
  getLevelForXP,
  rateProject,
  getCoderXPStats,
  getCoderRatingHistory,
  getCodersLeaderboard,
  LEVEL_THRESHOLDS,
  XP_REWARDS,
  getDeveloperXP
};