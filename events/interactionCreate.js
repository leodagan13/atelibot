// events/interactionCreate.js - Handler for interactions with Modal support

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const { publishOrder, cancelOrder } = require('../interaction/buttons/orderCreation');
const logger = require('../utils/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { PUBLISH_ORDERS_CHANNEL_ID } = require('../config/config');
const { orderDB } = require('../database');

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
          await interaction.reply({
            content: 'Une erreur est survenue lors du traitement de cette interaction.',
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
    
    // Générer un ID unique pour cette commande
    const uniqueOrderId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).substring(2, 8)}`;
    
    // Créer l'embed de prévisualisation
    const previewEmbed = new EmbedBuilder()
      .setColor('#3498db')
      .setTitle('Prévisualisation de l\'offre')
      .setDescription('Voici un aperçu de l\'offre. Veuillez confirmer ou annuler.')
      .addFields(
        { name: 'Client', value: clientName, inline: true },
        { name: 'Rémunération', value: compensation, inline: true },
        { name: 'ID', value: uniqueOrderId, inline: true },
        { name: 'Description', value: description }
      )
      .setFooter({ text: `Proposé par ${interaction.user.tag}` })
      .setTimestamp();
    
    // Ajouter les tags à la prévisualisation s'il y en a
    const tagsFormatted = tags.length > 0 
      ? tags.map(tag => `🔴 \`${tag}\``).join('\n')
      : 'Aucun tag';
    
    previewEmbed.addFields({ name: 'Mandatory', value: tagsFormatted });
    
    // Buttons pour confirmer ou annuler
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
    
    // Stocker les données temporairement dans l'ordre actif
    client.activeOrders.set(interaction.user.id, {
      orderId: uniqueOrderId,
      data: {
        clientName,
        compensation,
        description,
        tags
      }
    });
    
    // Répondre avec la prévisualisation
    await interaction.editReply({
      embeds: [previewEmbed],
      components: [actionRow]
    });
    
    logger.info(`Order form submitted by ${interaction.user.tag} - awaiting confirmation`);
    
  } catch (error) {
    logger.error('Error handling order modal submit:', error);
    if (interaction.deferred) {
      await interaction.editReply('Une erreur est survenue lors du traitement du formulaire.');
    } else {
      await interaction.reply('Une erreur est survenue lors du traitement du formulaire.');
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
    
    // Préparer les données pour l'insertion dans la BDD
    const orderData = {
      orderId,
      adminId: interaction.user.id,
      data: orderSession.data
    };
    
    // Créer l'offre dans la base de données
    try {
      await orderDB.create(orderData);
    } catch (dbError) {
      logger.error('Error creating order in database:', dbError);
      await interaction.followUp({
        content: `Une erreur est survenue lors de la création de l'offre dans la base de données: ${dbError.message}`,
        ephemeral: true
      });
      
      // Clear the active order
      client.activeOrders.delete(interaction.user.id);
      return;
    }
    
    // Créer l'embed pour publication (version minimaliste)
    const publishEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .addFields(
        { name: 'Rémunération', value: orderSession.data.compensation },
        { name: 'Description', value: orderSession.data.description },
        { name: 'Posté par', value: `<@${interaction.user.id}>` }
      );
    
    // Formater les tags pour l'affichage
    const tagsFormatted = orderSession.data.tags && orderSession.data.tags.length > 0 
      ? orderSession.data.tags.map(tag => `🔴 \`${tag}\``).join('\n')
      : 'Aucun tag';
    
    // Ajouter les tags à l'embed
    publishEmbed.addFields(
      { name: 'Mandatory', value: tagsFormatted }
    );
    
    // Bouton pour accepter l'offre
    const publishRow = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_order_${orderId}`)
          .setLabel('Accepter ce travail')
          .setStyle(ButtonStyle.Primary)
      );
    
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
    
    // Publier l'offre
    try {
      await publishChannel.send({
        content: '**Nouvelle opportunité de travail disponible!**',
        embeds: [publishEmbed],
        components: [publishRow]
      });
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