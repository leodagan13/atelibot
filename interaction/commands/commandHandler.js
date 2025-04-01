// interactions/commands/commandHandler.js - Handles slash command interactions
const logger = require('../../utils/logger');

/**
 * Handles slash command interactions
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 */
async function handleCommand(interaction, client) {
  const command = client.slashCommands.get(interaction.commandName);
  
  if (!command) {
    logger.error(`Slash command not found: ${interaction.commandName}`);
    return interaction.reply({
      content: 'Cette commande n\'existe pas.',
      ephemeral: true
    });
  }
  
  try {
    logger.info(`Executing slash command: ${interaction.commandName}`);
    await command.execute(interaction, [], client);
  } catch (error) {
    logger.error(`Error executing slash command ${interaction.commandName}:`, error);
    
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
        ephemeral: true
      });
    }
  }
}

module.exports = { handleCommand };