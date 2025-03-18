// commands/order/add.js - Version mise à jour avec formulaire interactif
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { CREATE_ORDERS_CHANNEL_ID } = require('../../config/config');
const { orderDB } = require('../../database');
const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PUBLISH_ORDERS_CHANNEL_ID } = require('../../config/config');
const logger = require('../../utils/logger');
const { createSidebarOrderEmbed } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Créer une nouvelle offre de travail'),
  
  name: 'add',
  description: 'Créer une nouvelle offre de travail',
  requiredChannel: CREATE_ORDERS_CHANNEL_ID,
  
  async execute(interaction, args, client) {
    try {
      // Déterminer si c'est une interaction slash command ou un message traditionnel
      const isSlash = interaction.isChatInputCommand?.();
      const userId = isSlash ? interaction.user.id : interaction.author.id;
      
      // Check if user is already creating an order
      if (client.activeOrders.has(userId)) {
        const reply = 'Vous avez déjà une création d\'offre en cours. Terminez-la ou annulez-la avant d\'en créer une nouvelle.';
        return isSlash ? interaction.reply({ content: reply, ephemeral: true }) : interaction.reply(reply);
      }
      
      if (isSlash) {
        // Créer un modal pour saisir toutes les informations en une fois
        const modal = new ModalBuilder()
          .setCustomId(`create_order_modal_${userId}`)
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

        // Organisation des champs en lignes
        const clientNameRow = new ActionRowBuilder().addComponents(clientNameInput);
        const compensationRow = new ActionRowBuilder().addComponents(compensationInput);
        const descriptionRow = new ActionRowBuilder().addComponents(descriptionInput);
        const tagsRow = new ActionRowBuilder().addComponents(tagsInput);

        // Ajout des lignes au modal
        modal.addComponents(clientNameRow, compensationRow, descriptionRow, tagsRow);

        // Afficher le modal
        await interaction.showModal(modal);
      } else {
        // Pour les commandes en préfixe, garder l'ancien système ou rediriger vers la slash command
        await interaction.reply('Veuillez utiliser la slash command `/add` pour créer une nouvelle offre.');
      }
      
      logger.info(`Order creation modal shown to ${isSlash ? interaction.user.tag : interaction.author.tag}`);
      
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

async function handleOrderModalSubmit(interaction, orderData) {
    // ... existing code ...
    
    // Replace embed creation with:
    const { embed, row } = createSidebarOrderEmbed(orderData, appearance.logoUrl);
    
    // Use the returned embed and row
    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
    
    // ... existing code ...
}