// utils/dateSelection.js - Updated version with fixes
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const logger = require('./logger');

/**
 * Session storage for date selections
 * Key: userId, Value: { year, month, day }
 */
const dateSelections = new Map();

/**
 * Creates the initial date selection UI with year and month select menus
 * @param {String} userId - User ID for tracking selections
 * @returns {Array} - Array of ActionRowBuilder components
 */
function createDateSelectionUI(userId) {
  // Create year select menu (current year + 5 years ahead)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  
  for (let i = 0; i < 6; i++) {
    yearOptions.push({
      label: `${currentYear + i}`,
      value: `${currentYear + i}`,
      description: i === 0 ? "Current year" : `${i} year${i > 1 ? 's' : ''} from now`
    });
  }
  
  const yearSelect = new StringSelectMenuBuilder()
    .setCustomId(`date_year_${userId}`)
    .setPlaceholder('Select Year')
    .addOptions(yearOptions);
  
  // Create month select menu
  const monthOptions = [
    { label: 'January', value: '1', description: '31 days' },
    { label: 'February', value: '2', description: '28/29 days' },
    { label: 'March', value: '3', description: '31 days' },
    { label: 'April', value: '4', description: '30 days' },
    { label: 'May', value: '5', description: '31 days' },
    { label: 'June', value: '6', description: '30 days' },
    { label: 'July', value: '7', description: '31 days' },
    { label: 'August', value: '8', description: '31 days' },
    { label: 'September', value: '9', description: '30 days' },
    { label: 'October', value: '10', description: '31 days' },
    { label: 'November', value: '11', description: '30 days' },
    { label: 'December', value: '12', description: '31 days' }
  ];
  
  const monthSelect = new StringSelectMenuBuilder()
    .setCustomId(`date_month_${userId}`)
    .setPlaceholder('Select Month')
    .addOptions(monthOptions);
  
  // Create rows
  const yearRow = new ActionRowBuilder().addComponents(yearSelect);
  const monthRow = new ActionRowBuilder().addComponents(monthSelect);
  
  // Add instructional placeholder for day selection
  const dayPlaceholder = new StringSelectMenuBuilder()
    .setCustomId(`date_day_placeholder_${userId}`)
    .setPlaceholder('Select Year & Month first')
    .setDisabled(true)
    .addOptions([
      { label: 'Select Year & Month first', value: 'placeholder' }
    ]);
  
  const dayRow = new ActionRowBuilder().addComponents(dayPlaceholder);
  
  return [yearRow, monthRow, dayRow];
}

/**
 * Handles selection of year or month
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function handleYearOrMonthSelection(interaction, client) {
  await interaction.deferUpdate();
  
  const userId = interaction.user.id;
  const customIdParts = interaction.customId.split('_');
  const selectionType = customIdParts[1]; // year or month
  const selectedValue = interaction.values[0];
  
  // Initialize or get user's date selection
  if (!dateSelections.has(userId)) {
    dateSelections.set(userId, {});
  }
  
  const userSelection = dateSelections.get(userId);
  
  // Update the selection based on type
  if (selectionType === 'year') {
    userSelection.year = parseInt(selectedValue);
  } else if (selectionType === 'month') {
    userSelection.month = parseInt(selectedValue);
  }
  
  // If both year and month are selected, create day select menu(s)
  if (userSelection.year && userSelection.month) {
    // Get days in month
    const daysInMonth = getDaysInMonth(userSelection.month, userSelection.year);
    
    // Create components based on days in month
    const components = createDaySelectionComponents(userId, daysInMonth, userSelection);
    
    // Update the message with new components
    await interaction.editReply({
      content: formatDateSelectionMessage(userSelection),
      components: components
    });
  } else {
    // Just update the message content to show current selection
    await interaction.editReply({
      content: formatDateSelectionMessage(userSelection),
      components: interaction.message.components
    });
  }
}

/**
 * Creates appropriate day selection components based on number of days
 * @param {String} userId - User ID
 * @param {Number} daysInMonth - Total days in month
 * @param {Object} userSelection - Current user selection data
 * @returns {Array} - Array of ActionRowBuilder components
 */
