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
      
      // Log spécifique pour la deadline
      console.log("Deadline reçue:", orderData.data.deadline);
      
      // Process required roles if present
      let requiredRoles = [];
      if (orderData.data.requiredRoles && Array.isArray(orderData.data.requiredRoles)) {
        requiredRoles = orderData.data.requiredRoles;
      }
      
      // Convertir la deadline en format ISO si c'est une date valide
      let deadlineISO = null;
      if (orderData.data.deadline) {
        try {
          const deadlineDate = new Date(orderData.data.deadline);
          if (!isNaN(deadlineDate.getTime())) {
            deadlineISO = deadlineDate.toISOString();
            console.log("Deadline convertie:", deadlineISO);
          } else {
            console.warn("Deadline invalide:", orderData.data.deadline);
          }
        } catch (dateError) {
          console.error("Erreur de conversion de la deadline:", dateError);
        }
      }
      
      // Utiliser des noms de colonnes corrects selon les screenshots
      const orderToInsert = {
        orderid: orderData.orderId,
        adminid: orderData.adminId,
        clientname: orderData.data.clientName || 'Unknown Client',
        compensation: orderData.data.compensation || '0',
        description: orderData.data.description || 'Aucune description',
        status: 'OPEN',
        createdat: new Date().toISOString(),
        tags: orderData.data.tags || [],
        required_roles: requiredRoles, // Add required roles
        messageid: null,  // Sera mis à jour après publication
        deadline: deadlineISO // Utiliser la version ISO convertie
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
      
      // Log du résultat
      console.log("Données insérées avec succès:", data[0]);
      
      return data[0];
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  },
  
  // Trouver les offres par statut
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
  
  // Trouver une offre par ID
  async findById(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('orderid', orderId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Error finding order with ID ${orderId}:`, error);
      throw error;
    }
  },
  
  // Mettre à jour le statut d'une offre
  async updateStatus(orderId, status, coderId = null) {
    try {
      const updateData = { status };
      
      if (coderId && status === 'ASSIGNED') {
        updateData.assignedto = coderId;
        updateData.assignedat = new Date().toISOString();
      }
      
      if (status === 'COMPLETED') {
        updateData.completedat = new Date().toISOString();
      }
      
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('orderid', orderId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error(`Error updating order ${orderId} status:`, error);
      throw error;
    }
  },
  
  // Mettre à jour l'ID du message d'une offre
  async updateMessageId(orderId, messageId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ messageid: messageId })
        .eq('orderid', orderId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error(`Error updating message ID for order ${orderId}:`, error);
      throw error;
    }
  },
  
  // Récupérer l'historique des commandes
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
        .order('completedat', { ascending: false })
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
  },

  // Find orders by required role
  async findByRequiredRole(roleId) {
    try {
      // Use the custom SQL function we created
      const { data, error } = await supabase.rpc('search_orders_by_role', { role_id: roleId });
      
      if (error) throw error;
      return data;
    } catch (error) {
      logger.error(`Error finding orders with required role ${roleId}:`, error);
      throw error;
    }
  },
  
  // Ajouter une nouvelle fonction pour récupérer les offres avec deadline proche
  async getApproachingDeadlines() {
    try {
      const { data, error } = await supabase.rpc('get_approaching_deadlines');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error fetching approaching deadlines:', error);
      throw error;
    }
  },

  // Update last verification request timestamp
  async updateLastVerificationRequest(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ lastverificationrequest: new Date().toISOString() })
        .eq('orderid', orderId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error(`Error updating verification request timestamp for order ${orderId}:`, error);
      throw error;
    }
  },
  
  // Function for admins to reset the verification cooldown if needed
  async resetVerificationCooldown(orderId) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ lastverificationrequest: null })
        .eq('orderid', orderId)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      logger.error(`Error resetting verification cooldown for order ${orderId}:`, error);
      throw error;
    }
  }
};

// Coder functions avec noms de colonnes corrects selon les screenshots
const coderDB = {
  async findByUserId(userId) {
    try {
      const { data, error } = await supabase
        .from('coders')
        .select('*')
        .eq('userid', userId)
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
        .eq('userid', userId)
        .maybeSingle();
      
      let result;
      
      if (existingCoder) {
        const { data, error } = await supabase
          .from('coders')
          .update({
            activeorderid: orderId,
            lastactive: new Date().toISOString()
          })
          .eq('userid', userId)
          .select();
        
        if (error) throw error;
        result = data[0];
      } else {
        const { data, error } = await supabase
          .from('coders')
          .insert([{
            userid: userId,
            activeorderid: orderId,
            completedorders: 0,
            lastactive: new Date().toISOString()
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
          userid: userId,
          completedorders: 1,
          activeorderid: null,
          lastactive: new Date().toISOString()
        });
      }
      
      // Update existing coder
      const { data, error } = await supabase
        .from('coders')
        .update({
          completedorders: (coder.completedorders || 0) + 1,
          activeorderid: null,
          lastactive: new Date().toISOString()
        })
        .eq('userid', userId)
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