// events/interactionCreate.js - Handler for interactions with Modal support

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const { publishOrder, cancelOrder } = require('../interaction/buttons/orderCreation');
const { handleVerificationRequest } = require('../interaction/buttons/requestVerification');
const { handleAdminCompletion } = require('../interaction/buttons/adminComplete');
const logger = require('../utils/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder } = require('discord.js');
const { PUBLISH_ORDERS_CHANNEL_ID } = require('../config/config');
const { orderDB } = require('../database');
const { createSidebarOrderEmbed, createNotification, getLogoAttachment } = require('../utils/modernEmbedBuilder');
const { appearance } = require('../config/config');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = client.slashCommands.get(interaction.commandName);
        
        if (!command) {
          logger.error(`Slash command not found: ${interaction.commandName}`);
          return interaction.reply({
            content: 'Cette commande n\'existe pas.',
            ephemeral: true
          });
        }
        
        try {
          logger.info(`Executing slash command: ${interaction.commandName}`);
          await command.execute(interaction, [], client);
        } catch (error) {
          logger.error(`Error executing slash command ${interaction.commandName}:`, error);
          
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
              content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: 'Une erreur est survenue lors de l\'exécution de cette commande.',
              ephemeral: true
            });
          }
        }
      }

      // Handler pour les soumissions de Modal
      else if (interaction.isModalSubmit()) {
        // Handle initial order details form submission
        if (interaction.customId.startsWith('create_order_details_')) {
          const userId = interaction.user.id;
          
          // Get values from the form
          const clientName = interaction.fields.getTextInputValue('clientName');
          const compensation = interaction.fields.getTextInputValue('compensation');
          const description = interaction.fields.getTextInputValue('description');
          
          // Process tags
          const tagsString = interaction.fields.getTextInputValue('tags') || '';
          const tags = tagsString.split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
          
          // Store these values in the session
          const orderSession = client.activeOrders.get(userId);
          if (orderSession) {
            orderSession.data = {
              clientName,
              compensation,
              description,
              tags,
              requiredRoles: []
            };
            orderSession.step = 'select_roles';
            
            // Acknowledge the modal submission
            await interaction.reply({
              content: 'Détails enregistrés! Maintenant, sélectionnez les rôles requis pour ce travail:',
              components: [
                new ActionRowBuilder().addComponents(
                  new RoleSelectMenuBuilder()
                    .setCustomId(`select_roles_${userId}`)
                    .setPlaceholder('Sélectionner des rôles (max 5)')
                    .setMinValues(0)
                    .setMaxValues(5)
                )
              ],
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: 'Une erreur est survenue: session de création perdue.',
              ephemeral: true
            });
          }
        }
        
        // Handle order confirmation modal
        else if (interaction.customId.startsWith('create_order_modal_')) {
          await handleOrderModalSubmit(interaction, client);
        }
      }
      
      // Handle button interactions
      else if (interaction.isButton()) {
        const customId = interaction.customId;
        
        try {
          // Ordre d'acceptation
          if (customId.startsWith('accept_order_')) {
            const orderId = customId.replace('accept_order_', '');
            await handleOrderAcceptance(interaction, orderId);
          }
          
          // Ordre de complétion
          else if (customId.startsWith('complete_order_')) {
            const orderId = customId.replace('complete_order_', '');
            await handleOrderCompletion(interaction, orderId);
          }
          
          // Handle verification request button
          else if (customId.startsWith('request_verification_')) {
            const orderId = customId.replace('request_verification_', '');
            await handleVerificationRequest(interaction, orderId);
          }
          
          // Handle admin completion button
          else if (customId.startsWith('admin_complete_')) {
            const orderId = customId.replace('admin_complete_', '');
            await handleAdminCompletion(interaction, orderId);
          }
          
          // Confirmation d'ordre - Ajout pour le nouveau système
          else if (customId.startsWith('confirm_modal_order_')) {
            const orderId = customId.replace('confirm_modal_order_', '');
            await publishModalOrder(interaction, orderId, client);
          }
          
          // Annulation d'ordre - Ajout pour le nouveau système
          else if (customId.startsWith('cancel_modal_order_')) {
            await cancelModalOrder(interaction, client);
          }
          
          // Confirmation d'ordre - ancienne méthode  
          else if (customId.startsWith('confirm_order_')) {
            // Cette partie est désormais gérée par le collector dans orderCreation.js
            // On ne fait rien ici, pour éviter une double manipulation
            
          }
          
          // Annulation d'ordre - ancienne méthode
          else if (customId.startsWith('cancel_order_')) {
            // Cette partie est désormais gérée par le collector dans orderCreation.js
            // On ne fait rien ici, pour éviter une double manipulation
          }
          
          // Boutons non reconnus
          else {
            logger.warn(`Unrecognized button customId: ${customId}`);
          }
        } catch (error) {
          logger.error(`Error handling button interaction (${customId}):`, error);
          
          try {
            // Si l'interaction est encore valide, répondre
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'Une erreur est survenue lors du traitement de cette interaction.',
                ephemeral: true
              });
            } else {
              // Sinon, envoyer dans le canal
              await interaction.channel.send('Une erreur est survenue lors du traitement de cette interaction.');
            }
          } catch (replyError) {
            logger.error('Error sending error response:', replyError);
          }
        }
      }
      
      // Handle select menu interactions
      else if (interaction.isSelectMenu()) {
        const customId = interaction.customId;
        
        try {
          // Handle order status updates
          if (customId.startsWith('order_status_')) {
            const orderId = customId.replace('order_status_', '');
            await handleOrderStatusUpdate(interaction, orderId);
          } else {
            logger.warn(`Unrecognized select menu customId: ${customId}`);
          }
        } catch (error) {
          logger.error(`Error handling select menu interaction (${customId}):`, error);
          
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: 'Une erreur est survenue lors du traitement de cette interaction.',
                ephemeral: true
              });
            } else {
              await interaction.channel.send('Une erreur est survenue lors du traitement de cette interaction.');
            }
          } catch (replyError) {
            logger.error('Error sending error response:', replyError);
          }
        }
      }

      // Handler for role selection menu
      else if (interaction.isRoleSelectMenu()) {
        if (interaction.customId.startsWith('select_roles_')) {
          const userId = interaction.user.id;
          const selectedRoleIds = interaction.values;
          
          // Get the order session
          const orderSession = client.activeOrders.get(userId);
          if (!orderSession) {
            return interaction.update({
              content: 'Une erreur est survenue: session de création perdue.',
              components: [],
              ephemeral: true
            });
          }
          
          // Convert selected role IDs to role objects with names
          const selectedRoles = selectedRoleIds.map(roleId => {
            const role = interaction.guild.roles.cache.get(roleId);
            return {
              id: roleId,
              name: role ? role.name : 'Unknown Role'
            };
          });
          
          // Store selected roles in session
          orderSession.data.requiredRoles = selectedRoles;
          orderSession.step = 'preview';
          
          // Generate a unique ID for this order
          const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
          orderSession.orderId = uniqueOrderId;
          
          // Create order data for preview
          const orderData = {
            orderid: uniqueOrderId,
            description: orderSession.data.description,
            compensation: orderSession.data.compensation,
            tags: orderSession.data.tags || [],
            requiredRoles: orderSession.data.requiredRoles || [],
            adminName: interaction.user.tag,
            adminid: interaction.user.id,
            clientName: orderSession.data.clientName
          };
          
          // Create preview embed
          const { embed, row } = createSidebarOrderEmbed(orderData);
          
          // Create confirmation buttons
          const actionRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`confirm_modal_order_${uniqueOrderId}`)
                .setLabel('Publier l\'offre')
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`cancel_modal_order_${uniqueOrderId}`)
                .setLabel('Annuler')
                .setStyle(ButtonStyle.Danger)
            );
          
          const logoAttachment = getLogoAttachment();
          
          // Show preview with confirmation buttons
          await interaction.update({
            content: 'Voici un aperçu de votre offre. Vérifiez les détails puis cliquez sur "Publier l\'offre" pour confirmer:',
            embeds: [embed],
            components: [actionRow],
            files: [logoAttachment],
            ephemeral: true
          });
        }
      }
    } catch (error) {
      logger.error('Error handling interaction:', error);
      
      // If the interaction hasn't been replied to already, send an error message
      if (!interaction.replied && !interaction.deferred) {
        try {
          const embed = createNotification(
            'Error Occurred',
            'An error occurred while processing your request.',
            'ERROR',
            appearance.logoUrl
          );
          await interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        } catch (replyError) {
          logger.error('Error sending error response:', replyError);
          try {
            await interaction.channel.send('Une erreur est survenue lors du traitement de cette interaction.');
          } catch (channelError) {
            logger.error('Failed to send error message to channel:', channelError);
          }
        }
      }
    }
  }
};

