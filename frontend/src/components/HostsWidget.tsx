import { useState, useEffect, useRef } from 'react';
import { HostsService } from '../../bindings/ltools/plugins/hosts';
import { Scenario, Backup, SystemInfo, HostEntry } from '../../bindings/ltools/plugins/hosts/models';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  SectionTitle,
  Segmented,
  Skeleton,
  Textarea,
  Toggle,
} from './ui';

type View = 'scenarios' | 'editor' | 'backups';

/**
 * Hosts 管理器 — 场景卡片 + 条目行编辑 + 备份列表
 */

/**
 * 场景卡片组件
 */
interface ScenarioCardProps {
  scenario: Scenario;
  onSwitch: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function ScenarioCard({ scenario, onSwitch, onEdit, onDelete }: ScenarioCardProps): JSX.Element {
  const handleSwitch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwitch(scenario.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定要删除场景 "${scenario.name}" 吗？`)) {
      onDelete(scenario.id);
    }
  };

  const enabledCount = scenario.entries.filter(e => e.enabled).length;

  return (
    <div
      className={`card card-hover group cursor-pointer p-4 ${scenario.isActive ? 'border-accent/60' : ''}`}
      onClick={() => onEdit(scenario.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEdit(scenario.id);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-[13px] font-semibold text-text-1" title={scenario.name}>
          {scenario.name}
        </h3>
        {scenario.isActive && (
          <Badge tone="success" className="shrink-0">
            活跃
          </Badge>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 min-h-[34px] text-[12px] leading-normal text-text-2">
        {scenario.description}
      </p>

      <div className="hairline-t mt-3 flex items-center justify-between gap-2 pt-2.5">
        <span className="tnum flex shrink-0 items-center gap-1.5 text-[11.5px] text-text-3">
          <Icon name="document" size={13} className="shrink-0" />
          {enabledCount}/{scenario.entries.length} 条目
        </span>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
          {!scenario.isActive && (
            <IconButton name="refresh" label="切换到此场景" size="sm" onClick={handleSwitch} />
          )}
          <IconButton name="trash" label="删除场景" size="sm" tone="danger" onClick={handleDelete} />
        </div>
      </div>
    </div>
  );
}

/**
 * 备份列表项组件
 */
interface BackupItemProps {
  backup: Backup;
  scenarios: Scenario[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

function BackupItem({ backup, scenarios, onRestore, onDelete }: BackupItemProps): JSX.Element {
  const scenario = scenarios.find(s => s.id === backup.scenarioId);

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="row px-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-text-1">{scenario?.name || backup.scenarioId}</p>
        <p className="tnum mt-0.5 font-mono text-[11px] text-text-3">{formatDate(backup.createdAt)}</p>
      </div>
      <span className="tnum shrink-0 font-mono text-[11.5px] text-text-3">{formatSize(backup.size)}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="secondary" onClick={() => onRestore(backup.id)}>
          恢复
        </Button>
        <IconButton
          name="trash"
          label="删除备份"
          size="sm"
          tone="danger"
          onClick={() => {
            if (confirm('确定要删除此备份吗？')) {
              onDelete(backup.id);
            }
          }}
        />
      </div>
    </div>
  );
}

/**
 * 创建场景对话框
 */
interface CreateScenarioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

function CreateScenarioDialog({ isOpen, onClose, onCreate }: CreateScenarioDialogProps): JSX.Element {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      console.error('Failed to create scenario:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="创建新场景"
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={creating}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            loading={creating}
          >
            创建
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={<>场景名称 <span className="text-error-text">*</span></>}>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如: 开发环境"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
        </Field>

        <Field label="描述">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="场景的用途说明..."
            rows={3}
            className="resize-none"
          />
        </Field>
      </div>
    </Modal>
  );
}

/**
 * 场景编辑器视图
 */
interface EditorViewProps {
  scenario: Scenario;
  onClose: () => void;
  onUpdate: () => void;
}

/** 条目行网格:启用 / IP / 主机名 / 备注 / 操作 */
const ENTRY_GRID =
  'grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_32px] items-center gap-2';

function EditorView({ scenario, onClose, onUpdate }: EditorViewProps): JSX.Element {
  const [entries, setEntries] = useState<HostEntry[]>([]);
  // 与 entries 平行的稳定 key(仅用于列表 diff,不进入后端数据)
  const [entryKeys, setEntryKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const keyCounter = useRef(0);
  const nextKey = () => `entry-${++keyCounter.current}`;

  useEffect(() => {
    setEntries([...scenario.entries]);
    setEntryKeys(scenario.entries.map(() => nextKey()));
  }, [scenario]);

  const addEntry = () => {
    setEntries([...entries, { ip: '', hostname: '', comment: '', enabled: true }]);
    setEntryKeys([...entryKeys, nextKey()]);
  };

  const updateEntry = (index: number, field: keyof HostEntry, value: string | boolean) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
    setEntryKeys(entryKeys.filter((_, i) => i !== index));
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      // 先验证
      setValidating(true);
      const validation = await HostsService.ValidateEntries(entries);
      setValidating(false);

      if (validation && !validation.valid) {
        setValidationErrors(validation.errors);
        return;
      }

      setValidationErrors([]);

      // 更新场景
      const updatedScenario = { ...scenario, entries };
      await HostsService.UpdateScenario(scenario.id, updatedScenario);

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Failed to save scenario:', err);
      setValidating(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 编辑器头部 */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold text-text-1">{scenario.name}</h2>
          <p className="truncate text-[12px] text-text-3">{scenario.description}</p>
        </div>
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={onClose} className="shrink-0">
          返回
        </Button>
      </div>

      {/* 验证错误 */}
      {validationErrors.length > 0 && (
        <div className="card border-error/30 px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-[12.5px] font-medium text-error-text">
            <Icon name="alert-circle" size={14} />
            验证错误
          </h3>
          <ul className="mt-1.5 space-y-1">
            {validationErrors.map((error, i) => (
              <li key={i} className="text-[12px] text-error-text">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 条目列表 */}
      <Card inset className="p-2">
        <div className={`${ENTRY_GRID} px-2 pb-1.5 pt-1 text-[11px] font-medium text-text-3`}>
          <span>启用</span>
          <span>IP 地址</span>
          <span>主机名</span>
          <span>备注</span>
          <span className="text-right">操作</span>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            icon="document"
            title="暂无条目"
            description="添加一条 IP 与主机名的映射"
          />
        ) : (
          entries.map((entry, index) => (
            <div key={entryKeys[index] ?? `fallback-${index}`} className={`${ENTRY_GRID} px-2 py-1.5`}>
              <Toggle
                checked={entry.enabled}
                onChange={(v) => updateEntry(index, 'enabled', v)}
                label={`启用条目 ${index + 1}`}
              />
              <Input
                type="text"
                value={entry.ip}
                onChange={(e) => updateEntry(index, 'ip', e.target.value)}
                placeholder="127.0.0.1"
                className="font-mono text-[12px]"
              />
              <Input
                type="text"
                value={entry.hostname}
                onChange={(e) => updateEntry(index, 'hostname', e.target.value)}
                placeholder="localhost"
                className="font-mono text-[12px]"
              />
              <Input
                type="text"
                value={entry.comment || ''}
                onChange={(e) => updateEntry(index, 'comment', e.target.value)}
                placeholder="# 备注说明"
              />
              <div className="flex justify-end">
                <IconButton
                  name="trash"
                  label="删除条目"
                  size="sm"
                  tone="danger"
                  onClick={() => removeEntry(index)}
                />
              </div>
            </div>
          ))
        )}
      </Card>

      {/* 底部操作 */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" icon="plus" onClick={addEntry}>
          添加条目
        </Button>
        <Button
          variant="primary"
          icon="save"
          onClick={saveChanges}
          loading={loading || validating}
          disabled={loading || validating}
        >
          保存更改
        </Button>
      </div>
    </div>
  );
}

/**
 * Hosts 管理器主组件
 */
export function HostsWidget(): JSX.Element {
  const { success, error: showError } = useToast();
  const [currentView, setCurrentView] = useState<View>('scenarios');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingScenarioId, setEditingScenarioId] = useState<string | null>(null);

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true);
      const [scenariosData, systemInfoData] = await Promise.all([
        HostsService.GetScenarios(),
        HostsService.GetSystemInfo(),
      ]);
      setScenarios(scenariosData);
      setSystemInfo(systemInfoData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 加载备份
  const loadBackups = async () => {
    try {
      const backupsData = await HostsService.ListBackups();
      setBackups(backupsData);
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  };

  // 初始化时加载数据
  useEffect(() => {
    loadData();
  }, []);

  // 切换到备份视图时加载备份
  useEffect(() => {
    if (currentView === 'backups') {
      loadBackups();
    }
  }, [currentView]);

  // 切换场景
  const handleSwitchScenario = async (id: string) => {
    try {
      await HostsService.SwitchScenario(id);
      await loadData();
      success('场景已切换');
    } catch (err) {
      console.error('Failed to switch scenario:', err);
      showError('切换场景失败');
    }
  };

  // 创建场景
  const handleCreateScenario = async (name: string, description: string) => {
    try {
      const result = await HostsService.CreateScenario(name, description);
      if (result && result.scenario) {
        await loadData();
        success('场景创建成功');
      } else if (result?.error) {
        showError(result.error);
      }
    } catch (err) {
      console.error('Failed to create scenario:', err);
      showError('创建场景失败');
    }
  };

  // 删除场景
  const handleDeleteScenario = async (id: string) => {
    try {
      await HostsService.DeleteScenario(id);
      await loadData();
      success('场景已删除');
    } catch (err) {
      console.error('Failed to delete scenario:', err);
      showError('删除场景失败');
    }
  };

  // 恢复备份
  const handleRestoreBackup = async (id: string) => {
    try {
      await HostsService.RestoreBackup(id);
      await loadData();
      await loadBackups();
      success('备份已恢复');
    } catch (err) {
      console.error('Failed to restore backup:', err);
      showError('恢复备份失败');
    }
  };

  // 删除备份
  const handleDeleteBackup = async (id: string) => {
    try {
      await HostsService.DeleteBackup(id);
      await loadBackups();
      success('备份已删除');
    } catch (err) {
      console.error('Failed to delete backup:', err);
      showError('删除备份失败');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40 rounded-[7px]" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-[9px]" />
          ))}
        </div>
      </div>
    );
  }

  // 编辑器视图
  if (currentView === 'editor' && editingScenarioId) {
    const scenario = scenarios.find(s => s.id === editingScenarioId);
    if (scenario) {
      return (
        <EditorView
          scenario={scenario}
          onClose={() => {
            setEditingScenarioId(null);
            setCurrentView('scenarios');
          }}
          onUpdate={loadData}
        />
      );
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* 工具栏:视图切换 + 权限指示 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented<View>
            options={[
              { value: 'scenarios', label: '场景' },
              { value: 'backups', label: '备份' },
            ]}
            value={currentView === 'editor' ? 'scenarios' : currentView}
            onChange={(v) => setCurrentView(v)}
          />
          {systemInfo && (
            <Badge tone={systemInfo.hasPrivileges ? 'success' : 'warning'}>
              <Icon name={systemInfo.hasPrivileges ? 'check-circle' : 'exclamation-circle'} size={11} />
              {systemInfo.hasPrivileges ? '已提权' : '需要提权'}
            </Badge>
          )}
        </div>

        {/* hosts 文件信息 */}
        {systemInfo && (
          <p
            className="truncate font-mono text-[11px] text-text-4"
            title={`${systemInfo.hostsPath} · 当前: ${systemInfo.currentScenario || '系统默认'}`}
          >
            {systemInfo.hostsPath} · 当前: {systemInfo.currentScenario || '系统默认'}
          </p>
        )}

        {/* 场景视图 */}
        {currentView === 'scenarios' && (
          <section>
            <SectionTitle
              title="场景"
              className="mb-2.5"
              action={<span className="tnum text-[11.5px] text-text-3">{scenarios.length} 个</span>}
            />
            {scenarios.length === 0 ? (
              <Card inset>
                <EmptyState
                  icon="folder"
                  title="还没有创建任何场景"
                  description="创建场景来管理不同的 hosts 配置"
                  action={
                    <Button variant="primary" icon="plus" onClick={() => setShowCreateDialog(true)}>
                      创建第一个场景
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {scenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onSwitch={handleSwitchScenario}
                    onEdit={(id) => {
                      setEditingScenarioId(id);
                      setCurrentView('editor');
                    }}
                    onDelete={handleDeleteScenario}
                  />
                ))}

                {/* 创建新场景卡片 */}
                <button
                  className="card card-hover flex min-h-[124px] flex-col items-center justify-center gap-2 border-dashed text-text-3 hover:text-text-2"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Icon name="plus" size={20} />
                  <span className="text-[12.5px] font-medium">创建场景</span>
                </button>
              </div>
            )}
          </section>
        )}

        {/* 备份视图 */}
        {currentView === 'backups' && (
          <section>
            <SectionTitle
              title="备份记录"
              className="mb-2.5"
              action={<span className="tnum text-[11.5px] text-text-3">{backups.length} 条</span>}
            />
            {backups.length === 0 ? (
              <Card inset>
                <EmptyState icon="document" title="还没有任何备份记录" />
              </Card>
            ) : (
              <Card inset className="p-1.5">
                <div className="flex flex-col gap-0.5">
                  {backups.map((backup) => (
                    <BackupItem
                      key={backup.id}
                      backup={backup}
                      scenarios={scenarios}
                      onRestore={handleRestoreBackup}
                      onDelete={handleDeleteBackup}
                    />
                  ))}
                </div>
              </Card>
            )}
          </section>
        )}
      </div>

      {/* 创建场景对话框 */}
      <CreateScenarioDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateScenario}
      />
    </>
  );
}

export default HostsWidget;
