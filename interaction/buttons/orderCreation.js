// interaction/buttons/orderCreation.js - Handle the order creation flow
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { orderDB } = require('../../database');
const { PUBLISH_ORDERS_CHANNEL_ID } = require('../../config/config');
const logger = require('../../utils/logger');
const { createSidebarOrderEmbed } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

// Stockage temporaire des commandes en cours de confirmation
const pendingConfirmations = new Map();

/**
 * Process input for an active order creation session
 * @param {Object} message - Discord message
 * @param {Object} orderSession - Current order session data
 * @param {Object} client - Discord client
 */
async function processOrderInput(message, orderSession, client) {
  try {
    logger.debug("Order session:", JSON.stringify(orderSession));
    logger.debug(`Message in channel: ${message.channel.id}, Session channel: ${orderSession.channelid}`);
    
    // Ignore if message is not in the same channel as the order creation
    if (message.channel.id !== orderSession.channelid) return;
    
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
    // Générer un ID unique pour cette confirmation
    const confirmationId = Math.random().toString(36).substring(2, 10);
    
    // Create embed with order summary
    const { embed, row } = createSidebarOrderEmbed(orderSession.data, appearance.logoUrl);
    
    // Stocker les données de l'ordre pour la confirmation
    pendingConfirmations.set(confirmationId, {
      userId: message.author.id,
      orderSession: orderSession,
      channel: message.channel
    });
    
    // Send summary
    const summaryMessage = await message.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
    
    // Set up collector for button interaction
    const filter = i => 
      (i.customId === `confirm_order_${confirmationId}` || 
       i.customId === `cancel_order_${confirmationId}`) && 
      i.user.id === message.author.id;
    
    const collector = summaryMessage.createMessageComponentCollector({ 
      filter, 
      time: 300000 // 5 minutes
    });
    
    collector.on('collect', async interaction => {
      try {
        // Répondre immédiatement pour éviter le timeout
        await interaction.deferUpdate();
        
        // Récupérer les données de confirmation
        const confirmationData = pendingConfirmations.get(confirmationId);
        
        if (!confirmationData) {
          await interaction.channel.send('Erreur: données de confirmation non trouvées.');
          return;
        }
        
        // Mettre à jour le message pour indiquer le traitement
        await summaryMessage.edit({
          content: 'Traitement en cours...',
          embeds: [embed],
          components: []
        });
        
        if (interaction.customId === `confirm_order_${confirmationId}`) {
          await processOrderConfirmation(interaction, confirmationData, client);
        } else {
          await processOrderCancellation(interaction, confirmationData, client);
        }
        
        // Supprimer les données de confirmation
        pendingConfirmations.delete(confirmationId);
        
      } catch (error) {
        logger.error('Error handling button interaction:', error);
        try {
          await interaction.channel.send('Une erreur est survenue lors du traitement de votre action.');
        } catch (sendError) {
          logger.error('Failed to send error message:', sendError);
        }
      }
      
      collector.stop();
    });
    
    collector.on('end', async (collected, reason) => {
      if (reason === 'time') {
        // Remove the confirmation data
        pendingConfirmations.delete(confirmationId);
        
        // Clear the active order
        client.activeOrders.delete(message.author.id);
        
        if (summaryMessage.editable) {
          // Update the message to show it's expired
          await summaryMessage.edit({ 
            content: 'La session de création d\'offre a expiré.',
            embeds: [embed],
            components: []
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
 * Process order confirmation
 * @param {Object} interaction - Button interaction
 * @param {Object} confirmationData - Data related to the confirmation
 * @param {Object} client - Discord client
 */
async function processOrderConfirmation(interaction, confirmationData, client) {
  try {
    const { userId, orderSession, channel } = confirmationData;
    
    // Générer un ID unique pour la commande
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create the order data
    const orderData = {
      orderId: uniqueOrderId,
      adminId: userId,
      data: orderSession.data
    };
    
    // Log pour déboguer
    logger.debug("Données de l'offre:", orderSession);
    logger.debug("Données à insérer:", {
      orderId: orderData.orderId,
      adminId: orderData.adminId,
      clientName: orderData.data.clientName,
      compensation: orderData.data.compensation,
      description: orderData.data.description
    });
    
    // Tente de créer l'ordre
    try {
      await orderDB.create(orderData);
    } catch (dbError) {
      logger.error('Error creating order:', dbError);
      await channel.send(`Une erreur est survenue lors de la création de l'offre dans la base de données: ${dbError.message}`);
      
      // Clear the active order
      client.activeOrders.delete(userId);
      return;
    }
    
    // Create embed for the order
    const { embed, row } = createSidebarOrderEmbed(orderData, appearance.logoUrl);
    
    // Get the publish channel
    const publishChannel = client.channels.cache.get(PUBLISH_ORDERS_CHANNEL_ID);
    
    if (!publishChannel) {
      logger.error('Publish channel not found:', PUBLISH_ORDERS_CHANNEL_ID);
      await channel.send('Erreur: Canal de publication introuvable.');
      return;
    }
    
    // Publish the order
    try {
      const publishedMessage = await publishChannel.send({
        content: '**📢 Nouvelle opportunité de travail disponible!**',
        embeds: [embed],
        components: [row]
      });
      
      // Update the order with the message ID
      await orderDB.updateMessageId(uniqueOrderId, publishedMessage.id);
    } catch (publishError) {
      logger.error('Error publishing order to channel:', publishError);
      await channel.send('Une erreur est survenue lors de la publication de l\'offre dans le canal.');
      return;
    }
    
    // Clear the active order
    client.activeOrders.delete(userId);
    
    // Notify success
    await channel.send(`✅ Offre #${uniqueOrderId} publiée avec succès dans <#${PUBLISH_ORDERS_CHANNEL_ID}>.`);
    
  } catch (error) {
    logger.error('Error processing order confirmation:', error);
    const { channel } = confirmationData;
    await channel.send(`Une erreur est survenue lors du traitement de la confirmation: ${error.message}`);
  }
}

/**
 * Process order cancellation
 * @param {Object} interaction - Button interaction
 * @param {Object} confirmationData - Data related to the confirmation
 * @param {Object} client - Discord client
 */
async function processOrderCancellation(interaction, confirmationData, client) {
  try {
    const { userId, channel } = confirmationData;
    
    // Clear the active order
    client.activeOrders.delete(userId);
    
    // Notify cancellation
    await channel.send('❌ Création d\'offre annulée.');
    
  } catch (error) {
    logger.error('Error processing order cancellation:', error);
    const { channel } = confirmationData;
    await channel.send(`Une erreur est survenue lors de l'annulation: ${error.message}`);
  }
}

// Cette fonction est gardée pour la compatibilité avec le code existant
async function publishOrder(interaction, orderSession, client) {
  try {
    // Pour éviter l'erreur d'interaction inconnue, déférer la mise à jour immédiatement
    try {
      await interaction.deferUpdate();
    } catch (deferError) {
      logger.error('Error deferring interaction update:', deferError);
      // Si nous ne pouvons pas différer, l'interaction pourrait être expirée
      // Continuer avec le canal normal pour envoyer des messages
    }
    
    const channel = interaction.channel;
    const userId = interaction.user.id;
    
    // Générer un nouvel ID unique
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create the order data
    const orderData = {
      orderId: uniqueOrderId,
      adminId: userId,
      data: orderSession.data
    };
    
    // Log pour déboguer
    console.log("Données de l'offre:", orderSession);
    console.log("Données à insérer:", {
      orderId: orderData.orderId,
      adminId: orderData.adminId,
      clientName: orderData.data.clientName || 'Unknown Client',
      compensation: orderData.data.compensation,
      description: orderData.data.description
    });
    
    // Tente de créer l'ordre
    let createdOrder;
    try {
      createdOrder = await orderDB.create(orderData);
    } catch (dbError) {
      logger.error('Error creating order:', dbError);
      await channel.send(`Une erreur est survenue lors de la création de l'offre dans la base de données: ${dbError.message}`);
      
      // Clear the active order
      client.activeOrders.delete(userId);
      return;
    }
    
    // Create embed for the order
    const { embed, row } = createSidebarOrderEmbed(orderData, appearance.logoUrl);
    
    // Get the publish channel
    const publishChannel = client.channels.cache.get(PUBLISH_ORDERS_CHANNEL_ID);
    
    if (!publishChannel) {
      logger.error('Publish channel not found:', PUBLISH_ORDERS_CHANNEL_ID);
      await channel.send('Erreur: Canal de publication introuvable.');
      return;
    }
    
    // Publish the order
    try {
      const publishedMessage = await publishChannel.send({
        content: '**📢 Nouvelle opportunité de travail disponible!**',
        embeds: [embed],
        components: [row]
      });
      
      // Update the order with the message ID
      await orderDB.updateMessageId(uniqueOrderId, publishedMessage.id);
    } catch (publishError) {
      logger.error('Error publishing order to channel:', publishError);
      await channel.send('Une erreur est survenue lors de la publication de l\'offre dans le canal.');
      return;
    }
    
    // Clear the active order
    client.activeOrders.delete(userId);
    
    // Notify success
    await channel.send(`✅ Offre #${uniqueOrderId} publiée avec succès dans <#${PUBLISH_ORDERS_CHANNEL_ID}>.`);
    
  } catch (error) {
    logger.error('Error publishing order:', error);
    
    try {
      // L'interaction pourrait être expirée, donc utiliser le canal directement
      const channel = interaction.channel;
      await channel.send(`Une erreur est survenue lors de la publication de l'offre: ${error.message}`);
    } catch (replyError) {
      logger.error('Failed to respond with error message:', replyError);
    }
  }
}

// Cette fonction est gardée pour la compatibilité avec le code existant
async function cancelOrder(interaction, client) {
  try {
    // Pour éviter l'erreur d'interaction inconnue, déférer la mise à jour immédiatement
    try {
      await interaction.deferUpdate();
    } catch (deferError) {
      logger.error('Error deferring interaction update:', deferError);
      // Si nous ne pouvons pas différer, l'interaction pourrait être expirée
    }
    
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Notify cancellation
    await interaction.channel.send('❌ Création d\'offre annulée.');
    
  } catch (error) {
    logger.error('Error cancelling order:', error);
    try {
      await interaction.channel.send('Une erreur est survenue lors de l\'annulation de l\'offre.');
    } catch (sendError) {
      logger.error('Failed to send error message:', sendError);
    }
  }
}

module.exports = {
  processOrderInput,
  publishOrder,
  cancelOrder
};