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
      console.log("Création d'ordre avec données:", orderData);
      
      // Utiliser des noms de colonnes en minuscules
      const orderToInsert = {
        orderid: orderData.orderId,           // minuscule
        adminid: orderData.adminId,           // minuscule
        clientname: orderData.data.clientName || 'Unknown Client', // minuscule
        compensation: orderData.data.compensation || '0',
        description: orderData.data.description || 'Aucune description',
        status: 'OPEN',
        createdat: new Date().toISOString()   // minuscule
      };
      
      console.log("Données formatées pour insertion:", orderToInsert);
      
      const { data, error } = await supabase
        .from('orders')
        .insert([orderToInsert])
        .select();

      if (error) {
        console.error("Erreur Supabase:", error);
        throw error;
      }
      
      return data[0];
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  },
  
  // Mettre à jour toutes les autres fonctions pour utiliser des noms de colonnes en minuscules
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
  
  async findById(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('orderid', orderId)  // minuscule
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Error finding order with ID ${orderId}:`, error);
      throw error;
    }
  },
  
  async updateStatus(orderId, status, coderId = null) {
    try {
      const updateData = { status };
      
      if (coderId && status === 'ASSIGNED') {
        updateData.assignedto = coderId;  // minuscule
        updateData.assignedat = new Date().toISOString();  // minuscule
      }
      
      if (status === 'COMPLETED') {
        updateData.completedat = new Date().toISOString();  // minuscule
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('orderid', orderId)  // minuscule
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
        .order('completedat', { ascending: false })  // minuscule
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

// Coder functions aussi en minuscules
const coderDB = {
  async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('coders')
        .select('*')
        .eq('userid', userId)  // minuscule
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
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
  
  async setActiveOrder(userId, orderId) {
    try {
      const { data: existingCoder } = await supabase
        .from('coders')
        .select('*')
        .eq('userid', userId)  // minuscule
        .maybeSingle();
      
      let result;
      
      if (existingCoder) {
        const { data, error } = await supabase
          .from('coders')
          .update({
            activeorderid: orderId,  // minuscule
            lastactive: new Date().toISOString()  // minuscule
          })
          .eq('userid', userId)  // minuscule
          .select();
        
        if (error) throw error;
        result = data[0];
      } else {
        const { data, error } = await supabase
          .from('coders')
          .insert([{
            userid: userId,  // minuscule
            activeorderid: orderId,  // minuscule
            completedorders: 0,  // minuscule
            lastactive: new Date().toISOString()  // minuscule
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
          userid: userId,  // minuscule
          completedorders: 1,  // minuscule
          activeorderid: null,  // minuscule
          lastactive: new Date().toISOString()  // minuscule
        });
      }
      
      // Update existing coder
      const { data, error } = await supabase
        .from('coders')
        .update({
          completedorders: (coder.completedorders || 0) + 1,  // minuscule
          activeorderid: null,  // minuscule
          lastactive: new Date().toISOString()  // minuscule
        })
        .eq('userid', userId)  // minuscule
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