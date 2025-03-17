// commands/order/add.js - Version mise à jour avec Modal
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
  
  async execute(message, args, client) {
    try {
      // Check if user is already creating an order
      if (client.activeOrders.has(message.author.id)) {
        return message.reply('Vous avez déjà une création d\'offre en cours. Terminez-la ou annulez-la avant d\'en créer une nouvelle.');
      }
      
      // Start a new order session
      const orderSession = {
        step: 0,
        data: {},
        startedAt: Date.now(),
        channelId: message.channel.id,
        orderId: Date.now().toString().slice(-8) // Simple ID generation
      };
      
      // Add to active sessions
      client.activeOrders.set(message.author.id, orderSession);
      
      // Begin the order creation process
      await message.reply('Commençons la création d\'une nouvelle offre. Veuillez répondre aux questions suivantes:');
      await message.channel.send('**Étape 1/3**: Quel est le nom du client pour cette offre?');
      
      // Log for debugging
      logger.info(`Order creation started by ${message.author.tag}`);
      
    } catch (error) {
      logger.error('Error starting order creation:', error);
      message.reply('Une erreur est survenue lors du démarrage de la création d\'offre.');
    }
  }
};