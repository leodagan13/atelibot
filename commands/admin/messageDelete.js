// commands/admin/messageDelete.js - Command to delete a specific number of messages
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('message')
    .setDescription('Message management commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a specific number of messages from the current channel')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Number of messages to delete (between 1 and 100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for deletion')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  name: 'message_delete',
  description: 'Delete a specific number of messages from the current channel',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command or traditional message
      const isSlash = interaction.isChatInputCommand?.();
      
      // For traditional commands
      if (!isSlash) {
        // Check arguments
        if (!args || args.length < 1) {
          return interaction.reply('Incorrect usage. Example: `/message delete 10`');
        }
        
        // Check if the command is "delete"
        if (args[0].toLowerCase() !== 'delete') {
          return interaction.reply('Unrecognized subcommand. Use `delete`.');
        }
        
        // Get the number of messages to delete
        const amount = parseInt(args[1]);
        
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return interaction.reply('Please specify a valid number between 1 and 100.');
        }
        
        // Inform the user that we're starting the deletion
        await interaction.reply(`Deleting ${amount} message(s)...`);
        
        // Delete the command message itself
        await interaction.message.delete().catch(() => {});
        
        // Delete the messages
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages, true)
          .then(deleted => {
            // If some messages are too old (more than 14 days), they won't be deleted
            const actuallyDeleted = deleted.size;
            const remainingMessages = amount - actuallyDeleted;
            
            if (remainingMessages > 0) {
              interaction.channel.send(`Deleted ${actuallyDeleted} message(s). ${remainingMessages} message(s) could not be deleted because they are older than 14 days.`);
            } else {
              interaction.channel.send(`${actuallyDeleted} message(s) have been successfully deleted.`);
            }
          });
      }
      // For slash commands
      else {
        // Check that it's the "delete" subcommand
        if (interaction.options.getSubcommand() !== 'delete') {
          return;
        }
        
        // Get the number of messages to delete and the reason
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'No reason specified';
        
        // Defer the reply to avoid interaction timeout during deletion
        await interaction.deferReply({ ephemeral: true });
        
        // Delete the messages
        try {
          const messages = await interaction.channel.messages.fetch({ limit: amount });
          const deleted = await interaction.channel.bulkDelete(messages, true);
          
          // If some messages are too old (more than 14 days), they won't be deleted
          const actuallyDeleted = deleted.size;
          const remainingMessages = amount - actuallyDeleted;
          
          let responseMessage = `${actuallyDeleted} message(s) have been successfully deleted.`;
          
          if (remainingMessages > 0) {
            responseMessage += ` ${remainingMessages} message(s) could not be deleted because they are older than 14 days.`;
          }
          
          // Log the action for audit
          logger.info(`${interaction.user.tag} deleted ${actuallyDeleted} message(s) in #${interaction.channel.name}. Reason: ${reason}`);
          
          await interaction.editReply({
            content: responseMessage,
            ephemeral: true
          });
          
        } catch (error) {
          logger.error('Error while deleting messages:', error);
          await interaction.editReply({
            content: `An error occurred while deleting messages: ${error.message}`,
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error('Error executing message_delete command:', error);
      const errorMessage = 'An error occurred while executing this command.';
      
      if (interaction.isChatInputCommand?.()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } else if (!interaction.replied) {
        await interaction.reply(errorMessage);
      }
    }
  }
};