// events/interactionCreate.js - Handler for interactions with Modal support

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const { publishOrder, cancelOrder } = require('../interaction/buttons/orderCreation');
const { handleVerificationRequest } = require('../interaction/buttons/requestVerification');
const { handleAdminCompletion } = require('../interaction/buttons/adminComplete');
const logger = require('../utils/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
        // Traitement spécifique pour le modal de création d'offre
        if (interaction.customId.startsWith('create_order_modal_')) {
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
            await cancelModalOrder(interaction);
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
    await interaction.deferReply();
    
    // Récupérer les valeurs du formulaire
    const clientName = interaction.fields.getTextInputValue('clientName');
    const compensation = interaction.fields.getTextInputValue('compensation');
    const description = interaction.fields.getTextInputValue('description');
    
    // Récupérer et traiter les tags
    const tagsString = interaction.fields.getTextInputValue('tags') || '';
    const tags = tagsString.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    // Récupérer et traiter les rôles requis
    let requiredRoles = [];
    try {
      const rolesString = interaction.fields.getTextInputValue('requiredRoles') || '';
      
      // Extraire les noms/mentions de rôles Discord
      requiredRoles = rolesString.split(',')
        .map(role => role.trim())
        .filter(role => role.length > 0)
        .map(role => {
          // Si c'est une mention de rôle (@Role), nettoyer pour obtenir juste le nom
          if (role.startsWith('@')) {
            return role.substring(1); // Enlever le @ du début
          }
          return role;
        });
      
      // Tenter de résoudre les IDs des rôles mentionnés
      if (requiredRoles.length > 0) {
        // Récupérer tous les rôles du serveur
        const guildRoles = interaction.guild.roles.cache;
        
        // Pour chaque rôle requis, essayer de trouver le rôle Discord correspondant
        requiredRoles = requiredRoles.map(roleName => {
          const role = guildRoles.find(r => 
            r.name.toLowerCase() === roleName.toLowerCase() || 
            r.id === roleName.replace(/[<@&>]/g, '')  // Gère les mentions de rôle Discord
          );
          
          if (role) {
            // Retourner un objet avec l'ID et le nom du rôle
            return {
              id: role.id,
              name: role.name
            };
          }
          
          // Si le rôle n'est pas trouvé, conserver le nom comme texte
          return {
            id: null,
            name: roleName
          };
        });
      }
    } catch (roleError) {
      logger.error('Error parsing required roles:', roleError);
      // En cas d'erreur, continuer avec une liste vide
      requiredRoles = [];
    }
    
    // Générer un ID unique pour cette commande
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Create order data structure
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
    
    // Create the embed and buttons
    const { embed, row } = createSidebarOrderEmbed(orderData);
    
    // Modify row to include our specific button IDs
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
    
    // Stocker les données temporairement dans l'ordre actif
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
    
    // Répondre avec la prévisualisation
    await interaction.editReply({
      embeds: [embed],
      components: [actionRow],
      files: [logoAttachment]
    });
    
    logger.info(`Order form submitted by ${interaction.user.tag} - awaiting confirmation`);
    
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
    
    // Récupérer les données de l'offre stockées temporairement
    const orderSession = client.activeOrders.get(interaction.user.id);
    if (!orderSession) {
      return interaction.followUp({
        content: 'Erreur: Les données de l\'offre n\'ont pas été trouvées.',
        ephemeral: true
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
        tags: orderSession.data.tags || [],
        requiredRoles: orderSession.data.requiredRoles || []
      }
    };
    
    // Store in database
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
    
    // Create the order embed for display
    const displayOrderData = {
      orderid: orderId,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
      tags: orderSession.data.tags || [],
      requiredRoles: orderSession.data.requiredRoles || [],
      adminName: interaction.user.tag,
      adminid: interaction.user.id
    };
    
    // Create embed for the order
    const { embed, row } = createSidebarOrderEmbed(displayOrderData);
    const logoAttachment = getLogoAttachment();
    
    // Récupérer le canal de publication
    const publishChannel = client.channels.cache.get(PUBLISH_ORDERS_CHANNEL_ID);
    if (!publishChannel) {
      logger.error('Publish channel not found:', PUBLISH_ORDERS_CHANNEL_ID);
      await interaction.followUp({
        content: 'Erreur: Canal de publication introuvable.',
        ephemeral: true
      });
      return;
    }
    
    // Publier l'offre avec pings pour les rôles
    try {
      // Récupérer les mentions de rôles à inclure dans le message
      let rolesMentions = '';
      if (orderSession.data.requiredRoles && orderSession.data.requiredRoles.length > 0) {
        // Filtrer pour ne garder que les rôles avec un ID valide
        const validRoles = orderSession.data.requiredRoles.filter(role => role.id);
        
        // Créer les mentions de rôles (max 5 rôles pour éviter le spam)
        const maxRoles = Math.min(validRoles.length, 5);
        for (let i = 0; i < maxRoles; i++) {
          rolesMentions += `<@&${validRoles[i].id}> `;
        }
      }
      
      // Message de notification avec mentions de rôles si disponibles
      const notificationMessage = rolesMentions 
        ? `${rolesMentions}\n**📢 Nouvelle opportunité de travail disponible pour vos compétences!**`
        : '**📢 Nouvelle opportunité de travail disponible!**';
      
      const publishedMessage = await publishChannel.send({
        content: notificationMessage,
        embeds: [embed],
        components: [row],
        files: [logoAttachment]
      });
      
      // Update the order with the message ID
      await orderDB.updateMessageId(orderId, publishedMessage.id);
    } catch (publishError) {
      logger.error('Error publishing order to channel:', publishError);
      await interaction.followUp({
        content: 'Une erreur est survenue lors de la publication de l\'offre.',
        ephemeral: true
      });
      return;
    }
    
    // Modifier le message original
    await interaction.editReply({
      content: `✅ Offre #${orderId} publiée avec succès dans <#${PUBLISH_ORDERS_CHANNEL_ID}>.`,
      embeds: [],
      components: []
    });
    
    // Clear the active order
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
 */
async function cancelModalOrder(interaction) {
  try {
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Mise à jour du message
    await interaction.update({
      content: '❌ Création d\'offre annulée.',
      embeds: [],
      components: []
    });
    
    logger.info(`Order creation cancelled by ${interaction.user.tag}`);
    
  } catch (error) {
    logger.error('Error cancelling modal order:', error);
    try {
      await interaction.followUp({
        content: 'Une erreur est survenue lors de l\'annulation de l\'offre.',
        ephemeral: true
      });
    } catch (followupError) {
      logger.error('Failed to send error followup:', followupError);
    }
  }
}