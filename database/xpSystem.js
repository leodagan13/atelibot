// database/xpSystem.js - Implémentation fonctionnelle
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
 * Évaluer un projet et attribuer de l'XP au développeur
 * @param {String} developerId - ID Discord du développeur
 * @param {String} projectId - ID du projet
 * @param {String} adminId - ID Discord de l'administrateur qui a évalué
 * @param {Number} projectLevel - Niveau du projet (1-6)
 * @param {Number} rating - Note donnée (0-5)
 * @returns {Object} - Résultat avec statut et informations XP
 */
async function rateProject(developerId, projectId, adminId, projectLevel, rating) {
  try {
    logger.info(`Rating project ${projectId} by developer ${developerId} with ${rating} stars`);
    
    // Normaliser les valeurs d'entrée
    const level = Math.min(Math.max(parseInt(projectLevel) || 1, 1), 6);
    const ratingValue = Math.min(Math.max(parseInt(rating) || 0, 0), 5);
    
    // Calculer l'XP gagné
    const xpEarned = ratingValue > 0 ? XP_REWARDS[level][ratingValue] : 0;
    logger.debug(`XP calculated: ${xpEarned} (level ${level}, rating ${ratingValue})`);
    
    // 1. Vérifier si le développeur existe déjà
    let { data: developer, error: developerError } = await supabase
      .from('coders')
      .select('*')
      .eq('userid', developerId)
      .single();
      
    if (developerError && developerError.code !== 'PGRST116') {
      logger.error('Error fetching developer:', developerError);
      throw developerError;
    }
    
    // Détermine si le développeur est nouveau
    const isNewDeveloper = !developer;
    
    // Valeurs par défaut pour un nouveau développeur
    let currentXp = 0;
    let currentLevel = 1;
    let newStatus = 'SUCCESS';
    let wasLevelUp = false;
    let wasBanned = false;
    let completedProjects = 0;
    
    // Si le développeur existe, récupérer ses données
    if (developer) {
      currentXp = developer.xp || 0;
      currentLevel = developer.level || 1;
      wasBanned = developer.banned || false;
      completedProjects = developer.completedorders || 0;
    }
    
    // Ne pas continuer si le développeur est banni
    if (wasBanned) {
      return {
        status: 'BANNED',
        xpEarned: 0,
        newLevel: currentLevel,
        totalXP: currentXp,
        progressPercentage: 0
      };
    }
    
    // Si la note est 0, gestion spéciale (perte de niveau ou bannissement)
    if (ratingValue === 0) {
      // Déterminez si le développeur doit être banni ou perdre un niveau
      // Les niveaux 1-2 sont bannis après un échec
      // Les niveaux 3+ perdent un niveau
      if (currentLevel <= 2) {
        newStatus = 'BANNED';
        // Mettre à jour le développeur comme banni
        await supabase
          .from('coders')
          .update({ 
            banned: true,
            updatedat: new Date().toISOString()
          })
          .eq('userid', developerId);
      } else {
        newStatus = 'LEVEL_DOWN';
        // Le développeur perd un niveau
        currentLevel -= 1;
        // Mettre à jour le niveau du développeur
        await supabase
          .from('coders')
          .update({ 
            level: currentLevel,
            updatedat: new Date().toISOString()
          })
          .eq('userid', developerId);
      }
      
      // Enregistrer l'évaluation dans l'historique
      await supabase
        .from('project_ratings')
        .insert([{
          project_id: projectId,
          coder_id: developerId,
          admin_id: adminId,
          rating: 0,
          xp_earned: 0,
          level_before: currentLevel + (newStatus === 'LEVEL_DOWN' ? 1 : 0),
          level_after: currentLevel,
          rated_at: new Date().toISOString(),
          status: newStatus
        }]);
        
      return {
        status: newStatus,
        xpEarned: 0,
        newLevel: currentLevel,
        totalXP: currentXp,
        progressPercentage: 0
      };
    }
    
    // Cas normal: le développeur gagne de l'XP
    // Calculer le nouveau total d'XP
    const newTotalXp = currentXp + xpEarned;
    
    // Déterminer le nouveau niveau
    let newLevel = currentLevel;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      const threshold = LEVEL_THRESHOLDS[i];
      // Si l'XP actuel est supérieur au seuil minimum et que le développeur
      // a complété suffisamment de projets pour ce niveau
      if (newTotalXp >= threshold.minXp && 
          (threshold.projectsRequired === null || completedProjects + 1 >= threshold.projectsRequired)) {
        newLevel = threshold.level;
      }
    }
    
    // Vérifier si c'est une montée de niveau
    if (newLevel > currentLevel) {
      wasLevelUp = true;
      newStatus = 'LEVEL_UP';
    }
    
    // Calculer le pourcentage de progression vers le niveau suivant
    let progressPercentage = 100; // Par défaut, considérer comme complété
    let nextLevelXP = null;
    
    // Trouver le seuil du niveau suivant
    if (newLevel < LEVEL_THRESHOLDS.length) {
      const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === newLevel);
      const nextThreshold = LEVEL_THRESHOLDS.find(t => t.level === newLevel + 1);
      
      if (currentThreshold && nextThreshold) {
        const xpNeeded = nextThreshold.minXp - currentThreshold.minXp;
        const xpProgress = newTotalXp - currentThreshold.minXp;
        progressPercentage = Math.min(Math.floor((xpProgress / xpNeeded) * 100), 100);
        nextLevelXP = nextThreshold.minXp;
      }
    }
    
    // Créer ou mettre à jour le développeur
    if (isNewDeveloper) {
      await supabase
        .from('coders')
        .insert([{
          userid: developerId,
          xp: newTotalXp,
          level: newLevel,
          completedorders: 1,
          banned: false,
          createdat: new Date().toISOString(),
          updatedat: new Date().toISOString()
        }]);
    } else {
      await supabase
        .from('coders')
        .update({
          xp: newTotalXp,
          level: newLevel,
          completedorders: completedProjects + 1,
          updatedat: new Date().toISOString()
        })
        .eq('userid', developerId);
    }
    
    // Enregistrer l'évaluation dans l'historique
    await supabase
      .from('project_ratings')
      .insert([{
        project_id: projectId,
        coder_id: developerId,
        admin_id: adminId,
        rating: ratingValue,
        xp_earned: xpEarned,
        level_before: currentLevel,
        level_after: newLevel,
        rated_at: new Date().toISOString(),
        status: newStatus
      }]);
    
    // Retourner les résultats
    return {
      status: newStatus,
      xpEarned: xpEarned,
      newLevel: newLevel,
      totalXP: newTotalXp,
      progressPercentage: progressPercentage,
      nextLevelXP: nextLevelXP
    };
    
  } catch (error) {
    logger.error(`Error rating project:`, error);
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
  
  // Ensure we have valid inputs
  const level = Math.min(Math.max(parseInt(projectLevel) || 1, 1), 6);
  const ratingValue = Math.min(Math.max(parseInt(rating) || 0, 0), 5);
  
  // Get XP from rewards table
  return XP_REWARDS[level][ratingValue] || 0;
}

