// events/messageCreate.js - Updated with prefix command toggle

const orderCreation = require('../interaction/buttons/orderCreation');
const { adminRoles, CREATE_ORDERS_CHANNEL_ID, PUBLISH_ORDERS_CHANNEL_ID, enablePrefixCommands } = require('../config/config');
const { prefix } = require('../config/config');
const logger = require('../utils/logger');
const { checkPermissions } = require('../utils/permissionChecker');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Debug log to check if message events are being received
    logger.debug(`Message received: ${message.content}`);
    
    // Process active order creation regardless of prefix command setting
    const activeOrder = client.activeOrders.get(message.author.id);
    if (activeOrder) {
      logger.debug(`Processing order input for user: ${message.author.id}`);
      logger.debug(`Order session: ${JSON.stringify(activeOrder)}`);
      logger.debug(`Message in channel: ${message.channel.id}, Session channel: ${activeOrder.channelid}`);
      orderCreation.processOrderInput(message, activeOrder, client);
      return;
    }
    
    // Only process prefix commands if they're enabled
    if (message.content.startsWith(prefix) && enablePrefixCommands) {
      // Split into command and arguments
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();
      
      logger.debug(`Command detected: ${commandName}, args: ${args.join(', ')}`);
      
      // Check for command with format "commandName_subcommand"
      let command;
      
      // First check: exact command match
      if (client.commands.has(commandName)) {
        command = client.commands.get(commandName);
        logger.debug(`Found exact command match: ${commandName}`);
      }
      // Second check: command_subcommand format
      else if (args.length > 0) {
        const subCommandName = `${commandName}_${args[0]}`;
        if (client.commands.has(subCommandName)) {
          command = client.commands.get(subCommandName);
          args.shift(); // Remove subcommand from args
          logger.debug(`Found subcommand match: ${subCommandName}`);
        }
      }
      
      // Third check: find commands starting with commandName_
      if (!command) {
        const possibleCommands = Array.from(client.commands.keys())
          .filter(cmd => cmd.startsWith(`${commandName}_`));
        
        logger.debug(`Possible command matches: ${possibleCommands.join(', ')}`);
        
        if (possibleCommands.length === 1) {
          command = client.commands.get(possibleCommands[0]);
        }
      }
      
      // Command not found
      if (!command) {
        logger.info(`Command not found: ${commandName} ${args.join(' ')}`);
        return message.reply(`Commande non reconnue: ${commandName}`);
      }
      
      // Check permissions
      if (command.permissions && !checkPermissions(message.member, command.permissions)) {
        return message.reply('Vous n\'avez pas la permission d\'utiliser cette commande.');
      }
      
      // Check channel restriction
      if (command.requiredChannel && message.channel.id !== command.requiredChannel) {
        return message.reply(`Cette commande ne peut être utilisée que dans le canal <#${command.requiredChannel}>.`);
      }
      
      // Execute command
      try {
        logger.info(`Executing command: ${commandName}`);
        await command.execute(message, args, client);
      } catch (error) {
        logger.error(`Error executing command ${commandName}:`, error);
        message.reply('Une erreur est survenue lors de l\'exécution de cette commande.');
      }
    }
  }
};