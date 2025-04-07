// interaction/buttons/acceptOrder.js - Logic for order acceptance

const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ChannelType, 
  PermissionsBitField
} = require('discord.js');
const { activeCoders } = require('../../config/config');
const { orderDB, coderDB } = require('../../database');
const { createPrivateChannelEmbed, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const logger = require('../../utils/logger');
const { appearance } = require('../../config/config');

/**
 * Handles order acceptance by a coder
 * @param {Object} interaction - Discord interaction (button)
 * @param {String} orderId - Order identifier
 */
async function handleOrderAcceptance(interaction, orderId) {
  try {
    const coderId = interaction.user.id;
    
    // Log for debugging
    logger.info(`User ${coderId} attempting to accept order ${orderId}`);
    
    // Check if coder is already working on another project
    const coderData = await coderDB.findByUserId(coderId);
    if (coderData && coderData.activeorderid) {
      return interaction.reply({
        content: 'You are already working on another project. Finish it before accepting a new one.',
        ephemeral: true
      });
    }
    
    // Get the order from database with better error handling
    const order = await orderDB.findById(orderId);
    
    // Check if order exists
    if (!order) {
      logger.error(`Order with ID ${orderId} not found in database`);
      return interaction.reply({
        content: 'This order no longer exists or has already been taken.',
        ephemeral: true
      });
    }
    
    // Log for debugging
    logger.debug(`Order data retrieved for acceptance: ${JSON.stringify(order)}`);
    
    // Check if order is still open
    if (order.status !== 'OPEN') {
      return interaction.reply({
        content: 'This order is no longer available.',
        ephemeral: true
      });
    }
    
    // Update the order in the database
    await orderDB.updateStatus(orderId, 'ASSIGNED', coderId);
    logger.info(`Order ${orderId} status updated to ASSIGNED for coder ${coderId}`);
    
    // Update coder in database
    await coderDB.setActiveOrder(coderId, orderId);
    logger.info(`Coder ${coderId} now has active order ${orderId}`);
    
    // Add coder to active coders list in memory
    activeCoders.add(coderId);
    
    // Create private channel with all data
    const guild = interaction.guild;
    const privateChannel = await createPrivateChannel(guild, order, coderId);
    logger.info(`Created private channel ${privateChannel.id} for order ${orderId}`);
    
    // Send initial message in new channel
    await sendInitialMessage(privateChannel, order, coderId);
    
    // Reply to interaction
    await interaction.reply({
      content: `You have accepted the job! A private channel has been created: ${privateChannel}`,
      ephemeral: true
    });
    
    // Disable button in original message
    await updateOriginalMessage(interaction);
    
  } catch (error) {
    logger.error(`Error handling order acceptance for ID ${orderId}:`, error);
    await interaction.reply({
      content: 'An error occurred while accepting the order.',
      ephemeral: true
    });
  }
}

/**
 * Creates a private channel for the project
 * @param {Object} guild - Discord server
 * @param {Object} order - Order data
 * @param {String} coderId - Coder ID
 * @returns {Object} - The created channel
 */
async function createPrivateChannel(guild, order, coderId) {
  // ID of the main category where active project channels should be created
  const PROJECTS_CATEGORY_ID = '1351732830144561192';
  
  // Check if the category exists
  const category = guild.channels.cache.get(PROJECTS_CATEGORY_ID);
  if (!category) {
    logger.warn(`Project category with ID ${PROJECTS_CATEGORY_ID} not found. The channel will be created without a parent category.`);
  }
  
  return await guild.channels.create({
    name: `projet-${order.orderid}`,
    type: ChannelType.GuildText,
    parent: category ? category.id : null, // Set the parent category
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: coderId, // Coder
        allow: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: order.adminid, // Admin who posted
        allow: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: guild.client.user.id, // The bot
        allow: [PermissionsBitField.Flags.ViewChannel]
      }
    ]
  });
}

/**
 * Sends an initial message in the project channel
 * @param {Object} channel - Discord channel
 * @param {Object} order - Order data
 * @param {String} coderId - Coder ID
 */
async function sendInitialMessage(channel, order, coderId) {
  logger.debug(`Creating channel message with order: ${JSON.stringify(order)}`);
  
  // Create embed with order summary
  const { embed, row } = createPrivateChannelEmbed(order, coderId, appearance.logoUrl);
  const logoAttachment = getLogoAttachment();

  await channel.send({
    embeds: [embed],
    components: [row],
    files: [logoAttachment]
  });
  
  await channel.send(`Welcome to the project channel! <@${coderId}> and <@${order.adminid}>, you can communicate here about the work.`);
  
  // If a deadline is set, add a specific message
  if (order.deadline) {
    const deadlineDate = new Date(order.deadline);
    const discordTimestamp = Math.floor(deadlineDate.getTime() / 1000);
    
    await channel.send({
      content: `⚠️ **Reminder:** This project has a deadline set for <t:${discordTimestamp}:F> (<t:${discordTimestamp}:R>). Please plan your work accordingly.`
    });
  }
}

/**
 * Updates the original message to disable the button
 * @param {Object} interaction - Discord interaction
 */
async function updateOriginalMessage(interaction) {
  const originalRow = ActionRowBuilder.from(interaction.message.components[0]);
  const button = ButtonBuilder.from(originalRow.components[0]);
  button.setDisabled(true).setLabel('Work accepted');
  originalRow.setComponents(button);
  
  await interaction.message.edit({
    embeds: interaction.message.embeds,
    components: [originalRow]
  });
}

module.exports = {
  handleOrderAcceptance
}; 