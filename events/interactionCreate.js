// events/interactionCreate.js - Handler for interactions with Modal support

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const { publishOrder, cancelOrder } = require('../interaction/buttons/orderCreation');
const { handleVerificationRequest } = require('../interaction/buttons/requestVerification');
const { handleAdminCompletion } = require('../interaction/buttons/adminComplete');
const logger = require('../utils/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
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
          
          // Process deadline
          let deadline = null;
          try {
            const deadlineString = interaction.fields.getTextInputValue('deadline') || '';
            if (deadlineString.trim()) {
              // Validate deadline format (basic validation)
              if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineString.trim())) {
                deadline = new Date(deadlineString.trim());
                
                // Check if it's a valid date
                if (isNaN(deadline.getTime())) {
                  logger.warn(`Invalid date for deadline: ${deadlineString}`);
                } else {
                  // Valid date, format as ISO string
                  deadline = deadline.toISOString();
                  logger.info(`Valid deadline parsed: ${deadline}`);
                }
              } else {
                logger.warn(`Invalid deadline format: ${deadlineString}`);
              }
            }
          } catch (dateError) {
            logger.warn(`Error processing deadline: ${dateError.message}`);
          }
          
          // Store these values in the session
          const orderSession = client.activeOrders.get(userId);
          if (orderSession) {
            orderSession.data = {
              clientName,
              compensation,
              description,
              tags,
              deadline,
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
          orderSession.step = 'select_level';
          
          // Vérifier si l'utilisateur est un super administrateur
          const isSuperAdmin = interaction.member.id === "1351725292741197976";
          
          // Créer la sélection de niveau
          const levelSelectRow = new ActionRowBuilder()
            .addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`select_level_${userId}`)
                .setPlaceholder('Sélectionner le niveau de difficulté')
                .addOptions([
                  { label: 'Niveau 1 - Facile', value: '1', emoji: '🟩', description: 'Projet simple pour débutants' },
                  { label: 'Niveau 2 - Débutant', value: '2', emoji: '🟨', description: 'Quelques connaissances requises' },
                  { label: 'Niveau 3 - Intermédiaire', value: '3', emoji: '🟧', description: 'Difficulté moyenne' },
                  { label: 'Niveau 4 - Avancé', value: '4', emoji: '🟥', description: 'Projet complexe' },
                  { label: 'Niveau 5 - Expert', value: '5', emoji: '🔴', description: 'Expertise requise' },
                  // Niveau 6 uniquement pour super admin
                  ...(isSuperAdmin ? [
                    { label: 'Niveau 6 - Super Expert', value: '6', emoji: '⚫', description: 'Réservé aux projets exceptionnels' }
                  ] : [])
                ])
            );
          
          // Afficher la sélection de niveau
          await interaction.update({
            content: 'Maintenant, sélectionnez le niveau de difficulté de ce projet:',
            components: [levelSelectRow],
            ephemeral: true
          });
        }
      }

      // Handle string select menu interactions
      else if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;
        
        try {
          // Handle order status updates
          if (customId.startsWith('order_status_')) {
            const orderId = customId.replace('order_status_', '');
            await handleOrderStatusUpdate(interaction, orderId);
          } 
          // Handle level selection
          else if (customId.startsWith('select_level_')) {
            const userId = customId.replace('select_level_', '');
            const selectedLevel = interaction.values[0];
            
            // Get the order session
            const orderSession = client.activeOrders.get(userId);
            if (!orderSession) {
              return interaction.update({
                content: 'Une erreur est survenue: session de création perdue.',
                components: [],
                ephemeral: true
              });
            }
            
            // Valider que le niveau 6 est sélectionné uniquement par un super admin
            if (selectedLevel === '6' && interaction.user.id !== "1351725292741197976") {
              return interaction.update({
                content: "⚠️ Seul un super administrateur peut créer un projet de niveau 6. Veuillez sélectionner un niveau entre 1 et 5.",
                components: [interaction.message.components[0]],
                ephemeral: true
              });
            }
            
            // Store selected level in session
            orderSession.data.level = parseInt(selectedLevel);
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
              clientName: orderSession.data.clientName,
              deadline: orderSession.data.deadline,
              level: orderSession.data.level
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
          } else {
            logger.warn(`Unrecognized string select menu customId: ${customId}`);
          }
        } catch (error) {
          logger.error(`Error handling string select menu interaction (${customId}):`, error);
          
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
    
    // Get values from modal
    const clientName = interaction.fields.getTextInputValue('clientName');
    const compensation = interaction.fields.getTextInputValue('compensation');
    const description = interaction.fields.getTextInputValue('description');
    const tagsInput = interaction.fields.getTextInputValue('tags');
    const levelInput = interaction.fields.getTextInputValue('level') || '1';
    
    // Process level - validate it's between 1-6
    let level = 1;
    if (levelInput && !isNaN(parseInt(levelInput))) {
      level = Math.min(Math.max(parseInt(levelInput), 1), 6);
    }
    
    // Vérification pour le niveau 6 - seul un super administrateur peut créer un projet niveau 6
    const SUPER_ADMIN_ID = "1351725292741197976";
    if (level === 6 && interaction.member.id !== SUPER_ADMIN_ID) {
      // Si l'utilisateur n'est pas un super admin et tente de créer un projet niveau 6,
      // on limite à 5 et on l'informe
      level = 5;
      await interaction.followUp({
        content: "⚠️ Seul un super administrateur peut créer un projet de niveau 6. Le niveau a été ajusté à 5.",
        ephemeral: true
      });
    }
    
    // Process tags
    const tags = tagsInput.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
      
    // Process required roles
    const requiredRolesInput = interaction.fields.getTextInputValue('requiredRoles');
    let requiredRoles = [];
    
    try {
      if (requiredRolesInput.trim()) {
        requiredRoles = requiredRolesInput.split(',')
          .map(role => role.trim())
          .filter(role => role.length > 0)
          .map(role => {
            // Remove @ if present
            const roleName = role.startsWith('@') ? role.substring(1) : role;
            // Try to find role in guild
            const guildRole = interaction.guild.roles.cache.find(r => r.name === roleName);
            return {
              name: roleName,
              id: guildRole ? guildRole.id : null
            };
          });
      }
    } catch (roleError) {
      logger.error('Error processing required roles:', roleError);
      requiredRoles = [];
    }
    
    // Process deadline
    let deadline = null;
    try {
      const deadlineString = interaction.fields.getTextInputValue('deadline') || '';
      if (deadlineString.trim()) {
        // Validate deadline format (basic validation)
        if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineString.trim())) {
          deadline = new Date(deadlineString.trim());
          
          // Check if it's a valid date
          if (isNaN(deadline.getTime())) {
            throw new Error('Invalid date');
          }
          
          logger.debug(`Valid deadline parsed: ${deadline.toISOString()}`);
        } else {
          throw new Error('Format incorrect');
        }
      }
    } catch (dateError) {
      logger.warn(`Invalid deadline format: ${interaction.fields.getTextInputValue('deadline')}`);
      // On continue sans deadline en cas d'erreur
      deadline = null;
    }
    
    // Generate unique order ID
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
      clientName: clientName,
      deadline: deadline ? deadline.toISOString() : null,
      level: level
    };
    
    // Create embed for preview
    const { embed, row } = createSidebarOrderEmbed(orderData);
    const logoAttachment = getLogoAttachment();
    
    // Store order data temporarily
    client.activeOrders.set(interaction.user.id, {
      step: 'preview',
      data: {
        clientName,
        compensation,
        description,
        tags,
        requiredRoles,
        deadline: deadline ? deadline.toISOString() : null,
        level: level
      },
      channelId: interaction.channelId
    });
    
    // Send preview with buttons
    await interaction.editReply({
      content: 'Voici un aperçu de votre offre. Vérifiez les détails et confirmez la publication.',
      embeds: [embed],
      components: [row],
      files: [logoAttachment]
    });
    
  } catch (error) {
    logger.error('Error handling order modal submit:', error);
    if (!interaction.replied) {
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
    const orderSession = client.activeOrders.get(interaction.user.id);
    if (!orderSession) {
      return interaction.reply({
        content: 'Session de création d\'offre expirée ou invalide.',
        ephemeral: true
      });
    }
    
    // Dernière vérification de sécurité pour le niveau 6
    if (orderSession.data.level === 6 && interaction.user.id !== "1351725292741197976") {
      orderSession.data.level = 5; // Limiter à 5 si ce n'est pas un super admin
      await interaction.channel.send({
        content: "⚠️ Le niveau a été ajusté à 5 car seul un super administrateur peut créer un projet de niveau 6.",
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
        requiredRoles: orderSession.data.requiredRoles || [],
        deadline: orderSession.data.deadline,
        level: orderSession.data.level || 1 // Assurer qu'il y a toujours un niveau
      }
    };
    
    // Create the order in database
    await orderDB.create(orderData);
    
    // Create display data for embed
    const displayOrderData = {
      orderid: orderId,
      description: orderSession.data.description,
      compensation: orderSession.data.compensation,
      tags: orderSession.data.tags || [],
      requiredRoles: orderSession.data.requiredRoles || [],
      adminName: interaction.user.tag,
      adminid: interaction.user.id,
      deadline: orderSession.data.deadline,
      level: orderSession.data.level || 1,
      status: 'OPEN'
    };
    
    // Create embed for the order
    const { embed, row } = createSidebarOrderEmbed(displayOrderData);
    const logoAttachment = getLogoAttachment();
    
    // Get the publish channel
    const publishChannel = client.channels.cache.get(PUBLISH_ORDERS_CHANNEL_ID);
    if (!publishChannel) {
      logger.error('Publish channel not found:', PUBLISH_ORDERS_CHANNEL_ID);
      return interaction.reply({
        content: 'Erreur: Canal de publication introuvable.',
        ephemeral: true
      });
    }
    
    // Publish the order
    const publishedMessage = await publishChannel.send({
      content: '**📢 Nouvelle opportunité de travail disponible!**',
      embeds: [embed],
      components: [row],
      files: [logoAttachment]
    });
    
    // Update the order with the message ID
    await orderDB.updateMessageId(orderId, publishedMessage.id);
    
    // Clear the active order
    client.activeOrders.delete(interaction.user.id);
    
    // Notify success
    return interaction.reply({
      content: `✅ Offre #${orderId} publiée avec succès dans <#${PUBLISH_ORDERS_CHANNEL_ID}>.`,
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