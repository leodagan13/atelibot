// deploy-commands.js
const { REST, Routes } = require('discord.js');
const { clientid, guildid } = require('./config/config');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
// Path to get all commands
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  
  // Check if it's a directory
  if (!fs.statSync(folderPath).isDirectory()) continue;
  
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);
    
    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`Prepared slash command: ${command.data.name} from ${folder}/${file}`);
    }
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // The put method is used to fully refresh all commands
    const data = await rest.put(
      Routes.applicationGuildCommands(clientid, guildid),
      { body: commands },
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
