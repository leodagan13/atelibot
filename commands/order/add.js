// commands/order/add.js - With sequential modals approach
const { SlashCommandBuilder } = require('@discordjs/builders');
const { 
  ActionRowBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle
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
      // Determine if this is a slash command
      const isSlash = interaction.isChatInputCommand?.();
      const userId = isSlash ? interaction.user.id : interaction.author.id;
      
      // Check if user is already creating an order
      if (client.activeOrders.has(userId)) {
        const reply = 'Vous avez déjà une création d\'offre en cours. Terminez-la ou annulez-la avant d\'en créer une nouvelle.';
        return isSlash ? interaction.reply({ content: reply, ephemeral: true }) : interaction.reply(reply);
      }
      
      if (isSlash) {
        // Initialize the creation session with an empty object
        client.activeOrders.set(userId, {
          step: 'initial_modal',
          data: {},
          channelId: interaction.channelId
        });
        
        // Create the first modal - Basic information
        const modal = new ModalBuilder()
          .setCustomId(`create_order_details_${userId}`)
          .setTitle('Nouvelle offre - Informations principales');

        // Add form fields for first modal
        const clientNameInput = new TextInputBuilder()
          .setCustomId('clientName')
          .setLabel('Nom du client (confidentiel)')
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

        // Create rows for inputs
        const clientNameRow = new ActionRowBuilder().addComponents(clientNameInput);
        const compensationRow = new ActionRowBuilder().addComponents(compensationInput);
        const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);

        // Add rows to modal (maximum 5 rows)
        modal.addComponents(clientNameRow, compensationRow, descriptionRow);

        // Show the modal
        await interaction.showModal(modal);
      } else {
        // For prefix commands, redirect to slash command
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