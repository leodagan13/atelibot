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

// Client and Guild IDs for slash commands
const clientid = '1350474929266491402';  // lowercase to match database
const guildid = '1350455031743094804';   // lowercase to match database

// Roles that can create orders
const adminRoles = ['Admin', 'Moderator', 'Opportunity Curator'];

// Bot configuration
module.exports = {
    activeOrderSessions,
    activeCoders,
    adminRoles,
    prefix: '/',
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
    guildId: guildid     // For JavaScript code using camelCase
};