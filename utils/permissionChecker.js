// Utility to check user permissions
module.exports = {
  checkPermissions: function(member, requiredRoles) {
    // Check if member has any of the required roles
    if (Array.isArray(requiredRoles)) {
      return member.roles.cache.some(role => 
        requiredRoles.includes(role.name) || requiredRoles.includes(role.id)
      );
    }
    
    // Check specific Discord permissions
    if (typeof requiredRoles === 'object') {
      return member.permissions.has(requiredRoles);
    }
    
    return false;
  }
};