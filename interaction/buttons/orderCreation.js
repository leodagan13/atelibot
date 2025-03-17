// interaction/buttons/orderCreation.js - Handle the order creation flow
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orderDB } = require('../../database');
const { PUBLISH_ORDERS_CHANNEL_ID } = require('../../config/config');
const logger = require('../../utils/logger');

/**
 * Process input for an active order creation session
 * @param {Object} message - Discord message
 * @param {Object} orderSession - Current order session data
 * @param {Object} client - Discord client
 */
async function processOrderInput(message, orderSession, client) {
  try {
    // Ignore if message is not in the same channel as the order creation
    if (message.channel.id !== orderSession.channelId) return;
    
    // Process input based on current step
    switch (orderSession.step) {
      case 0: // Client name
        orderSession.data.clientName = message.content;
        orderSession.step = 1;
        await message.reply(`Client enregistré: **${message.content}**`);
        await message.channel.send('**Étape 2/3**: Quelle est la rémunération pour ce travail?');
        break;
        
      case 1: // Compensation
        orderSession.data.compensation = message.content;
        orderSession.step = 2;
        await message.reply(`Rémunération enregistrée: **${message.content}**`);
        await message.channel.send('**Étape 3/3**: Veuillez fournir une description détaillée du travail.');
        break;
        
      case 2: // Description
        orderSession.data.description = message.content;
        orderSession.step = 3;
        
        // Show summary and confirmation buttons
        await showOrderSummary(message, orderSession, client);
        break;
    }
    
  } catch (error) {
    logger.error('Error processing order input:', error);
    await message.reply('Une erreur est survenue lors du traitement de votre réponse.');
  }
}

/**
 * Show summary of the order and confirmation buttons
 * @param {Object} message - Discord message
 * @param {Object} orderSession - Current order session data
 * @param {Object} client - Discord client
 */
async function showOrderSummary(message, orderSession, client) {
  try {
    // Create embed with order summary
    const embed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('Résumé de l\'offre')
      .addFields(
        { name: 'Client', value: orderSession.data.clientName },
        { name: 'Rémunération', value: orderSession.data.compensation },
        { name: 'Description', value: orderSession.data.description }
      )
      .setFooter({ text: `Offre #${orderSession.orderId}` })
      .setTimestamp();
    
    // Create confirmation buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_order_${message.author.id}`)
          .setLabel('Confirmer')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_order_${message.author.id}`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
      );
    
    // Send summary
    const summaryMessage = await message.reply({
      content: 'Voici le résumé de l\'offre. Veuillez confirmer ou annuler:',
      embeds: [embed],
      components: [row]
    });
    
    // Set up collector for button interaction
    const filter = i => 
      (i.customId === `confirm_order_${message.author.id}` || 
       i.customId === `cancel_order_${message.author.id}`) && 
      i.user.id === message.author.id;
    
    const collector = summaryMessage.createMessageComponentCollector({ 
      filter, 
      time: 300000 // 5 minutes
    });
    
    collector.on('collect', async interaction => {
      if (interaction.customId === `confirm_order_${message.author.id}`) {
        await publishOrder(interaction, orderSession, client);
      } else {
        await cancelOrder(interaction, client);
      }
      
      collector.stop();
    });
    
    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // If timed out
        client.activeOrders.delete(message.author.id);
        
        if (summaryMessage.editable) {
          // Update the message to show it's expired
          const expiredRow = new ActionRowBuilder()
            .addComponents(
              ButtonBuilder.from(row.components[0])
                .setDisabled(true)
                .setLabel('Expiré'),
              ButtonBuilder.from(row.components[1])
                .setDisabled(true)
                .setLabel('Expiré')
            );
          
          await summaryMessage.edit({ 
            content: 'La session de création d\'offre a expiré.',
            components: [expiredRow]
          });
        }
      }
    });
    
  } catch (error) {
    logger.error('Error showing order summary:', error);
    await message.reply('Une erreur est survenue lors de l\'affichage du résumé de l\'offre.');
  }
}

/**
 * Publish the order to the designated channel
 * @param {Object} interaction - Button interaction
 * @param {Object} orderSession - Current order session data
 * @param {Object} client - Discord client
 */
async function publishOrder(interaction, orderSession, client) {
  try {
    // Create the order in the database
    const orderData = {
      orderId: orderSession.orderId,
      adminId: interaction.user.id,
      data: orderSession.data
    };
    
    await orderDB.create(orderData);
    
    // Create embed for the order
    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle(`Nouvelle offre #${orderSession.orderId}`)
      .addFields(
        { name: 'Client', value: orderSession.data.clientName },
        { name: 'Rémunération', value: orderSession.data.compensation },
        { name: 'Description', value: orderSession.data.description },
        { name: 'Posté par', value: `<@${interaction.user.id}>` }
      )
      .setFooter({ text: `Offre #${orderSession.orderId}` })
      .setTimestamp();
    
    // Add button to accept the order
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_order_${orderSession.orderId}`)
          .setLabel('Accepter ce travail')
          .setStyle(ButtonStyle.Primary)
      );
    
    // Get the publish channel
    const publishChannel = client.channels.cache.get(PUBLISH_ORDERS_CHANNEL_ID);
    
    if (!publishChannel) {
      return interaction.update({
        content: 'Erreur: Canal de publication introuvable.',
        components: []
      });
    }
    
    // Publish the order
    await publishChannel.send({
      content: '**📢 Nouvelle opportunité de travail disponible!**',
      embeds: [embed],
      components: [row]
    });
    
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Respond to interaction
    await interaction.update({
      content: `✅ Offre #${orderSession.orderId} publiée avec succès dans <#${PUBLISH_ORDERS_CHANNEL_ID}>.`,
      embeds: [],
      components: []
    });
    
  } catch (error) {
    logger.error('Error publishing order:', error);
    await interaction.update({
      content: 'Une erreur est survenue lors de la publication de l\'offre.',
      components: []
    });
  }
}

/**
 * Cancel the order creation process
 * @param {Object} interaction - Button interaction
 * @param {Object} client - Discord client
 */
async function cancelOrder(interaction, client) {
  try {
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Respond to interaction
    await interaction.update({
      content: '❌ Création d\'offre annulée.',
      embeds: [],
      components: []
    });
    
  } catch (error) {
    logger.error('Error cancelling order:', error);
    await interaction.update({
      content: 'Une erreur est survenue lors de l\'annulation de l\'offre.',
      components: []
    });
  }
}

module.exports = {
  processOrderInput
};