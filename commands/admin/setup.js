// commands/admin/setup.js - Configuration du bot et de la base de données
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const supabase = require('../../database/supabase');
const logger = require('../../utils/logger');
const { adminRoles } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure le bot et la base de données'),
  
  name: 'setup',
  description: 'Configure le bot et la base de données',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Déterminer si c'est une interaction slash command ou un message traditionnel
      const isSlash = interaction.isChatInputCommand?.();
      
      // Répondre initialement
      if (isSlash) {
        await interaction.deferReply();
      } else {
        await interaction.reply('Configuration en cours...');
      }
      
      // Étape 1: Vérifier la connexion à Supabase
      logger.info('Vérification de la connexion à Supabase...');
      const { data: testData, error: testError } = await supabase
        .from('orders')
        .select('count');
      
      if (testError) {
        throw new Error(`Erreur de connexion à Supabase: ${testError.message}`);
      }
      
      // Étape 2: Assurer que les tables nécessaires existent
      logger.info('Vérification des tables...');
      
      // Vérifier que les noms de colonnes correspondent aux screenshots
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, orderid, adminid, clientname, compensation, description, status, assignedto, assignedat, updatedat, createdat')
        .limit(1);
      
      const { data: coders, error: codersError } = await supabase
        .from('coders')
        .select('id, userid, activeorderid, completedorders, lastactive')
        .limit(1);
      
      // Créer l'embed avec les résultats
      const setupEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Configuration du Bot')
        .setDescription('Résultat de la vérification des configurations')
        .addFields(
          { name: 'Connexion Supabase', value: testError ? '❌ Échec' : '✅ Réussie' }
        )
        .setTimestamp();
      
      // Ajouter des informations sur les tables
      if (ordersError) {
        setupEmbed.addFields({ 
          name: 'Table Orders', 
          value: `❌ Erreur: ${ordersError.message}`
        });
      } else {
        setupEmbed.addFields({ 
          name: 'Table Orders', 
          value: '✅ Accessible'
        });
      }
      
      if (codersError) {
        setupEmbed.addFields({ 
          name: 'Table Coders', 
          value: `❌ Erreur: ${codersError.message}`
        });
      } else {
        setupEmbed.addFields({ 
          name: 'Table Coders', 
          value: '✅ Accessible'
        });
      }
      
      // Ajouter les colonnes des tables pour vérification
      setupEmbed.addFields({ 
        name: 'Structure de la table Orders', 
        value: '```\nid, orderid, adminid, clientname, compensation, description, status, assignedto, assignedat, updatedat, createdat, completedat\n```' 
      });
      
      setupEmbed.addFields({ 
        name: 'Structure de la table Coders', 
        value: '```\nid, userid, activeorderid, completedorders, lastactive\n```' 
      });
      
      // Répondre avec l'embed
      if (isSlash) {
        await interaction.editReply({ embeds: [setupEmbed] });
      } else {
        await interaction.editReply({ embeds: [setupEmbed] });
      }
      
      logger.info('Configuration terminée!');
      
    } catch (error) {
      logger.error('Erreur lors de la configuration:', error);
      
      const errorMessage = `Une erreur est survenue: ${error.message}`;
      
      if (interaction.isChatInputCommand?.()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } else {
        if (interaction.replied) {
          await interaction.editReply(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      }
    }
  }
};