/**
 * Get developer experience data
 * @param {String} developerId - Discord ID of the developer
 * @returns {Object} - Developer XP data
 */
async function getDeveloperXP(developerId) {
  try {
    const { data, error } = await supabase
      .from('coders')
      .select('*')
      .eq('userid', developerId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (!data) {
      return {
        level: 1,
        totalXP: 0,
        projectsCompleted: 0,
        banned: false,
        nextLevelXP: 100,
        progressPercentage: 0
      };
    }
    
    // Calculer le pourcentage de progression vers le niveau suivant
    let progressPercentage = 100; // Par défaut, considérer comme complété
    let nextLevelXP = null;
    
    // Trouver le seuil du niveau suivant
    if (data.level < LEVEL_THRESHOLDS.length) {
      const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === data.level);
      const nextThreshold = LEVEL_THRESHOLDS.find(t => t.level === data.level + 1);
      
      if (currentThreshold && nextThreshold) {
        const xpNeeded = nextThreshold.minXp - currentThreshold.minXp;
        const xpProgress = data.xp - currentThreshold.minXp;
        progressPercentage = Math.min(Math.floor((xpProgress / xpNeeded) * 100), 100);
        nextLevelXP = nextThreshold.minXp;
      }
    }
    
    return {
      level: data.level || 1,
      totalXP: data.xp || 0,
      projectsCompleted: data.completedorders || 0,
      banned: data.banned || false,
      nextLevelXP: nextLevelXP,
      progressPercentage: progressPercentage
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
    const { data, error } = await supabase
      .from('coders')
      .select('*')
      .eq('userid', coderId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // Si aucune donnée, créer statistiques par défaut
    if (!data) {
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
    
    // Calculer le niveau suivant et la progression
    let next_level_xp = null;
    let xp_progress = 100;
    
    if (data.level < LEVEL_THRESHOLDS.length) {
      const currentThreshold = LEVEL_THRESHOLDS.find(t => t.level === data.level);
      const nextThreshold = LEVEL_THRESHOLDS.find(t => t.level === data.level + 1);
      
      if (currentThreshold && nextThreshold) {
        next_level_xp = nextThreshold.minXp;
        const xpNeeded = nextThreshold.minXp - currentThreshold.minXp;
        const xpProgress = data.xp - currentThreshold.minXp;
        xp_progress = Math.min(Math.floor((xpProgress / xpNeeded) * 100), 100);
      }
    }
    
    // Calculer la note moyenne
    const { data: ratings, error: ratingsError } = await supabase
      .from('project_ratings')
      .select('rating')
      .eq('coder_id', coderId);
    
    if (ratingsError) {
      logger.warn(`Error fetching ratings for coder ${coderId}:`, ratingsError);
    }
    
    let avg_rating = 0;
    let perfect_projects = 0;
    
    if (ratings && ratings.length > 0) {
      // Filtrer les notes valides (supérieures à 0)
      const validRatings = ratings.filter(r => r.rating > 0);
      
      if (validRatings.length > 0) {
        const sum = validRatings.reduce((acc, curr) => acc + curr.rating, 0);
        avg_rating = parseFloat((sum / validRatings.length).toFixed(1));
        
        // Compter les projets parfaits (note 5)
        perfect_projects = validRatings.filter(r => r.rating === 5).length;
      }
    }
    
    return {
      total_projects: data.completedorders || 0,
      perfect_projects: perfect_projects,
      avg_rating: avg_rating,
      total_xp: data.xp || 0,
      current_level: data.level || 1,
      next_level_xp: next_level_xp,
      xp_progress: xp_progress,
      banned: data.banned || false
    };
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
        status
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
      .select('userid, xp, level, completedorders')
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
  getDeveloperXP,
  LEVEL_THRESHOLDS,
  XP_REWARDS
};