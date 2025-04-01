// events/interactionCreate.js - Updated with category-based role selection

const { handleOrderAcceptance } = require('../interaction/buttons/acceptOrder');
const { handleOrderCompletion } = require('../interaction/buttons/completeOrder');
const { handleOrderStatusUpdate } = require('../interaction/selectMenus/orderStatus');
const { publishModalOrder, getPublishChannelId } = require('../interaction/buttons/orderCreation');
const { handleVerificationRequest } = require('../interaction/buttons/requestVerification');
const { handleAdminCompletion } = require('../interaction/buttons/adminComplete');
const { handleRatingVote } = require('../interaction/ratings/projectRating');
const logger = require('../utils/logger');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, RoleSelectMenuBuilder, StringSelectMenuBuilder } = require('discord.js');
const { PUBLISH_ORDERS_CHANNEL_ID, LEVEL_CHANNELS } = require('../config/config');
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

      // Handler for modal submissions
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
            orderSession.step = 'select_role_category';
            
            // Create the category selection menu instead of directly showing all roles
            const categorySelectMenu = new StringSelectMenuBuilder()
              .setCustomId(`select_category_${userId}`)
              .setPlaceholder('Select a role category')
              .addOptions([
                { label: 'Dev Language', value: 'dev_language', emoji: '💻' },
                { label: 'Front End', value: 'front_end', emoji: '🖥️' },
                { label: 'Back End', value: 'back_end', emoji: '⚙️' },
                { label: 'Database', value: 'database', emoji: '🗄️' },
                { label: 'UI', value: 'ui', emoji: '🎨' },
                { label: 'Other', value: 'other', emoji: '📦' }
              ]);
            
            // Add a "Skip" button for users who don't want to select roles
            const skipButton = new ButtonBuilder()
              .setCustomId(`skip_roles_${userId}`)
              .setLabel('Skip Role Selection')
              .setStyle(ButtonStyle.Secondary);
            
            const row1 = new ActionRowBuilder().addComponents(categorySelectMenu);
            const row2 = new ActionRowBuilder().addComponents(skipButton);

            // Respond with the category selection menu
            await interaction.reply({
              content: 'First, select a role category:',
              components: [row1, row2],
              ephemeral: true
            });
          } else {
            await interaction.reply({
              content: 'An error occurred: creation session lost.',
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
        // Get the customId from the interaction
        const buttonId = interaction.customId;
        
        try {
          // Gestion des boutons de notation (commençant par 'rate_')
          if (buttonId.startsWith('rate_')) {
            await handleRatingVote(interaction);
          }
          
          // Ordre d'acceptation
          else if (buttonId.startsWith('accept_order_')) {
            const orderId = buttonId.replace('accept_order_', '');
            await handleOrderAcceptance(interaction, orderId);
          }
          
          // Ordre de complétion
          else if (buttonId.startsWith('complete_order_')) {
            const orderId = buttonId.replace('complete_order_', '');
            await handleOrderCompletion(interaction, orderId);
          }
          
          // Handle verification request button
          else if (buttonId.startsWith('request_verification_')) {
            const orderId = buttonId.replace('request_verification_', '');
            await handleVerificationRequest(interaction, orderId);
          }
          
          // Handle admin completion button
          else if (buttonId.startsWith('admin_complete_')) {
            const orderId = buttonId.replace('admin_complete_', '');
            await handleAdminCompletion(interaction, orderId);
          }
          
          // Confirmation d'ordre - Ajout pour le nouveau système
          else if (buttonId.startsWith('confirm_modal_order_')) {
            const orderId = buttonId.replace('confirm_modal_order_', '');
            await publishModalOrder(interaction, orderId, client);
          }
          
          // Annulation d'ordre - Ajout pour le nouveau système
          else if (buttonId.startsWith('cancel_modal_order_')) {
            await cancelModalOrder(interaction, client);
          }
          
          // Handle back to categories button for role selection
          else if (buttonId.startsWith('back_to_categories_')) {
            await handleBackToCategories(interaction, client);
          }
          
          // Handle skipping role selection or continuing to next step
          else if (buttonId.startsWith('skip_roles_') || buttonId.startsWith('continue_to_level_')) {
            await handleContinueToLevel(interaction, client);
          }
          
          // Confirmation d'ordre - ancienne méthode  
          else if (buttonId.startsWith('confirm_order_')) {
            // Cette partie est désormais gérée par le collector dans orderCreation.js
            // On ne fait rien ici, pour éviter une double manipulation
          }
          
          // Annulation d'ordre - ancienne méthode
          else if (buttonId.startsWith('cancel_order_')) {
            // Cette partie est désormais gérée par le collector dans orderCreation.js
            // On ne fait rien ici, pour éviter une double manipulation
          }
          
          // Boutons non reconnus
          else {
            logger.warn(`Unrecognized button customId: ${buttonId}`);
          }
        } catch (error) {
          logger.error(`Error handling button interaction (${buttonId}):`, error);
          
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
      
      // Handle string select menu interactions
      else if (interaction.isStringSelectMenu()) {
        try {
          const menuId = interaction.customId;
          
          // Handle order status updates
          if (menuId.startsWith('order_status_')) {
            const orderId = menuId.replace('order_status_', '');
            await handleOrderStatusUpdate(interaction, orderId);
          } 
          
          // Handle category selection for role selection
          else if (menuId.startsWith('select_category_')) {
            await handleCategorySelection(interaction, client);
          }
          
          // Handle role selection from a category
          else if (menuId.startsWith('select_roles_')) {
            await handleRoleSelection(interaction, client);
          }
          
          // Handle level selection
          else if (menuId.startsWith('select_level_')) {
            // This is handled by the existing code in the interactionCreate.js file
            // Let it pass through to the existing handler
          } 
          
          else {
            logger.warn(`Unrecognized string select menu customId: ${menuId}`);
          }
        } catch (error) {
          logger.error(`Error handling string select menu interaction (${interaction.customId}):`, error);
          
          try {
            await interaction.followUp({
              content: 'Une erreur est survenue lors du traitement de cette interaction. Veuillez réessayer.',
              ephemeral: true
            });
          } catch (replyError) {
            logger.error("Impossible d'envoyer le message d'erreur", replyError);
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
            'ERROR'
          );
          
          const logoAttachment = getLogoAttachment();
          
          await interaction.reply({
            embeds: [embed],
            files: [logoAttachment],
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
 * Handle selection of a role category
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleCategorySelection(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const userId = interaction.customId.split('_').pop();
  const category = interaction.values[0];
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // Get roles for the selected category
  const roles = getRolesByCategory(interaction.guild, category);
  
  // Create role selection menu
  const roleSelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_roles_${category}_${userId}`)
    .setPlaceholder(`Select ${formatCategoryName(category)} roles (max 20)`)
    .setMinValues(0)
    .setMaxValues(20);
  
  // Add roles as options (limit to 25 which is Discord's max)
  const roleOptions = roles.slice(0, 25).map(role => ({
    label: role.name,
    value: role.id,
    emoji: role.unicodeEmoji || undefined
  }));
  
  // If no roles in category, add a placeholder option
  if (roleOptions.length === 0) {
    roleOptions.push({
      label: 'No roles in this category',
      value: 'no_roles',
      default: true
    });
  }
  
  roleSelectMenu.addOptions(roleOptions);
  
  // Create navigation buttons
  const backButton = new ButtonBuilder()
    .setCustomId(`back_to_categories_${userId}`)
    .setLabel('Back to Categories')
    .setStyle(ButtonStyle.Secondary);
  
  const continueButton = new ButtonBuilder()
    .setCustomId(`continue_to_level_${userId}`)
    .setLabel('Continue to Next Step')
    .setStyle(ButtonStyle.Primary);
  
  const row1 = new ActionRowBuilder().addComponents(roleSelectMenu);
  const row2 = new ActionRowBuilder().addComponents(backButton, continueButton);
  
  // Show current selections, if any
  const selectedRoles = orderSession.data.requiredRoles || [];
  const selectedRolesText = selectedRoles.length > 0 
    ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
    : '';
  
  await interaction.editReply({
    content: `Select roles from the ${formatCategoryName(category)} category:${selectedRolesText}`,
    components: [row1, row2]
  });
}

/**
 * Handle role selection from a category
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleRoleSelection(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const parts = interaction.customId.split('_');
  const category = parts[2];
  const userId = parts[3];
  const selectedRoleIds = interaction.values;
  
  // Skip if "no_roles" placeholder was selected
  if (selectedRoleIds.includes('no_roles')) {
    return;
  }
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // Initialize requiredRoles array if it doesn't exist
  if (!orderSession.data.requiredRoles) {
    orderSession.data.requiredRoles = [];
  }
  
  // Process selected roles
  for (const roleId of selectedRoleIds) {
    const role = interaction.guild.roles.cache.get(roleId);
    if (role) {
      // Check if role is already selected
      const existingIndex = orderSession.data.requiredRoles.findIndex(r => r.id === roleId);
      
      if (existingIndex >= 0) {
        // Role already exists, do nothing
      } else {
        // Add new role
        orderSession.data.requiredRoles.push({
          id: roleId,
          name: role.name
        });
      }
    }
  }
  
  // Refresh the current category view
  const roles = getRolesByCategory(interaction.guild, category);
  
  // Create role selection menu
  const roleSelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_roles_${category}_${userId}`)
    .setPlaceholder(`Select ${formatCategoryName(category)} roles (max 20)`)
    .setMinValues(0)
    .setMaxValues(20);
  
  // Add roles as options (limit to 25 which is Discord's max)
  const roleOptions = roles.slice(0, 25).map(role => ({
    label: role.name,
    value: role.id,
    emoji: role.unicodeEmoji || undefined,
    // Mark as default if already selected
    default: orderSession.data.requiredRoles.some(r => r.id === role.id)
  }));
  
  if (roleOptions.length === 0) {
    roleOptions.push({
      label: 'No roles in this category',
      value: 'no_roles',
      default: true
    });
  }
  
  roleSelectMenu.addOptions(roleOptions);
  
  // Create navigation buttons
  const backButton = new ButtonBuilder()
    .setCustomId(`back_to_categories_${userId}`)
    .setLabel('Back to Categories')
    .setStyle(ButtonStyle.Secondary);
  
  const continueButton = new ButtonBuilder()
    .setCustomId(`continue_to_level_${userId}`)
    .setLabel('Continue to Next Step')
    .setStyle(ButtonStyle.Primary);
  
  const row1 = new ActionRowBuilder().addComponents(roleSelectMenu);
  const row2 = new ActionRowBuilder().addComponents(backButton, continueButton);
  
  // Show current selections
  const selectedRoles = orderSession.data.requiredRoles || [];
  const selectedRolesText = selectedRoles.length > 0 
    ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
    : '';
  
  await interaction.editReply({
    content: `Role(s) selected! Select more from the ${formatCategoryName(category)} category or navigate using the buttons below.${selectedRolesText}`,
    components: [row1, row2]
  });
}

/**
 * Handle back to categories button
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleBackToCategories(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const userId = interaction.customId.split('_').pop();
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // Recreate the category selection menu
  const categorySelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_category_${userId}`)
    .setPlaceholder('Select a role category')
    .addOptions([
      { label: 'Dev Language', value: 'dev_language', emoji: '💻' },
      { label: 'Front End', value: 'front_end', emoji: '🖥️' },
      { label: 'Back End', value: 'back_end', emoji: '⚙️' },
      { label: 'Database', value: 'database', emoji: '🗄️' },
      { label: 'UI', value: 'ui', emoji: '🎨' },
      { label: 'Other', value: 'other', emoji: '📦' }
    ]);
  
  // Add buttons for skipping or continuing
  const skipButton = new ButtonBuilder()
    .setCustomId(`skip_roles_${userId}`)
    .setLabel('Skip Role Selection')
    .setStyle(ButtonStyle.Secondary);
  
  const continueButton = new ButtonBuilder()
    .setCustomId(`continue_to_level_${userId}`)
    .setLabel('Continue to Next Step')
    .setStyle(ButtonStyle.Primary);
  
  const row1 = new ActionRowBuilder().addComponents(categorySelectMenu);
  const row2 = new ActionRowBuilder().addComponents(skipButton, continueButton);
  
  // Show current selections
  const selectedRoles = orderSession.data.requiredRoles || [];
  const selectedRolesText = selectedRoles.length > 0 
    ? `\n\nCurrently selected roles:\n${selectedRoles.map(r => `- ${r.name}`).join('\n')}`
    : '\n\nNo roles selected yet.';
  
  try {
    // Make sure we're using the correct method based on the interaction state
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2]
      });
    } else {
      await interaction.update({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2]
      });
    }
  } catch (error) {
    console.error('Error in back to categories handler:', error);
    // Try one last method if the others fail
    try {
      await interaction.followUp({
        content: `Select a role category:${selectedRolesText}`,
        components: [row1, row2],
        ephemeral: true
      });
    } catch (followUpError) {
      console.error('Failed to respond in handleBackToCategories:', followUpError);
    }
  }
}

/**
 * Handle skipping role selection or continuing to next step
 * @param {Object} interaction - Interaction object
 * @param {Object} client - Discord client
 */
async function handleContinueToLevel(interaction, client) {
  // Defer update to avoid timeout
  await interaction.deferUpdate();
  
  const userId = interaction.customId.split('_').pop();
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (!orderSession) {
    return interaction.editReply({
      content: 'Error: Order creation session lost.',
      components: []
    });
  }
  
  // If this is a skip_roles action, ensure an empty requiredRoles array
  if (interaction.customId.startsWith('skip_roles_')) {
    orderSession.data.requiredRoles = [];
  }
  
  // Move to level selection step
  orderSession.step = 'select_level';
  
  // Check if user is a super admin
  const isSuperAdmin = interaction.member.roles.cache.has("1351725292741197976");
  
  // Create level selection menu
  const levelSelectRow = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_level_${userId}`)
        .setPlaceholder('Select difficulty level')
        .addOptions([
          { label: 'Level 1 - Easy', value: '1', emoji: '🟩', description: 'Simple project for beginners' },
          { label: 'Level 2 - Beginner', value: '2', emoji: '🟨', description: 'Some knowledge required' },
          { label: 'Level 3 - Intermediate', value: '3', emoji: '🟧', description: 'Medium difficulty' },
          { label: 'Level 4 - Advanced', value: '4', emoji: '🟥', description: 'Complex project' },
          { label: 'Level 5 - Expert', value: '5', emoji: '🔴', description: 'Expertise required' },
          // Level 6 only for super admin
          ...(isSuperAdmin ? [
            { label: 'Level 6 - Super Expert', value: '6', emoji: '⚫', description: 'Reserved for exceptional projects' }
          ] : [])
        ])
    );
  
  await interaction.editReply({
    content: 'Now, select the difficulty level for this project:',
    components: [levelSelectRow]
  });
}

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
    if (level === 6 && !interaction.member.roles.cache.has(SUPER_ADMIN_ID)) {
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
    
    // Get the appropriate channel name for this level to show in preview
    const levelChannelId = getPublishChannelId(level, client);
    const levelChannel = client.channels.cache.get(levelChannelId);
    const channelName = levelChannel ? levelChannel.name : 'canal indisponible';
    
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
      content: `Voici un aperçu de votre offre de niveau ${level}. Elle sera publiée dans le canal #${channelName}. Vérifiez les détails et confirmez la publication.`,
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

/**
 * Helper function to categorize roles
 * @param {Object} guild - Discord guild
 * @param {String} category - Category name
 * @returns {Array} - Array of roles in the category
 */
function getRolesByCategory(guild, category) {
  // Define patterns or prefixes for each category
  const categoryPatterns = {
    'dev_language': ['javascript', 'python', 'java', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'typescript'],
    'front_end': ['react', 'vue', 'angular', 'svelte', 'html', 'css', 'sass', 'tailwind', 'bootstrap', 'javascript'],
    'back_end': ['node', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'fastapi', 'graphql', 'rest'],
    'database': ['sql', 'mysql', 'postgresql', 'mongodb', 'firebase', 'supabase', 'dynamodb', 'redis', 'sqlite', 'oracle'],
    'ui': ['figma', 'sketch', 'adobe', 'design', 'ui', 'ux', 'photoshop', 'illustrator', 'wireframe', 'prototype'],
    'other': ['git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'devops', 'testing', 'security', 'agile']
  };
  
  const patterns = categoryPatterns[category] || [];
  
  // Skip administrative or system roles
  const excludedRoleIds = ['1351225002577362977', '1351725292741197976', '1350494624342347878', '1351733161851097160', '1354152839391219794', '1354096392930594817', '1354096374446293132', '1354095959432364042', '1354095959432364042', '1354095928285335704', '1354095899760005303', '1354095863370219622', '1354152891631538227', '1353658097251520533', '1356598917869080586']; 
  
  // Convert Collection to Array first
  return Array.from(guild.roles.cache.values())
    .filter(role => {
      // Skip managed roles, @everyone role, and excluded roles
      if (role.managed || role.id === guild.id || excludedRoleIds.includes(role.id)) return false;
      
      // Check if role name matches any pattern for this category
      const roleName = role.name.toLowerCase();
      
      // Category-specific checks
      if (category === 'other') {
        // For "Other" category, include roles that don't match any other category
        for (const cat in categoryPatterns) {
          if (cat === 'other') continue;
          
          // If the role matches a pattern in another category, it doesn't belong in "Other"
          if (categoryPatterns[cat].some(pattern => roleName.includes(pattern))) {
            return false;
          }
        }
        // If it didn't match any other category, include it in "Other"
        return true;
      } else {
        // For specific categories, check if the role name contains any of the patterns
        return patterns.some(pattern => roleName.includes(pattern));
      }
    })
    .sort((a, b) => b.position - a.position);
}

/**
 * Helper function to format category names for display
 * @param {String} category - Category name
 * @returns {String} - Formatted category name
 */
function formatCategoryName(category) {
  const parts = category.split('_');
  return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}