function createDaySelectionComponents(userId, daysInMonth, userSelection) {
  // Get existing year and month components (to preserve selected values in dropdowns)
  const yearOptions = [];
  for (let i = 0; i < 6; i++) {
    const year = 2025 + i;
    yearOptions.push({
      label: `${year}`,
      value: `${year}`,
      description: i === 0 ? "Current year" : `${i} year${i > 1 ? 's' : ''} from now`,
      default: userSelection.year === year
    });
  }
  
  const monthOptions = [
    { label: 'January', value: '1', description: '31 days', default: userSelection.month === 1 },
    { label: 'February', value: '2', description: '28/29 days', default: userSelection.month === 2 },
    { label: 'March', value: '3', description: '31 days', default: userSelection.month === 3 },
    { label: 'April', value: '4', description: '30 days', default: userSelection.month === 4 },
    { label: 'May', value: '5', description: '31 days', default: userSelection.month === 5 },
    { label: 'June', value: '6', description: '30 days', default: userSelection.month === 6 },
    { label: 'July', value: '7', description: '31 days', default: userSelection.month === 7 },
    { label: 'August', value: '8', description: '31 days', default: userSelection.month === 8 },
    { label: 'September', value: '9', description: '30 days', default: userSelection.month === 9 },
    { label: 'October', value: '10', description: '31 days', default: userSelection.month === 10 },
    { label: 'November', value: '11', description: '30 days', default: userSelection.month === 11 },
    { label: 'December', value: '12', description: '31 days', default: userSelection.month === 12 }
  ];
  
  // Create updated select menus with default values
  const yearSelect = new StringSelectMenuBuilder()
    .setCustomId(`date_year_${userId}`)
    .setPlaceholder('Select Year')
    .addOptions(yearOptions);
  
  const monthSelect = new StringSelectMenuBuilder()
    .setCustomId(`date_month_${userId}`)
    .setPlaceholder('Select Month')
    .addOptions(monthOptions);
  
  // Create arrays for day options - split into groups of 25 max
  const components = [
    new ActionRowBuilder().addComponents(yearSelect),
    new ActionRowBuilder().addComponents(monthSelect)
  ];
  
  // For months with 25 days or less, use a single select menu
  if (daysInMonth <= 25) {
    const dayOptions = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dayOptions.push({
        label: `${i}`,
        value: `${i}`,
        description: getDayOrdinal(i)
      });
    }
    
    const daySelect = new StringSelectMenuBuilder()
      .setCustomId(`date_day_${userId}`)
      .setPlaceholder('Select Day')
      .addOptions(dayOptions);
    
    components.push(new ActionRowBuilder().addComponents(daySelect));
  } 
  // For months with more than 25 days, split into two select menus
  else {
    // First part: days 1-25
    const dayOptionsPart1 = [];
    for (let i = 1; i <= 25; i++) {
      dayOptionsPart1.push({
        label: `${i}`,
        value: `${i}`,
        description: getDayOrdinal(i)
      });
    }
    
    // Second part: days 26+
    const dayOptionsPart2 = [];
    for (let i = 26; i <= daysInMonth; i++) {
      dayOptionsPart2.push({
        label: `${i}`,
        value: `${i}`,
        description: getDayOrdinal(i)
      });
    }
    
    const daySelectPart1 = new StringSelectMenuBuilder()
      .setCustomId(`date_day_part1_${userId}`)
      .setPlaceholder('Select Day (1-25)')
      .addOptions(dayOptionsPart1);
    
    const daySelectPart2 = new StringSelectMenuBuilder()
      .setCustomId(`date_day_part2_${userId}`)
      .setPlaceholder(`Select Day (26-${daysInMonth})`)
      .addOptions(dayOptionsPart2);
    
    components.push(
      new ActionRowBuilder().addComponents(daySelectPart1),
      new ActionRowBuilder().addComponents(daySelectPart2)
    );
  }
  
  return components;
}

/**
 * Returns ordinal suffix for day number
 * @param {Number} day - Day of month
 * @returns {String} - Ordinal description
 */
function getDayOrdinal(day) {
  if (day === 1 || day === 21 || day === 31) return `${day}st`;
  if (day === 2 || day === 22) return `${day}nd`;
  if (day === 3 || day === 23) return `${day}rd`;
  return `${day}th`;
}

/**
 * Formats a message showing current date selection
 * @param {Object} userSelection - User's current selection
 * @returns {String} - Formatted message
 */
function formatDateSelectionMessage(userSelection) {
  return `Set date for project deadline:
**Year:** ${userSelection.year || 'Not selected'}
**Month:** ${userSelection.month ? getMonthName(userSelection.month) : 'Not selected'}
**Day:** ${userSelection.day || 'Not selected yet'}`;
}

