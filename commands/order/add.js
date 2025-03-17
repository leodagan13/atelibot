// commands/order/add.js - Version mise à jour avec support pour slash commands
const { SlashCommandBuilder } = require('@discordjs/builders');
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
      // Déterminer si c'est une interaction slash command ou un message traditionnel
      const isSlash = interaction.isChatInputCommand?.();
      const userId = isSlash ? interaction.user.id : interaction.author.id;
      
      // Check if user is already creating an order
      if (client.activeOrders.has(userId)) {
        const reply = 'Vous avez déjà une création d\'offre en cours. Terminez-la ou annulez-la avant d\'en créer une nouvelle.';
        return isSlash ? interaction.reply({ content: reply, ephemeral: true }) : interaction.reply(reply);
      }
      
      // Générer un ID unique avec timestamp + random string pour éviter les doublons
      const randomString = Math.random().toString(36).substring(2, 8);
      const orderId = `${Date.now().toString().slice(-8)}-${randomString}`;
      
      // Start a new order session
      const orderSession = {
        step: 0,
        data: {},
        startedAt: Date.now(),
        channelid: isSlash ? interaction.channelId : interaction.channel.id,
        orderId: orderId
      };
      
      // Add to active sessions
      client.activeOrders.set(userId, orderSession);
      
      // Begin the order creation process
      if (isSlash) {
        await interaction.reply({ 
          content: 'Commençons la création d\'une nouvelle offre. Veuillez répondre aux questions suivantes:',
          ephemeral: false 
        });
        await interaction.channel.send('**Étape 1/3**: Quel est le nom du client pour cette offre?');
      } else {
        await interaction.reply('Commençons la création d\'une nouvelle offre. Veuillez répondre aux questions suivantes:');
        await interaction.channel.send('**Étape 1/3**: Quel est le nom du client pour cette offre?');
      }
      
      // Log for debugging
      logger.info(`Order creation started by ${isSlash ? interaction.user.tag : interaction.author.tag}`);
      
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