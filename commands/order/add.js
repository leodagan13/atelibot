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
    .setDescription('Create a new job offer'),
  
  name: 'add',
  description: 'Create a new job offer',
  requiredChannel: CREATE_ORDERS_CHANNEL_ID,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command
      const isSlash = interaction.isChatInputCommand?.();
      const userId = isSlash ? interaction.user.id : interaction.author.id;
      
      // Check if user is already creating an order
      if (client.activeOrders.has(userId)) {
        const reply = 'You already have an order creation in progress. Complete or cancel it before creating a new one.';
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
          .setTitle('New Offer - Main Information');

        // Add form fields for first modal
        const clientNameInput = new TextInputBuilder()
          .setCustomId('clientName')
          .setLabel('Client name (confidential)')
          .setPlaceholder('Enter the client name')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        const compensationInput = new TextInputBuilder()
          .setCustomId('compensation')
          .setLabel('Compensation for the coder')
          .setPlaceholder('Ex: 20€, 2 credits, etc...')
          .setRequired(true)
          .setStyle(TextInputStyle.Short);

        const descriptionInput = new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Work description')
          .setPlaceholder('Describe the work to be done in detail')
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
        await interaction.reply('Please use the slash command `/add` to create a new offer.');
      }
      
      logger.info(`Order creation started for ${isSlash ? interaction.user.tag : interaction.author.tag}`);
      
    } catch (error) {
      logger.error('Error starting order creation:', error);
      
      if (interaction.isChatInputCommand?.()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: 'An error occurred while starting the order creation.', ephemeral: true });
        } else {
          await interaction.reply({ content: 'An error occurred while starting the order creation.', ephemeral: true });
        }
      } else {
        interaction.reply('An error occurred while starting the order creation.');
      }
    }
  }
};