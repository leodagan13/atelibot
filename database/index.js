// Database connection setup for Supabase
const supabase = require('./supabase');
const logger = require('../utils/logger');

async function connectDatabase() {
  try {
    // Test connection by fetching a simple query
    const { data, error } = await supabase.from('orders').select('count');
    
    if (error) throw error;
    
    logger.info('Supabase connection established');
    return true;
  } catch (error) {
    logger.error('Supabase connection error:', error);
    throw error;
  }
}

// Order functions
const orderDB = {
  // Create a new order
  async create(orderData) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .insert([{
          orderId: orderData.orderId,
          adminId: orderData.adminId,
          clientName: orderData.data.clientName || 'Unknown Client',
          compensation: orderData.data.compensation,
          description: orderData.data.description,
          status: 'OPEN',
          createdAt: new Date().toISOString()
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  },
  
  // Find orders by status
  async findByStatus(status) {
    try {
      let query = supabase
        .from('orders')
        .select('*');
      
      if (status !== 'ALL') {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Error finding orders with status ${status}:`, error);
      throw error;
    }
  },
  
  // Get order by ID
  async findById(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('orderId', orderId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Error finding order with ID ${orderId}:`, error);
      throw error;
    }
  },
  
  // Update order status
  async updateStatus(orderId, status, coderId = null) {
    try {
      const updateData = { status };
      
      if (coderId && status === 'ASSIGNED') {
        updateData.assignedTo = coderId;
        updateData.assignedAt = new Date().toISOString();
      }
      
      if (status === 'COMPLETED') {
        updateData.completedAt = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('orderId', orderId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error(`Error updating order ${orderId} status:`, error);
      throw error;
    }
  },
  
  // Récupérer l'historique des commandes terminées
  async getOrderHistory(limit = 10, offset = 0, filter = 'ALL') {
    try {
      let query = supabase
        .from('orders')
        .select('*');
      
      if (filter === 'ALL') {
        query = query.in('status', ['COMPLETED', 'CANCELLED']);
      } else {
        query = query.eq('status', filter);
      }
      
      const { data, error } = await query
        .order('completedAt', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error fetching order history:', error);
      throw error;
    }
  },

  // Obtenir les statistiques globales des commandes
  async getOrderStats() {
    try {
      const { data: completed, error: completedError } = await supabase
        .from('orders')
        .select('count')
        .eq('status', 'COMPLETED');
        
      const { data: cancelled, error: cancelledError } = await supabase
        .from('orders')
        .select('count')
        .eq('status', 'CANCELLED');
        
      const { data: total, error: totalError } = await supabase
        .from('orders')
        .select('count');
      
      if (completedError || cancelledError || totalError) 
        throw completedError || cancelledError || totalError;
      
      return {
        completed: completed[0].count,
        cancelled: cancelled[0].count,
        total: total[0].count,
        active: total[0].count - (completed[0].count + cancelled[0].count)
      };
    } catch (error) {
      logger.error('Error fetching order statistics:', error);
      throw error;
    }
  }
};

// Coder functions
const coderDB = {
  // Get coder by user ID
  async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('coders')
        .select('*')
        .eq('userId', userId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
      return data;
    } catch (error) {
      logger.error(`Error finding coder with user ID ${userId}:`, error);
      throw error;
    }
  },
  
  // Create or update coder
  async upsert(coderData) {
    try {
      const { data, error } = await supabase
        .from('coders')
        .upsert([coderData])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error('Error upserting coder:', error);
      throw error;
    }
  },
  
  // Update coder's active order - fixing the duplicate key error
  async setActiveOrder(userId, orderId) {
    try {
      // First check if the coder exists
      const { data: existingCoder, error: fetchError } = await supabase
        .from('coders')
        .select('*')
        .eq('userId', userId)
        .maybeSingle();
      
      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
      
      let result;
      
      if (existingCoder) {
        // Update existing coder
        const { data, error } = await supabase
          .from('coders')
          .update({
            activeOrderId: orderId,
            lastActive: new Date().toISOString()
          })
          .eq('userId', userId)
          .select();
        
        if (error) throw error;
        result = data[0];
      } else {
        // Insert new coder
        const { data, error } = await supabase
          .from('coders')
          .insert([{
            userId,
            activeOrderId: orderId,
            completedOrders: 0,
            lastActive: new Date().toISOString()
          }])
          .select();
        
        if (error) throw error;
        result = data[0];
      }
      
      return result;
    } catch (error) {
      logger.error(`Error setting active order for coder ${userId}:`, error);
      throw error;
    }
  },
  
  // Increment completed orders count
  async incrementCompletedOrders(userId) {
    try {
      // First get current coder
      const coder = await this.findByUserId(userId);
      
      if (!coder) {
        // Create new coder with 1 completed order
        return this.upsert({
          userId,
          completedOrders: 1,
          activeOrderId: null,
          lastActive: new Date().toISOString()
        });
      }
      
      // Update existing coder
      const { data, error } = await supabase
        .from('coders')
        .update({
          completedOrders: (coder.completedOrders || 0) + 1,
          activeOrderId: null,
          lastActive: new Date().toISOString()
        })
        .eq('userId', userId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error(`Error incrementing completed orders for coder ${userId}:`, error);
      throw error;
    }
  }
};

module.exports = {
  connectDatabase,
  orderDB,
  coderDB
};