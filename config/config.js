// config/config.js - Updated with level channel mappings

// Map to store ongoing order creation sessions
const activeOrderSessions = new Map();

// Set to store coders currently working
const activeCoders = new Set();

// Channel for order creation
const CREATE_ORDERS_CHANNEL_ID = '1350455133791584298';

// Default channel for publishing orders
const PUBLISH_ORDERS_CHANNEL_ID = '1350504397561397319';

// Channel mappings for different difficulty levels
const LEVEL_CHANNELS = {
    1: '1350504397561397319', // Level 1 - Same as default
    2: '1354094774948331640', // Level 2
    3: '1354094788340617307', // Level 3
    4: '1354094806225391616', // Level 4
    5: '1354094819311358053', // Level 5
    6: '1354094838584180747'  // Level 6 - Super Expert
};

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
    adminRoleIds,
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
    LEVEL_CHANNELS, // Export the level channel mappings
    // Export both versions for compatibility
    clientid,
    guildid,
    clientId: clientid,  // For JavaScript code using camelCase
    guildId: guildid,    // For JavaScript code using camelCase
    // Bot appearance
    appearance: {
        logoFilename: 'logo.png', // Nom du fichier dans le dossier assets
        accentColor: '#ff3366', // Red sidebar accent
        secondaryColor: '#5865F2' // For secondary elements
    }
};