/**
 * Gère la soumission du Modal pour la création d'offre
 * @param {Object} interaction - Interaction Discord (modal submit)
 * @param {Object} client - Client Discord
 */
async function handleOrderModalSubmit(interaction, client) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    // Log the submission - this function is deprecated as we now use the two-step process
    logger.warn(`Using deprecated handleOrderModalSubmit for ${interaction.user.tag} - this should be migrated`);
    
    // Get values from the form
    const clientName = interaction.fields.getTextInputValue('clientName');
    const compensation = interaction.fields.getTextInputValue('compensation');
    const description = interaction.fields.getTextInputValue('description');
    
    // Process tags
    const tagsString = interaction.fields.getTextInputValue('tags') || '';
    const tags = tagsString.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    // Process required roles - try to get from the form if it exists
    let requiredRoles = [];
    try {
      if (interaction.fields.getTextInputValue('requiredRoles')) {
        const rolesString = interaction.fields.getTextInputValue('requiredRoles') || '';
        
        // Extract Discord role names/mentions
        requiredRoles = rolesString.split(',')
          .map(role => role.trim())
          .filter(role => role.length > 0)
          .map(role => {
            // If it's a role mention (@Role), clean to get just the name
            if (role.startsWith('@')) {
              return role.substring(1); // Remove the @ from the beginning
            }
            return role;
          });
        
        // Try to resolve mentioned role IDs
        if (requiredRoles.length > 0) {
          // Get all server roles
          const guildRoles = interaction.guild.roles.cache;
          
          // For each required role, try to find the corresponding Discord role
          requiredRoles = requiredRoles.map(roleName => {
            const role = guildRoles.find(r => 
              r.name.toLowerCase() === roleName.toLowerCase() || 
              r.id === roleName.replace(/[<@&>]/g, '')  // Handle Discord role mentions
            );
            
            if (role) {
              // Return an object with the role ID and name
              return {
                id: role.id,
                name: role.name
              };
            }
            
            // If role not found, keep the name as text
            return {
              id: null,
              name: roleName
            };
          });
        }
      }
    } catch (roleError) {
      logger.error('Error parsing required roles:', roleError);
      // In case of error, continue with an empty list
      requiredRoles = [];
    }
    
    // Generate a unique ID for this order
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create order data for preview
    const orderData = {
      orderid: uniqueOrderId,
      description: description,
      compensation: compensation,
      tags: tags,
      requiredRoles: requiredRoles,
      adminName: interaction.user.tag,
      adminid: interaction.user.id,
      clientName: clientName
    };
    
    // Create preview embed and components
    const { embed, row } = createSidebarOrderEmbed(orderData);
    
    // Create confirmation buttons
    const actionRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_modal_order_${uniqueOrderId}`)
          .setLabel('Publier l\'offre')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancel_modal_order_${uniqueOrderId}`)
          .setLabel('Annuler')
          .setStyle(ButtonStyle.Danger)
      );
    
    const logoAttachment = getLogoAttachment();
    
    // Store data in the active order session
    client.activeOrders.set(interaction.user.id, {
      orderId: uniqueOrderId,
      data: {
        clientName,
        compensation,
        description,
        tags,
        requiredRoles
      }
    });
    
    // Show preview with confirmation options
    await interaction.editReply({
      content: 'Voici un aperçu de votre offre. Vérifiez les détails puis cliquez sur "Publier l\'offre" pour confirmer:',
      embeds: [embed],
      components: [actionRow],
      files: [logoAttachment]
    });
    
    logger.info(`Legacy order form submitted by ${interaction.user.tag} - awaiting confirmation`);
    
  } catch (error) {
    logger.error('Error handling order modal submit:', error);
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'Une erreur est survenue lors du traitement du formulaire.',
        ephemeral: true
      });
    } else if (!interaction.replied) {
      await interaction.reply({
        content: 'Une erreur est survenue lors du traitement du formulaire.',
        ephemeral: true
      });
    }
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
    await interaction.deferUpdate();
    
    // Get order session data
    const orderSession = client.activeOrders.get(interaction.user.id);
    if (!orderSession) {
      return interaction.followUp({
        content: 'Erreur: Les données de l\'offre n\'ont pas été trouvées.',
        ephemeral: true
      });
    }
    
    // Prepare data for database
    const orderData = {
      orderId: orderId,
      adminId: interaction.user.id,
      data: {
        clientName: orderSession.data.clientName,
        compensation: orderSession.data.compensation,
        description: orderSession.data.description,
        tags: orderSession.data.tags || [],
        requiredRoles: orderSession.data.requiredRoles || []
      }
    };
    
    // Save to database
    try {
      await orderDB.create(orderData);
    } catch (dbError) {
      logger.error('Error creating order in database:', dbError);
      await interaction.followUp({
        content: `Une erreur est survenue lors de la création de l'offre dans la base de données: ${dbError.message}`,
        ephemeral: true
      });
      return;
    }
    
    // Create display data
    const displayOrderData = {
      orderid: orderId,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
      tags: orderSession.data.tags || [],
      requiredRoles: orderSession.data.requiredRoles || [],
      adminName: interaction.user.tag,
      adminid: interaction.user.id
    };
    
    // Create embed and components
    const { embed, row } = createSidebarOrderEmbed(displayOrderData);
    const logoAttachment = getLogoAttachment();
    
    // Get publish channel
    const publishChannel = client.channels.cache.get(PUBLISH_ORDERS_CHANNEL_ID);
    if (!publishChannel) {
      logger.error('Publish channel not found:', PUBLISH_ORDERS_CHANNEL_ID);
      await interaction.followUp({
        content: 'Erreur: Canal de publication introuvable.',
        ephemeral: true
      });
      return;
    }
    
    // Publish with role mentions
    try {
      // Prepare role mentions
      let rolesMentions = '';
      
      // Only mention roles if there are any selected
      if (orderSession.data.requiredRoles && orderSession.data.requiredRoles.length > 0) {
        // Each role already has an ID from the role selector
        orderSession.data.requiredRoles.forEach(role => {
          if (role.id) {
            rolesMentions += `<@&${role.id}> `;
          }
        });
      }
      
      // Create notification message with role mentions
      const notificationMessage = rolesMentions 
        ? `${rolesMentions}\n**📢 Nouvelle opportunité de travail disponible pour vos compétences!**`
        : '**📢 Nouvelle opportunité de travail disponible!**';
      
      // Send to channel
      const publishedMessage = await publishChannel.send({
        content: notificationMessage,
        embeds: [embed],
        components: [row],
        files: [logoAttachment],
        allowedMentions: { roles: orderSession.data.requiredRoles.map(r => r.id).filter(Boolean) }
      });
      
      // Update order with message ID
      await orderDB.updateMessageId(orderId, publishedMessage.id);
    } catch (publishError) {
      logger.error('Error publishing order to channel:', publishError);
      await interaction.followUp({
        content: 'Une erreur est survenue lors de la publication de l\'offre.',
        ephemeral: true
      });
      return;
    }
    
    // Update reply message
    await interaction.editReply({
      content: `✅ Offre #${orderId} publiée avec succès dans <#${PUBLISH_ORDERS_CHANNEL_ID}>.`,
      embeds: [],
      components: [],
      files: []
    });
    
    // Clean up
    client.activeOrders.delete(interaction.user.id);
    logger.info(`Order ${orderId} published by ${interaction.user.tag}`);
    
  } catch (error) {
    logger.error('Error publishing modal order:', error);
    try {
      await interaction.followUp({
        content: 'Une erreur est survenue lors de la publication de l\'offre.',
        ephemeral: true
      });
    } catch (followupError) {
      logger.error('Failed to send error followup:', followupError);
    }
  }
}

/**
 * Annule la création d'offre via modal
 * @param {Object} interaction - Interaction Discord (button)
 * @param {Object} client - Discord client
 */
async function cancelModalOrder(interaction, client) {
  try {
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Update the message without embeds or files (logo)
    await interaction.update({
      content: '❌ Création d\'offre annulée.',
      embeds: [],
      components: [],
      files: [] // This explicitly removes any files (including the logo)
    });
    
    logger.info(`Order creation cancelled by ${interaction.user.tag}`);
    
  } catch (error) {
    logger.error('Error cancelling modal order:', error);
    try {
      if (!interaction.replied) {
        await interaction.update({
          content: 'Une erreur est survenue lors de l\'annulation de l\'offre.',
          embeds: [],
          components: [],
          files: [] // Also remove files in error case
        });
      }
    } catch (followupError) {
      logger.error('Failed to send error followup:', followupError);
    }
  }
}