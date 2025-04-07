// interaction/buttons/orderCreation.js - Updated to support level-based channel publishing

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { orderDB } = require('../../database');
const { PUBLISH_ORDERS_CHANNEL_ID, LEVEL_CHANNELS } = require('../../config/config');
const logger = require('../../utils/logger');
const { createSidebarOrderEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');
const path = require('path');

// Temporary storage for orders pending confirmation
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
        await message.reply(`Client registered: **${message.content}**`);
        await message.channel.send('**Step 2/3**: What is the compensation for this work?');
        break;
        
      case 1: // Compensation
        orderSession.data.compensation = message.content;
        orderSession.step = 2;
        await message.reply(`Compensation registered: **${message.content}**`);
        await message.channel.send('**Step 3/3**: Please provide a detailed description of the work.');
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
    await message.reply('An error occurred while processing your response.');
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
    // Generate a unique ID for this confirmation
    const confirmationId = Math.random().toString(36).substring(2, 10);
    
    // Create the order data structure for the embed
    const orderData = {
      orderid: `PREVIEW-${confirmationId}`,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
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
          .setLabel('Publish Offer')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`cancel_order_${confirmationId}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
    
    const logoAttachment = getLogoAttachment();
    
    // Store order data for confirmation
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
        // Respond immediately to avoid timeout
        await interaction.deferUpdate();
        
        // Get confirmation data
        const confirmationData = pendingConfirmations.get(confirmationId);
        
        if (!confirmationData) {
          await interaction.channel.send('Error: confirmation data not found.');
          return;
        }
        
        // Update message to indicate processing
        await summaryMessage.edit({
          content: 'Processing...',
          embeds: [embed],
          components: []
        });
        
        if (interaction.customId === `confirm_order_${confirmationId}`) {
          await processOrderConfirmation(interaction, confirmationData, client);
        } else {
          await processOrderCancellation(interaction, confirmationData, client);
        }
        
        // Remove confirmation data
        pendingConfirmations.delete(confirmationId);
        
      } catch (error) {
        logger.error('Error handling button interaction:', error);
        try {
          await interaction.channel.send('An error occurred while processing your action.');
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
            content: 'The order creation session has expired.',
            embeds: [embed],
            components: []
          });
        }
      }
    });
    
  } catch (error) {
    logger.error('Error showing order summary:', error);
    await message.reply('An error occurred while displaying the order summary.');
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
    
    // Generate a unique ID for the order
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create the order data
    const orderData = {
      orderId: uniqueOrderId,
      adminId: userId,
      data: orderSession.data
    };
    
    // Log for debugging
    logger.debug("Order data:", orderSession);
    logger.debug("Data to insert:", {
      orderId: orderData.orderId,
      adminId: orderData.adminId,
      clientName: orderData.data.clientName,
      compensation: orderData.data.compensation,
      description: orderData.data.description,
      level: orderData.data.level || 1
    });
    
    // Try to create the order
    try {
      await orderDB.create(orderData);
    } catch (dbError) {
      logger.error('Error creating order:', dbError);
      await channel.send(`An error occurred while creating the order in the database: ${dbError.message}`);
      
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
      await channel.send(`Error: Publish channel for level ${level} not found.`);
      return;
    }
    
    // Publish the order
    try {
      const publishedMessage = await publishChannel.send({
        content: `**📢 New work opportunity available! (Level ${level})**`,
        embeds: [embed],
        components: [row],
        files: [logoAttachment]
      });
      
      // Update the order with the message ID
      await orderDB.updateMessageId(uniqueOrderId, publishedMessage.id);
    } catch (publishError) {
      logger.error('Error publishing order to channel:', publishError);
      await channel.send('An error occurred while publishing the order to the channel.');
      return;
    }
    
    // Clear the active order
    client.activeOrders.delete(userId);
    
    // Notify success with specific channel mention
    await channel.send(`✅ Order #${uniqueOrderId} (Level ${level}) successfully published in <#${publishChannelId}>.`);
    
  } catch (error) {
    logger.error('Error processing order confirmation:', error);
    const { channel } = confirmationData;
    await channel.send(`An error occurred while processing the confirmation: ${error.message}`);
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
    await channel.send('❌ Order creation cancelled.');
    
  } catch (error) {
    logger.error('Error processing order cancellation:', error);
    const { channel } = confirmationData;
    await channel.send(`An error occurred while cancelling: ${error.message}`);
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
    // Defer update immediately
    await interaction.deferUpdate();
    
    const orderSession = client.activeOrders.get(interaction.user.id);
    if (!orderSession) {
      return interaction.editReply({
        content: 'Order creation session expired or invalid.',
        embeds: [],
        components: [],
        files: []
      });
    }

    // Create the order data structure
    const orderData = {
      orderId: orderId,
      adminId: interaction.user.id,
      data: {
        clientName: orderSession.data.clientName,
        compensation: orderSession.data.compensation,
        description: orderSession.data.description,
        requiredRoles: orderSession.data.requiredRoles || [],
        deadline: orderSession.data.deadline || null,
        level: orderSession.data.level || 1
      }
    };

    // Log for debugging
    logger.debug(`Creating order with data: ${JSON.stringify(orderData)}`);

    // Create the order in database with detailed error handling
    let createdOrder;
    try {
      createdOrder = await orderDB.create(orderData);
      
      if (!createdOrder) {
        throw new Error('Order creation returned null');
      }
      
      logger.info(`Successfully created order: ${JSON.stringify(createdOrder)}`);
    } catch (dbError) {
      logger.error('Database error creating order:', dbError);
      return interaction.editReply({
        content: `Database error while creating the order: ${dbError.message}`,
        embeds: [],
        components: [],
        files: []
      });
    }

    // Create embed for display
    const displayOrderData = {
      orderid: orderId,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
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

    // Get publish channel
    const level = orderSession.data.level || 1;
    const publishChannelId = getPublishChannelId(level, client);
    
    const publishChannel = client.channels.cache.get(publishChannelId);
    if (!publishChannel) {
      logger.error(`Publish channel for level ${level} not found:`, publishChannelId);
      
      // Make sure to clean up the session before returning with an error
      client.activeOrders.delete(interaction.user.id);
      
      return interaction.editReply({
        content: `Error: Publish channel for level ${level} not found.`,
        embeds: [],
        components: [],
        files: []
      });
    }

    // Publish the order
    let publishedMessage;
    try {
      publishedMessage = await publishChannel.send({
        content: `**📢 New work opportunity available! (Level ${level})**`,
        embeds: [embed],
        components: [row],
        files: [logoAttachment]
      });
    } catch (publishError) {
      logger.error('Error publishing message to channel:', publishError);
      
      // Clean up session before returning
      client.activeOrders.delete(interaction.user.id);
      
      return interaction.editReply({
        content: `Error publishing to channel: ${publishError.message}`,
        embeds: [],
        components: [],
        files: []
      });
    }

    // Update the order with the message ID
    try {
      await orderDB.updateMessageId(orderId, publishedMessage.id);
      logger.info(`Updated order ${orderId} with message ID ${publishedMessage.id}`);
    } catch (updateError) {
      logger.error(`Failed to update order with message ID:`, updateError);
      // Continue anyway since the order is created
    }

    // Clear the active order BEFORE sending the final reply to avoid race conditions
    client.activeOrders.delete(interaction.user.id);

    // Update the interaction
    return interaction.editReply({
      content: `✅ Order #${orderId} (Level ${level}) successfully published in <#${publishChannelId}>.`,
      embeds: [],
      components: [],
      files: []
    });

  } catch (error) {
    logger.error('Error publishing modal order:', error);
    
    // Always clean up the session in case of error
    if (interaction.user?.id) {
      client.activeOrders.delete(interaction.user.id);
    }
    
    return interaction.editReply({
      content: 'An error occurred while publishing the order.',
      embeds: [],
      components: [],
      files: []
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