/**
 * Handles selection of day from any day select menu
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function handleDaySelection(interaction, client) {
  await interaction.deferUpdate();
  
  const userId = interaction.user.id;
  const selectedDay = parseInt(interaction.values[0]);
  
  // Update user's selection
  const userSelection = dateSelections.get(userId);
  userSelection.day = selectedDay;
  
  // Format the final date in YYYY-MM-DD format
  const formattedDate = `${userSelection.year}-${userSelection.month.toString().padStart(2, '0')}-${userSelection.day.toString().padStart(2, '0')}`;
  
  // Get the order session
  const orderSession = client.activeOrders.get(userId);
  if (orderSession) {
    // Store the date in the session
    orderSession.data.deadline = formattedDate;
    client.activeOrders.set(userId, orderSession);
  }
  
  // Show success message
  const continueButton = new ButtonBuilder()
    .setCustomId(`date_continue_${userId}`)
    .setLabel('Continue')
    .setStyle(ButtonStyle.Success);
  
  const buttonRow = new ActionRowBuilder().addComponents(continueButton);
  
  await interaction.editReply({
    content: `✅ Date set successfully: **${formattedDate}**\n\nThis date will be used as the project deadline. Click "Continue" to proceed.`,
    components: [buttonRow]
  });
}

/**
 * Handles the continue button after date selection
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function handleDateContinue(interaction, client) {
  // Clear the date selection from memory
  const userId = interaction.user.id;
  dateSelections.delete(userId);
  
  // Update the message to show we're continuing
  await interaction.update({
    content: 'Date selection complete! Proceeding to the next step...',
    components: []
  });
  
  // Continue with category selection
  await showCategorySelection(interaction, client);
}

/**
 * Shows category selection UI after date is selected
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function showCategorySelection(interaction, client) {
  const userId = interaction.user.id;
  const orderSession = client.activeOrders.get(userId);
  
  if (!orderSession) {
    logger.warn(`No session found for user ${userId} in category selection`);
    return;
  }
  
  // Set the step to category selection
  orderSession.step = 'select_role_category';
  client.activeOrders.set(userId, orderSession);
  
  // Create category selection menu
  const categorySelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_category_${userId}`)
    .setPlaceholder('Select a role category')
    .addOptions([
      { label: 'Dev Language', value: 'dev_language', emoji: '💻' },
      { label: 'Front End', value: 'front_end', emoji: '🖥️' },
      { label: 'Back End', value: 'back_end', emoji: '⚙️' },
      { label: 'Database', value: 'database', emoji: '🗄️' },
      { label: 'UI', value: 'ui', emoji: '🎨' },
      { label: 'Other', value: 'other', emoji: '📦' }
    ]);
  
  const skipButton = new ButtonBuilder()
    .setCustomId(`skip_roles_${userId}`)
    .setLabel('Skip Role Selection')
    .setStyle(ButtonStyle.Secondary);
  
  const row1 = new ActionRowBuilder().addComponents(categorySelectMenu);
  const row2 = new ActionRowBuilder().addComponents(skipButton);

  // Check if the deadline was set
  const deadlineInfo = orderSession.data.deadline ? 
    `\n\nDeadline set: **${orderSession.data.deadline}**` : '';

  await interaction.followUp({
    content: `Now, select a role category:${deadlineInfo}`,
    components: [row1, row2],
    ephemeral: true
  });
}

/**
 * Creates date selection UI for the beginning of order creation
 * @param {Object} interaction - Discord interaction
 * @param {Object} client - Discord client
 * @returns {Promise<void>}
 */
async function startDateSelection(interaction, client) {
  const userId = interaction.user.id;
  
  // Initialize order session if needed
  if (!client.activeOrders.has(userId)) {
    client.activeOrders.set(userId, {
      step: 'date_selection',
      data: {
        clientName: '',
        compensation: '',
        description: '',
        tags: [],
        requiredRoles: [],
        deadline: null
      },
      channelId: interaction.channelId
    });
  }
  
  // Create and send date selection UI
  const dateUI = createDateSelectionUI(userId);
  
  await interaction.reply({
    content: 'Please select a deadline date for your project:',
    components: dateUI,
    ephemeral: true
  });
}

// Utility functions

/**
 * Gets the number of days in a month
 * @param {Number} month - Month (1-12)
 * @param {Number} year - Year (e.g. 2025)
 * @returns {Number} - Number of days in the month
 */
function getDaysInMonth(month, year) {
  // Month is 0-indexed for Date constructor
  return new Date(year, month, 0).getDate();
}

/**
 * Gets the name of a month
 * @param {Number} month - Month (1-12)
 * @returns {String} - Month name
 */
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1];
}

module.exports = {
  startDateSelection,
  handleYearOrMonthSelection,
  handleDaySelection,
  handleDateContinue,
  dateSelections
};