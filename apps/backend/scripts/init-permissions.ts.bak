import { permissionManager } from '../src/core/auth/permission-manager';

async function initializePermissions() {
  try {
    console.log('Initializing permission system...');
    
    // 初始化权限系统
    await permissionManager.initializePermissions();
    console.log('✅ Permission system initialized');
    
    // 为admin用户分配SUPER_ADMIN角色
    const adminUserId = 'cmbi1yf2d00003vzywqhuf4nx'; // 从之前的输出获取
    await permissionManager.assignRole(adminUserId, 'SUPER_ADMIN');
    console.log('✅ SUPER_ADMIN role assigned to admin user');
    
    // 验证权限
    const permissions = await permissionManager.getUserPermissions(adminUserId);
    console.log('✅ Admin user permissions:', permissions.slice(0, 5), '... (total:', permissions.length, ')');
    
    const roles = await permissionManager.getUserRoles(adminUserId);
    console.log('✅ Admin user roles:', roles);
    
  } catch (error) {
    console.error('❌ Error initializing permissions:', error);
  }
}

initializePermissions();
