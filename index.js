// Add debug statements
console.log("Current directory:", process.cwd());
console.log("Env file loaded:", require('dotenv').config());

// index.js - Point d'entrée principal du bot
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Configuration globale
const { activeOrderSessions, activeCoders } = require('./config/config');
// Dans index.js, avant client.login()
const { connectDatabase } = require('./database');

// Initialize the client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Set up commands collection
client.commands = new Collection();
client.activeOrders = new Map(); // To track who is creating an order

// Set up slash commands collection 
client.slashCommands = new Collection();

// Load commands - modification du code existant
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  
  // Check if it's a directory
  if (!fs.statSync(folderPath).isDirectory()) continue;
  
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    try {
      const filePath = path.join(folderPath, file);
      const command = require(filePath);
      
      if (!command) {
        console.error(`Invalid command in ${folder}/${file}: Missing command object`);
        continue;
      }
      
      // Register regular commands with prefix
      if (command.name) {
        client.commands.set(command.name, command);
        console.log(`Loaded command: ${command.name} from ${folder}/${file}`);
        
        // Also register with folder_filename format for backward compatibility
        const baseFileName = file.split('.')[0];
        const folderFileKey = `${folder}_${baseFileName}`;
        
        if (command.name !== folderFileKey) {
          client.commands.set(folderFileKey, command);
          console.log(`Also registered as: ${folderFileKey}`);
        }
      }
      
      // Register slash commands
      if (command.data) {
        client.slashCommands.set(command.data.name, command);
        console.log(`Loaded slash command: ${command.data.name} from ${folder}/${file}`);
      }
    } catch (error) {
      console.error(`Failed to load command from ${folder}/${file}:`, error);
    }
  }
}

// Load event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Error handling
client.on('error', error => {
  console.error('Discord client error:', error);
});

// Juste avant le login
connectDatabase().then(() => {
  client.login(process.env.DISCORD_TOKEN);
}).catch(error => {
  console.error('Database connection failed:', error);
});

// Verify these channel IDs match your Discord server
const CREATE_ORDERS_CHANNEL_ID = '1350455133791584298';
const PUBLISH_ORDERS_CHANNEL_ID = '1350504397561397319';
const HISTORY_ORDERS_CHANNEL_ID = '1350566173044904077';

// In index.js, add more detailed logging
console.log("Environment variables loaded:", {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN ? "Present (length: " + process.env.DISCORD_TOKEN.length + ")" : "Missing",
  SUPABASE_URL: process.env.SUPABASE_URL ? "Present" : "Missing",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "Present (length: " + process.env.SUPABASE_ANON_KEY.length + ")" : "Missing",
});