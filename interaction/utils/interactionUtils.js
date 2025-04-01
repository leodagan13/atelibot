/**
 * Extracts the user ID from an interaction's customId
 * @param {Object} interaction - Discord interaction object
 * @returns {String} - The extracted user ID
 */
function getUserIdFromInteraction(interaction) {
  if (!interaction || !interaction.customId) {
    return null;
  }
  
  // For most formats, the user ID is the last part after splitting by underscore
  const parts = interaction.customId.split('_');
  return parts[parts.length - 1];
}

module.exports = {
  getUserIdFromInteraction
}; 