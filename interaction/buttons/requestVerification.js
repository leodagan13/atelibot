// interaction/buttons/requestVerification.js - Gestionnaire pour les demandes de vérification
const { orderDB } = require('../../database');
const logger = require('../../utils/logger');
const { createNotification, getLogoAttachment } = require('../../utils/modernEmbedBuilder');
const { appearance } = require('../../config/config');

/**
 * Gère la demande de vérification d'un projet par un développeur
 * @param {Object} interaction - Interaction Discord (bouton)
 * @param {String} orderId - Identifiant de l'offre
 */
async function handleVerificationRequest(interaction, orderId) {
  try {
    const userId = interaction.user.id;
    
    // Récupérer les informations de l'offre depuis Supabase
    const order = await orderDB.findById(orderId);
    if (!order) {
      return interaction.reply({
        content: 'Cette offre n\'existe plus.',
        ephemeral: true
      });
    }
    
    // Vérifier si l'utilisateur est le codeur assigné au projet
    if (order.assignedto !== userId) {
      return interaction.reply({
        content: 'Vous n\'êtes pas autorisé à demander la vérification de ce projet.',
        ephemeral: true
      });
    }
    
    // Vérifier que l'offre est au statut ASSIGNED
    if (order.status !== 'ASSIGNED') {
      return interaction.reply({
        content: `Ce projet ne peut pas être vérifié car il est au statut ${order.status}.`,
        ephemeral: true
      });
    }
    
    // Mentionner le rôle administrateur pour demander une vérification
    await interaction.channel.send({
      content: `<@&1350494624342347878> Le développeur <@${userId}> a terminé son travail sur le projet #${orderId} et demande une vérification pour clôturer le projet.`
    });
    
    // Répondre à l'interaction
    const embed = createNotification(
        'Verification Requested',
        `A verification has been requested for project #${order.orderid}.`,
        'INFO'
    );
    
    const logoAttachment = getLogoAttachment();
    
    await interaction.reply({
      embeds: [embed],
      files: [logoAttachment],
      ephemeral: true
    });
    
    logger.info(`Verification requested for order ${orderId} by ${userId}`);
    
  } catch (error) {
    logger.error('Error handling verification request:', error);
    await interaction.reply({
      content: 'Une erreur est survenue lors de la demande de vérification.',
      ephemeral: true
    });
  }
}

module.exports = {
  handleVerificationRequest
}; 