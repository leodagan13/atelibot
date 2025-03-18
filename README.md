# Discord Job Order Bot

## Overview
This Discord bot manages job orders between clients, admins, and coders. It allows administrators to post job offers that coders can accept, creating private channels for communication between all parties. The bot tracks order status and maintains a history of completed work.

## Setup

### Requirements
- Node.js
- PostgreSQL database (Supabase)
- Discord Bot Token

### Installation
1. Clone the repository
2. Run `npm install` to install dependencies
3. Configure your `.env` file:
```
DISCORD_TOKEN=your_discord_token
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
DATABASE_URL=your_postgres_connection_string
ENABLE_PREFIX_COMMANDS=true  # Set to false to disable prefix commands
```
4. Run `node deploy-command.js` to register slash commands
5. Start the bot with `node index.js`

## Commands

### Admin Commands

#### Setup and Configuration
|          Command           |          Description           |               Usage                |
|----------------------------|--------------------------------|------------------------------------|
| `/setup`                   | Configure the bot and database |                           `/setup` |
| `/stats [type]`            | Display order statistics       | `/stats [general\|orders\|coders]` |
| `/message delete <amount>` | Delete messages from channel   |               `/message delete 10` |

#### Order Management
|              Command              |        Description       |                         Usage                         |
|-----------------------------------|--------------------------|-------------------------------------------------------|
| `/add`                            | Create a new job order   |                `/add` (follows with interactive form) |
| `/order_list [status]`            | List all active orders   |        `/order_list [OPEN\|ASSIGNED\|COMPLETED\|ALL]` |
| `/order_history [status] [limit]` | Display order history    | `/order_history [COMPLETED\|CANCELLED\|ALL] [number]` |
| `/order_cancel <orderid>`         | Cancel an existing order |                          `/order_cancel 12345-abc123` |

### Order Workflow

1. **Creating Orders**: An administrator uses `/add` and fills out the form with client details, compensation, and job description
2. **Accepting Orders**: Coders click the "Accept this work" button on available job posts
3. **Completing Work**: 
   - In the private channel, the coder clicks "Terminate Project" when work is done
   - Admins can review and click "Close Project" to officially mark it complete

### Special Features

- Coders can only accept one job at a time
- Private channels are created between admin, client and coder
- Job posts show compensation and description (client details are kept confidential)
- Full history tracking and statistics

## Configuration Options

### Enabling/Disabling Prefix Commands

The bot can be set to accept traditional prefix commands (with `/`) as a fallback when slash commands are unavailable:

1. Set `ENABLE_PREFIX_COMMANDS=true` in your `.env` file to enable prefix commands
2. Set `ENABLE_PREFIX_COMMANDS=false` to use only slash commands

This setting can be changed at any time without redeploying slash commands.

## Channel Setup

The bot requires three dedicated channels:
- Order creation channel (where admins can post new orders)
- Order publishing channel (where jobs are posted for coders)
- Order history channel (where completed/cancelled orders are recorded)

Update the channel IDs in `config/config.js` to match your server's channel IDs.