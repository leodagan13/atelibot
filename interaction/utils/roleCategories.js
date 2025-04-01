// interactions/utils/roleCategories.js - Utility functions for role categories
const logger = require('../../utils/logger');

/**
 * Helper function to categorize roles
 * @param {Object} guild - Discord guild
 * @param {String} category - Category name
 * @returns {Array} - Array of roles in the category
 */
function getRolesByCategory(guild, category) {
  // Define patterns or prefixes for each category
  const categoryPatterns = {
    'dev_language': ['javascript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'typescript'],
    'front_end': ['react', 'vue', 'angular', 'svelte', 'html', 'css', 'sass', 'tailwind', 'bootstrap', 'javascript'],
    'back_end': ['node', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'fastapi', 'graphql', 'rest'],
    'database': ['sql', 'mysql', 'postgresql', 'mongodb', 'firebase', 'supabase', 'dynamodb', 'redis', 'sqlite', 'oracle'],
    'ui': ['figma', 'sketch', 'adobe', 'design', 'ui', 'ux', 'photoshop', 'illustrator', 'wireframe', 'prototype'],
    'other': ['git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'devops', 'testing', 'security', 'agile']
  };
  
  const patterns = categoryPatterns[category] || [];
  
  // Skip administrative or system roles
  const excludedRoleIds = ['1351225002577362977', '1351725292741197976', '1350494624342347878', '1351733161851097160', '1354152839391219794', '1354096392930594817', '1354096374446293132', '1354095959432364042', '1354095959432364042', '1354095928285335704', '1354095899760005303', '1354095863370219622', '1354152891631538227', '1353658097251520533', '1356598917869080586']; 
  
  // Convert Collection to Array first
  return Array.from(guild.roles.cache.values())
    .filter(role => {
      // Skip managed roles, @everyone role, and excluded roles
      if (role.managed || role.id === guild.id || excludedRoleIds.includes(role.id)) return false;
      
      // Check if role name matches any pattern for this category
      const roleName = role.name.toLowerCase();
      
      // Category-specific checks
      if (category === 'other') {
        // For "Other" category, include roles that don't match any other category
        for (const cat in categoryPatterns) {
          if (cat === 'other') continue;
          
          // If the role matches a pattern in another category, it doesn't belong in "Other"
          if (categoryPatterns[cat].some(pattern => roleName.includes(pattern))) {
            return false;
          }
        }
        // If it didn't match any other category, include it in "Other"
        return true;
      } else {
        // For specific categories, check if the role name contains any of the patterns
        return patterns.some(pattern => roleName.includes(pattern));
      }
    })
    .sort((a, b) => b.position - a.position);
}

/**
 * Helper function to format category names for display
 * @param {String} category - Category name
 * @returns {String} - Formatted category name
 */
function formatCategoryName(category) {
  const parts = category.split('_');
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

module.exports = {
  getRolesByCategory,
  formatCategoryName
};