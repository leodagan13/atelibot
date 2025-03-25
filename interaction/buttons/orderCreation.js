// interaction/buttons/orderCreation.js - Updated to support level-based channel publishing

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { PUBLISH_ORDERS_CHANNEL_ID, LEVEL_CHANNELS } = require('../../config/config');
const logger = require('../../utils/logger');
const { createSidebarOrderEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');
const path = require('path');

// Stockage temporaire des commandes en cours de confirmation
const pendingConfirmations = new Map();

/**
 * Get the appropriate channel ID for an order based on its level
 * @param {number} level - Order difficulty level (1-6)
 * @param {Object} client - Discord client
 * @returns {string} - Channel ID to publish to
 */
function getPublishChannelId(level, client) {
  // Default to the main publish channel if no level is provided
  if (!level) return PUBLISH_ORDERS_CHANNEL_ID;
  
  // Get the channel ID from the mapping
  const channelId = LEVEL_CHANNELS[level] || PUBLISH_ORDERS_CHANNEL_ID;
  
  // Verify the channel exists
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    logger.warn(`Channel for level ${level} (ID: ${channelId}) not found. Using default channel.`);
    return PUBLISH_ORDERS_CHANNEL_ID;
  }
  
  return channelId;
}

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
    
    // Create the order data structure for the embed
    const orderData = {
      orderid: `PREVIEW-${confirmationId}`,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
      tags: orderSession.data.tags || [],
      adminName: message.author.tag,
      level: orderSession.data.level || 1 // Default to level 1 if not set
    };
    
    // Create embed with order summary
    const { embed, row } = createSidebarOrderEmbed(orderData);
    
    // Modify the row to use our confirmation IDs
    const modifiedRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_order_${confirmationId}`)
          .setLabel('Publier l\'offre')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`cancel_order_${confirmationId}`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
    
    const logoAttachment = getLogoAttachment();
    
    // Stocker les données de l'ordre pour la confirmation
    pendingConfirmations.set(confirmationId, {
      userId: message.author.id,
      orderSession: orderSession,
      channel: message.channel
    });
    
    // Send summary
    const summaryMessage = await message.reply({
      embeds: [embed],
      components: [modifiedRow],
      files: [logoAttachment]
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
      description: orderData.data.description,
      level: orderData.data.level || 1
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
    const { embed, row } = createSidebarOrderEmbed({
      ...orderData,
      orderid: uniqueOrderId,
      description: orderData.data.description,
      compensation: orderData.data.compensation,
      tags: orderData.data.tags || [],
      adminName: interaction.user.tag,
      level: orderData.data.level || 1
    });
    
    const logoAttachment = getLogoAttachment();
    
    logger.debug(`Publishing order with data: ${JSON.stringify(orderData)}`);

    // Get the appropriate publish channel based on level
    const level = orderData.data.level || 1;
    const publishChannelId = getPublishChannelId(level, client);
    const publishChannel = client.channels.cache.get(publishChannelId);
    
    if (!publishChannel) {
      logger.error(`Publish channel for level ${level} not found:`, publishChannelId);
      await channel.send(`Erreur: Canal de publication pour le niveau ${level} introuvable.`);
      return;
    }
    
    // Publish the order
    try {
      const publishedMessage = await publishChannel.send({
        content: `**📢 Nouvelle opportunité de travail disponible! (Niveau ${level})**`,
        embeds: [embed],
        components: [row],
        files: [logoAttachment]
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
    
    // Notify success with specific channel mention
    await channel.send(`✅ Offre #${uniqueOrderId} (Niveau ${level}) publiée avec succès dans <#${publishChannelId}>.`);
    
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

/**
 * Publie l'offre créée via modal
 * @param {Object} interaction - Interaction Discord (button)
 * @param {String} orderId - ID de l'offre
 * @param {Object} client - Client Discord
 */
async function publishModalOrder(interaction, orderId, client) {
  try {
    const orderSession = client.activeOrders.get(interaction.user.id);
    if (!orderSession) {
      return interaction.reply({
        content: 'Session de création d\'offre expirée ou invalide.',
        ephemeral: true
      });
    }

    // Create the order data structure for display
    const displayOrderData = {
      orderid: orderId,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
      tags: orderSession.data.tags || [],
      requiredRoles: orderSession.data.requiredRoles || [],
      adminName: interaction.user.tag,
      adminid: interaction.user.id,
      deadline: orderSession.data.deadline || null,
      status: 'OPEN',
      level: orderSession.data.level || 1
    };

    // Create embed for the order
    const { embed, row } = createSidebarOrderEmbed(displayOrderData);
    const logoAttachment = getLogoAttachment();

    // Get the appropriate publish channel based on level
    const level = orderSession.data.level || 1;
    const publishChannelId = getPublishChannelId(level, client);
    
    const publishChannel = client.channels.cache.get(publishChannelId);
    if (!publishChannel) {
      logger.error(`Publish channel for level ${level} not found:`, publishChannelId);
      return interaction.reply({
        content: `Erreur: Canal de publication pour le niveau ${level} introuvable.`,
        ephemeral: true
      });
    }

    // Publish the order
    const publishedMessage = await publishChannel.send({
      content: `**📢 Nouvelle opportunité de travail disponible! (Niveau ${level})**`,
      embeds: [embed],
      components: [row],
      files: [logoAttachment]
    });

    // Update the order with the message ID
    await orderDB.updateMessageId(orderId, publishedMessage.id);

    // Clear the active order
    client.activeOrders.delete(interaction.user.id);

    // Notify success with specific channel mention
    return interaction.reply({
      content: `✅ Offre #${orderId} (Niveau ${level}) publiée avec succès dans <#${publishChannelId}>.`,
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error publishing modal order:', error);
    return interaction.reply({
      content: 'Une erreur est survenue lors de la publication de l\'offre.',
      ephemeral: true
    });
  }
}

module.exports = {
  processOrderInput,
  publishModalOrder,
  processOrderCancellation,
  publishOrder: publishModalOrder, // For compatibility with existing code
  cancelOrder: processOrderCancellation, // For compatibility with existing code
  getPublishChannelId // Expose the function for use elsewhere
};