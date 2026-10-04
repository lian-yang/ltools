import { useState, useEffect } from 'react';
import { PluginService, Permission, PluginMetadata } from '../../bindings/ltools/internal/plugins';
import { t } from '@/i18n';

interface PermissionDialogProps {
  pluginId: string | null;
  pluginName: string;
  requestedPermissions: Permission[];
  isOpen: boolean;
  onGrant: (permissions: Permission[]) => void;
  onDeny: () => void;
}

/**
 * 权限请求对话框组件
 * 当插件需要特定权限时显示，让用户决定是否授权
 */
export function PermissionDialog({
  pluginId,
  pluginName,
  requestedPermissions,
  isOpen,
  onGrant,
  onDeny,
}: PermissionDialogProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());
  const [pluginInfo, setPluginInfo] = useState<PluginMetadata | null>(null);

  useEffect(() => {
    if (pluginId && isOpen) {
      // 获取插件信息
      PluginService.Get(pluginId)
        .then(setPluginInfo)
        .catch(console.error);

      // 默认选中所有请求的权限
      setSelectedPermissions(new Set(requestedPermissions));
    }
  }, [pluginId, isOpen, requestedPermissions]);

  const togglePermission = (permission: Permission) => {
    const newSet = new Set(selectedPermissions);
    if (newSet.has(permission)) {
      newSet.delete(permission);
    } else {
      newSet.add(permission);
    }
    setSelectedPermissions(newSet);
  };

  const handleGrant = async () => {
    if (!pluginId) return;

    const permissionsToGrant = Array.from(selectedPermissions);
    try {
      // 逐个请求权限
      for (const permission of permissionsToGrant) {
        await PluginService.RequestPermission(pluginId, permission, true);
      }
      onGrant(permissionsToGrant);
    } catch (error) {
      console.error('Failed to grant permissions:', error);
    }
  };

  const getPermissionLabel = (permission: Permission): string => {
    const labels: Record<string, string> = {
      'filesystem': t('文件系统访问'),
      'network': t('网络访问'),
      'clipboard': t('剪贴板访问'),
      'notification': t('通知权限'),
      'process': t('进程管理'),
    };
    // Convert enum to string value
    const permStr = permission.toString().replace('Permission', '').toLowerCase();
    return labels[permStr] || permission.toString();
  };

  const getPermissionDescription = (permission: Permission): string => {
    const descriptions: Record<string, string> = {
      'filesystem': t('允许插件读写文件系统'),
      'network': t('允许插件进行网络请求'),
      'clipboard': t('允许插件读写剪贴板内容'),
      'notification': t('允许插件显示系统通知'),
      'process': t('允许插件启动和管理进程'),
    };
    // Convert enum to string value
    const permStr = permission.toString().replace('Permission', '').toLowerCase();
    return descriptions[permStr] || '';
  };

  if (!isOpen) return null;

  return (
    <div className="permission-dialog-overlay">
      <div className="permission-dialog">
        <div className="permission-dialog-header">
          <h2>{t('权限请求')}</h2>
          <button className="close-button" onClick={onDeny}>
            ×
          </button>
        </div>

        <div className="permission-dialog-body">
          <p className="permission-request-message">
            <strong>{pluginName}</strong> {t('请求以下权限：')}
          </p>

          <div className="permissions-list">
            {requestedPermissions.map((permission) => (
              <label key={permission} className="permission-item">
                <input
                  type="checkbox"
                  checked={selectedPermissions.has(permission)}
                  onChange={() => togglePermission(permission)}
                />
                <div className="permission-info">
                  <div className="permission-name">
                    {getPermissionLabel(permission)}
                  </div>
                  <div className="permission-description">
                    {getPermissionDescription(permission)}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {pluginInfo && pluginInfo.homepage && (
            <p className="plugin-homepage">
              {t('了解更多：')}{' '}
              <a
                href={pluginInfo.homepage}
                target="_blank"
                rel="noopener noreferrer"
              >
                {pluginInfo.homepage}
              </a>
            </p>
          )}
        </div>

        <div className="permission-dialog-footer">
          <button className="btn-deny" onClick={onDeny}>
            {t('拒绝')}
          </button>
          <button
            className="btn-grant"
            onClick={handleGrant}
            disabled={selectedPermissions.size === 0}
          >
            {t('授权 (')}{selectedPermissions.size}/{requestedPermissions.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export default PermissionDialog;
