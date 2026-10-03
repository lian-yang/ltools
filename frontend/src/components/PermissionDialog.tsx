import { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { PluginService, Permission, PluginMetadata } from '../../bindings/ltools/internal/plugins';
import { Modal, Button, Toggle } from './ui';

interface PermissionDialogProps {
  pluginId: string | null;
  pluginName: string;
  requestedPermissions: Permission[];
  isOpen: boolean;
  onGrant: (permissions: Permission[]) => void;
  onDeny: () => void;
}

const permissionMeta: Record<string, { icon: Parameters<typeof Icon>[0]['name']; label: string; description: string }> = {
  filesystem: { icon: 'folder', label: '文件系统访问', description: '允许插件读写文件系统' },
  network: { icon: 'network', label: '网络访问', description: '允许插件进行网络请求' },
  clipboard: { icon: 'clipboard', label: '剪贴板访问', description: '允许插件读写剪贴板内容' },
  notification: { icon: 'information-circle', label: '通知权限', description: '允许插件显示系统通知' },
  process: { icon: 'process', label: '进程管理', description: '允许插件启动和管理进程' },
};

function permKey(permission: Permission): string {
  return permission.toString().replace('Permission', '').toLowerCase();
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

  return (
    <Modal
      open={isOpen}
      onClose={onDeny}
      title="权限请求"
      width={400}
      footer={
        <>
          <Button variant="ghost" onClick={onDeny}>
            拒绝
          </Button>
          <Button
            variant="primary"
            onClick={handleGrant}
            disabled={selectedPermissions.size === 0}
          >
            授权（{selectedPermissions.size}/{requestedPermissions.length}）
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[12.5px] text-text-2">
        <span className="font-medium text-text-1">{pluginName}</span> 请求以下权限：
      </p>

      <div className="space-y-1.5">
        {requestedPermissions.map((permission) => {
          const meta = permissionMeta[permKey(permission)];
          const checked = selectedPermissions.has(permission);
          return (
            <label
              key={permission}
              className="flex cursor-pointer items-center gap-3 rounded-[7px] border px-3 py-2.5 transition-colors duration-150"
              style={{
                borderColor: checked ? 'rgba(10, 132, 255, 0.35)' : 'var(--color-hairline)',
                background: checked ? 'var(--color-accent-subtle)' : 'var(--color-surface-1)',
              }}
            >
              <Icon
                name={meta?.icon ?? 'shield-check'}
                size={15}
                color={checked ? 'var(--color-accent-text)' : 'var(--color-text-3)'}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-text-1">
                  {meta?.label ?? permission.toString()}
                </span>
                <span className="block text-[11.5px] text-text-3">{meta?.description}</span>
              </span>
              <Toggle checked={checked} onChange={() => togglePermission(permission)} />
            </label>
          );
        })}
      </div>

      {pluginInfo && pluginInfo.homepage && (
        <p className="mt-3 text-[11.5px] text-text-3">
          了解更多:{' '}
          <a href={pluginInfo.homepage} target="_blank" rel="noopener noreferrer" className="select-text">
            {pluginInfo.homepage}
          </a>
        </p>
      )}
    </Modal>
  );
}

export default PermissionDialog;
