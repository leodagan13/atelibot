// config/config.js - Updated configuration

// Map to store ongoing order creation sessions
const activeOrderSessions = new Map();

// Set to store coders currently working
const activeCoders = new Set();

// Channel for order creation
const CREATE_ORDERS_CHANNEL_ID = '1350455133791584298';

// Channel for publishing orders
const PUBLISH_ORDERS_CHANNEL_ID = '1350504397561397319';

// Channel for order history
const HISTORY_ORDERS_CHANNEL_ID = '1350566173044904077';

// Admin role IDs
const adminRoleIds = ['1350494624342347878', '1351725292741197976'];

// Client and Guild IDs for slash commands
const clientid = '1350474929266491402';  // lowercase to match database
const guildid = '1350455133309505558';   // lowercase to match database

// Check if prefix commands are enabled
const enablePrefixCommands = process.env.ENABLE_PREFIX_COMMANDS?.toLowerCase() === 'true';

// Bot configuration
module.exports = {
    activeOrderSessions,
    activeCoders,
    adminRoles,
    adminRoleIds,  // Added adminRoleIds to exports
    prefix: '/',
    enablePrefixCommands,
    maxActiveJobs: 1,
    channels: {
        create: CREATE_ORDERS_CHANNEL_ID,
        publish: PUBLISH_ORDERS_CHANNEL_ID,
        history: HISTORY_ORDERS_CHANNEL_ID
    },
    CREATE_ORDERS_CHANNEL_ID,
    PUBLISH_ORDERS_CHANNEL_ID,
    HISTORY_ORDERS_CHANNEL_ID,
    // Export both versions for compatibility
    clientid,
    guildid,
    clientId: clientid,  // For JavaScript code using camelCase
    guildId: guildid,     // For JavaScript code using camelCase
    // Bot appearance
    appearance: {
        logoFilename: 'logo.png', // Nom du fichier dans le dossier assets
        accentColor: '#ff3366', // Red sidebar accent
        secondaryColor: '#5865F2' // For secondary elements
    }
};