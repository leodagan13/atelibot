// Utility to check user permissions
module.exports = {
  checkPermissions: function(member, requiredRoles) {
    if (!member || !requiredRoles || requiredRoles.length === 0) return true;
    
    // If the user is the owner of the server, authorize
    if (member.id === member.guild.ownerId) return true;
    
    // Check if the user has any of the required roles
    const memberRoles = member.roles.cache.map(role => role.name);
    return requiredRoles.some(role => memberRoles.includes(role));
  }
};