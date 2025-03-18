// commands/admin/messageDelete.js - Commande pour supprimer un nombre spécifique de messages
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { adminRoles } = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('message')
    .setDescription('Commandes de gestion des messages')
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Supprime un nombre spécifique de messages du canal actuel')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Nombre de messages à supprimer (entre 1 et 100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Raison de la suppression')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  
  name: 'message_delete',
  description: 'Supprime un nombre spécifique de messages du canal actuel',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Déterminer si c'est une interaction de slash command ou un message traditionnel
      const isSlash = interaction.isChatInputCommand?.();
      
      // Pour les commandes traditionnelles
      if (!isSlash) {
        // Vérifier les arguments
        if (!args || args.length < 1) {
          return interaction.reply('Usage incorrect. Exemple: `/message delete 10`');
        }
        
        // Vérifier si la commande est bien "delete"
        if (args[0].toLowerCase() !== 'delete') {
          return interaction.reply('Sous-commande non reconnue. Utilisez `delete`.');
        }
        
        // Obtenir le nombre de messages à supprimer
        const amount = parseInt(args[1]);
        
        if (isNaN(amount) || amount < 1 || amount > 100) {
          return interaction.reply('Veuillez spécifier un nombre valide entre 1 et 100.');
        }
        
        // Informer l'utilisateur que nous commençons la suppression
        await interaction.reply(`Suppression de ${amount} message(s) en cours...`);
        
        // Supprimer le message de commande lui-même
        await interaction.message.delete().catch(() => {});
        
        // Supprimer les messages
        const messages = await interaction.channel.messages.fetch({ limit: amount });
        await interaction.channel.bulkDelete(messages, true)
          .then(deleted => {
            // Si certains messages sont trop vieux (plus de 14 jours), ils ne seront pas supprimés
            const actuallyDeleted = deleted.size;
            const remainingMessages = amount - actuallyDeleted;
            
            if (remainingMessages > 0) {
              interaction.channel.send(`Supprimé ${actuallyDeleted} message(s). ${remainingMessages} message(s) n'ont pas pu être supprimés car ils datent de plus de 14 jours.`);
            } else {
              interaction.channel.send(`${actuallyDeleted} message(s) ont été supprimés avec succès.`);
            }
          });
      }
      // Pour les slash commands
      else {
        // Vérifier que c'est bien la sous-commande "delete"
        if (interaction.options.getSubcommand() !== 'delete') {
          return;
        }
        
        // Obtenir le nombre de messages à supprimer et la raison
        const amount = interaction.options.getInteger('amount');
        const reason = interaction.options.getString('reason') || 'Aucune raison spécifiée';
        
        // Déférer la réponse pour éviter l'expiration de l'interaction pendant la suppression
        await interaction.deferReply({ ephemeral: true });
        
        // Supprimer les messages
        try {
          const messages = await interaction.channel.messages.fetch({ limit: amount });
          const deleted = await interaction.channel.bulkDelete(messages, true);
          
          // Si certains messages sont trop vieux (plus de 14 jours), ils ne seront pas supprimés
          const actuallyDeleted = deleted.size;
          const remainingMessages = amount - actuallyDeleted;
          
          let responseMessage = `${actuallyDeleted} message(s) ont été supprimés avec succès.`;
          
          if (remainingMessages > 0) {
            responseMessage += ` ${remainingMessages} message(s) n'ont pas pu être supprimés car ils datent de plus de 14 jours.`;
          }
          
          // Logger l'action pour audit
          logger.info(`${interaction.user.tag} a supprimé ${actuallyDeleted} message(s) dans #${interaction.channel.name}. Raison: ${reason}`);
          
          await interaction.editReply({
            content: responseMessage,
            ephemeral: true
          });
          
        } catch (error) {
          logger.error('Erreur lors de la suppression des messages:', error);
          await interaction.editReply({
            content: `Une erreur est survenue lors de la suppression des messages: ${error.message}`,
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error('Erreur lors de l\'exécution de la commande message_delete:', error);
      const errorMessage = 'Une erreur est survenue lors de l\'exécution de cette commande.';
      
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