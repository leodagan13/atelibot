// commands/admin/setup.js - Bot and database configuration
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const supabase = require('../../database/supabase');
const logger = require('../../utils/logger');
const { adminRoles } = require('../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the bot and database'),
  
  name: 'setup',
  description: 'Configure the bot and database',
  permissions: adminRoles,
  
  async execute(interaction, args, client) {
    try {
      // Determine if this is a slash command or traditional message
      const isSlash = interaction.isChatInputCommand?.();
      
      // Initial response
      if (isSlash) {
        await interaction.deferReply();
      } else {
        await interaction.reply('Configuration in progress...');
      }
      
      // Step 1: Check Supabase connection
      logger.info('Checking Supabase connection...');
      const { data: testData, error: testError } = await supabase
        .from('orders')
        .select('count');
      
      if (testError) {
        throw new Error(`Supabase connection error: ${testError.message}`);
      }
      
      // Step 2: Ensure necessary tables exist
      logger.info('Checking tables...');
      
      // Verify that column names match the screenshots
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, orderid, adminid, clientname, compensation, description, status, assignedto, assignedat, updatedat, createdat')
        .limit(1);
      
      const { data: coders, error: codersError } = await supabase
        .from('coders')
        .select('id, userid, activeorderid, completedorders, lastactive')
        .limit(1);
      
      // Create embed with results
      const setupEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('Bot Configuration')
        .setDescription('Configuration verification results')
        .addFields(
          { name: 'Supabase Connection', value: testError ? '❌ Failed' : '✅ Successful' }
        )
        .setTimestamp();
      
      // Add table information
      if (ordersError) {
        setupEmbed.addFields({ 
          name: 'Orders Table', 
          value: `❌ Error: ${ordersError.message}`
        });
      } else {
        setupEmbed.addFields({ 
          name: 'Orders Table', 
          value: '✅ Accessible'
        });
      }
      
      if (codersError) {
        setupEmbed.addFields({ 
          name: 'Coders Table', 
          value: `❌ Error: ${codersError.message}`
        });
      } else {
        setupEmbed.addFields({ 
          name: 'Coders Table', 
          value: '✅ Accessible'
        });
      }
      
      // Add table columns for verification
      setupEmbed.addFields({ 
        name: 'Orders Table Structure', 
        value: '```\nid, orderid, adminid, clientname, compensation, description, status, assignedto, assignedat, updatedat, createdat, completedat\n```' 
      });
      
      setupEmbed.addFields({ 
        name: 'Coders Table Structure', 
        value: '```\nid, userid, activeorderid, completedorders, lastactive\n```' 
      });
      
      // Reply with embed
      if (isSlash) {
        await interaction.editReply({ embeds: [setupEmbed] });
      } else {
        await interaction.editReply({ embeds: [setupEmbed] });
      }
      
      logger.info('Configuration completed!');
      
    } catch (error) {
      logger.error('Error during configuration:', error);
      
      const errorMessage = `An error occurred: ${error.message}`;
      
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
