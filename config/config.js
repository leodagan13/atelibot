// config/config.js - Configuration mise à jour

// Map pour stocker les sessions de création d'offre en cours
const activeOrderSessions = new Map();

// Set pour stocker les codeurs qui travaillent actuellement
const activeCoders = new Set();

// Canal pour la création d'offres
const CREATE_ORDERS_CHANNEL_ID = '1350455133791584298';

// Canal pour la publication des offres
const PUBLISH_ORDERS_CHANNEL_ID = '1350504397561397319';

// Canal pour l'historique des commandes
const HISTORY_ORDERS_CHANNEL_ID = '1350566173044904077';

// Rôles qui peuvent créer des offres
const adminRoles = ['Admin', 'Moderator', 'Opportunity Curator'];

// Bot configuration
module.exports = {
    activeOrderSessions,
    activeCoders,
    adminRoles,
    prefix: '$',
    maxActiveJobs: 1,
    channels: {
        create: CREATE_ORDERS_CHANNEL_ID,
        publish: PUBLISH_ORDERS_CHANNEL_ID,
        history: HISTORY_ORDERS_CHANNEL_ID
    },
    CREATE_ORDERS_CHANNEL_ID,
    PUBLISH_ORDERS_CHANNEL_ID,
    HISTORY_ORDERS_CHANNEL_ID
};