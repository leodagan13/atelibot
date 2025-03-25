// commands/order/add.js - With role selector component
const { SlashCommandBuilder } = require('@discordjs/builders');
const { 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder
} = require('discord.js');
const { CREATE_ORDERS_CHANNEL_ID } = require('../../config/config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Créer une nouvelle offre de travail'),
  
  name: 'add',
  description: 'Créer une nouvelle offre de travail',
  requiredChannel: CREATE_ORDERS_CHANNEL_ID,
  
  async execute(interaction, args, client) {
    try {
      // Déterminer si c'est une interaction slash command
      const isSlash = interaction.isChatInputCommand?.();
      const userId = isSlash ? interaction.user.id : interaction.author.id;
      
      // Check if user is already creating an order
      if (client.activeOrders.has(userId)) {
        const reply = 'Vous avez déjà une création d\'offre en cours. Terminez-la ou annulez-la avant d\'en créer une nouvelle.';
        return isSlash ? interaction.reply({ content: reply, ephemeral: true }) : interaction.reply(reply);
      }
      
      if (isSlash) {
        // Initialiser la session de création avec un objet vide
        client.activeOrders.set(userId, {
          step: 'initial',
          data: {},
          channelId: interaction.channelId
        });
        
        // Afficher d'abord un modal pour les détails principaux
        const modal = new ModalBuilder()
          .setCustomId(`create_order_details_${userId}`)
          .setTitle('Nouvelle offre de travail');

        // Ajout des champs du formulaire
        const clientNameInput = new TextInputBuilder()
          .setCustomId('clientName')
          .setLabel('Nom du client (confidentiel pour les codeurs)')
          .setPlaceholder('Entrez le nom du client')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        const compensationInput = new TextInputBuilder()
          .setCustomId('compensation')
          .setLabel('Rémunération pour le codeur')
          .setPlaceholder('Ex: 20€, 2 crédits, etc...')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description du travail')
          .setPlaceholder('Décrivez le travail à réaliser en détail')
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000);
          
        // Ajout du champ pour les tags
        const tagsInput = new TextInputBuilder()
          .setCustomId('tags')
          .setLabel('Tags (séparés par des virgules)')
          .setPlaceholder('javascript, discord.js, bot, etc...')
          .setRequired(false)
          .setStyle(TextInputStyle.Short);

        // Ajouter le champ pour la deadline
        const deadlineInput = new TextInputBuilder()
          .setCustomId('deadline')
          .setLabel('Deadline (YYYY-MM-DD)')
          .setPlaceholder('Ex: 2025-04-15 pour le 15 avril 2025')
          .setRequired(false)
          .setStyle(TextInputStyle.Short);

        // Ajouter le champ pour le niveau
        const levelInput = new TextInputBuilder()
          .setCustomId('level')
          .setLabel('Niveau (1-6, 6 étant le plus difficile)')
          .setPlaceholder('1-6')
          .setRequired(false)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(1);

        // Organisation des champs en lignes
        const clientNameRow = new ActionRowBuilder().addComponents(clientNameInput);
        const compensationRow = new ActionRowBuilder().addComponents(compensationInput);
        const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
        const tagsRow = new ActionRowBuilder().addComponents(tagsInput);
        const deadlineRow = new ActionRowBuilder().addComponents(deadlineInput);
        const levelRow = new ActionRowBuilder().addComponents(levelInput);

        // Ajout des lignes au modal
        modal.addComponents(clientNameRow, compensationRow, descriptionRow, tagsRow, deadlineRow, levelRow);

        // Afficher le modal
        await interaction.showModal(modal);
      } else {
        // Pour les commandes en préfixe, rediriger vers la slash command
        await interaction.reply('Veuillez utiliser la slash command `/add` pour créer une nouvelle offre.');
      }
      
      logger.info(`Order creation started for ${isSlash ? interaction.user.tag : interaction.author.tag}`);
      
    } catch (error) {
      logger.error('Error starting order creation:', error);
      
      if (interaction.isChatInputCommand?.()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: 'Une erreur est survenue lors du démarrage de la création d\'offre.', ephemeral: true });
        } else {
          await interaction.reply({ content: 'Une erreur est survenue lors du démarrage de la création d\'offre.', ephemeral: true });
        }
      } else {
        interaction.reply('Une erreur est survenue lors du démarrage de la création d\'offre.');
      }
    }
  }
};