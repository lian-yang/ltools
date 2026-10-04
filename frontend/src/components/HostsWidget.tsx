import { useState, useEffect } from 'react';
import { HostsService } from '../../bindings/ltools/plugins/hosts';
import { Scenario, Backup, SystemInfo, HostEntry } from '../../bindings/ltools/plugins/hosts/models';
import { Icon } from './Icon';
import { useToast } from '../hooks/useToast';
import { t } from '@/i18n';

type View = 'scenarios' | 'editor' | 'backups';

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
  const [isHovered, setIsHovered] = useState(false);

  const handleSwitch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSwitch(scenario.id);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(scenario.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('确定要删除场景 "{name}" 吗？', { name: scenario.name }))) {
      onDelete(scenario.id);
    }
  };

  const enabledCount = scenario.entries.filter(e => e.enabled).length;

  return (
    <div
      className={`glass-light p-4 rounded-xl cursor-pointer transition-all duration-200 group ${
        scenario.isActive ? 'ring-2 ring-[#7C3AED]' : ''
      } ${isHovered ? 'bg-white/5' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-white text-lg">{scenario.name}</h3>
        {scenario.isActive && (
          <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/20 text-[#22C55E] text-xs font-medium">
            {t('活跃')}
          </span>
        )}
      </div>

      <p className="text-sm text-white/50 mb-3 line-clamp-2">{scenario.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Icon name="document" size={14} />
          <span>{enabledCount}/{scenario.entries.length} {t('条目')}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!scenario.isActive && (
            <button
              className="p-1.5 rounded-lg bg-[#7C3AED]/10 text-[#A78BFA] hover:bg-[#7C3AED]/20 clickable"
              onClick={handleSwitch}
              title={t("切换到此场景")}
            >
              <Icon name="refresh" size={14} />
            </button>
          )}
          <button
            className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-[#EF4444]/10 hover:text-[#EF4444] clickable"
            onClick={handleDelete}
            title={t("删除场景")}
          >
            <Icon name="trash" size={14} />
          </button>
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
    <tr className="border-t border-white/10 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3 text-white">{scenario?.name || backup.scenarioId}</td>
      <td className="px-4 py-3 text-white/60 text-sm">{formatDate(backup.createdAt)}</td>
      <td className="px-4 py-3 text-white/60 text-sm">{formatSize(backup.size)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7C3AED]/10 text-[#A78BFA] hover:bg-[#7C3AED]/20 clickable"
            onClick={() => onRestore(backup.id)}
          >
            {t('恢复')}
          </button>
          <button
            className="p-1.5 rounded-lg text-white/60 hover:bg-[#EF4444]/10 hover:text-[#EF4444] clickable"
            onClick={() => {
              if (confirm(t('确定要删除此备份吗？'))) {
                onDelete(backup.id);
              }
            }}
            title={t("删除备份")}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </td>
    </tr>
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

function CreateScenarioDialog({ isOpen, onClose, onCreate }: CreateScenarioDialogProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!name.trim()) return;
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-heavy rounded-2xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-white mb-4">{t('创建新场景')}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              {t('场景名称')} <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("例如: 开发环境")}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white/10 transition-all"
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              {t('描述')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("场景的用途说明...")}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]/50 focus:bg-white/10 transition-all resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition-colors clickable"
            onClick={onClose}
            disabled={creating}
          >
            {t('取消')}
          </button>
          <button
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors clickable disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleCreate}
            disabled={!name.trim() || creating}
          >
            {creating ? t('创建中...') : t('创建')}
          </button>
        </div>
      </div>
    </div>
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

function EditorView({ scenario, onClose, onUpdate }: EditorViewProps): JSX.Element {
  const [entries, setEntries] = useState<HostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    setEntries([...scenario.entries]);
  }, [scenario]);

  const addEntry = () => {
    setEntries([...entries, { ip: '', hostname: '', comment: '', enabled: true }]);
  };

  const updateEntry = (index: number, field: keyof HostEntry, value: string | boolean) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{scenario.name}</h2>
          <p className="text-white/50">{scenario.description}</p>
        </div>
        <button
          className="px-4 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 clickable"
          onClick={onClose}
        >
          {t('返回')}
        </button>
      </div>

      {validationErrors.length > 0 && (
        <div className="glass-light rounded-xl p-4 border border-[#EF4444]/30">
          <h3 className="text-[#EF4444] font-medium mb-2">{t('验证错误')}</h3>
          <ul className="text-sm text-[#EF4444]/80 space-y-1">
            {validationErrors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="glass-light rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-white/60">{t('IP 地址')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white/60">{t('主机名')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white/60">{t('备注')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white/60 w-20">{t('启用')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white/60 w-20">{t('操作')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={index} className="border-t border-white/10">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={entry.ip}
                    onChange={(e) => updateEntry(index, 'ip', e.target.value)}
                    placeholder="127.0.0.1"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]/50"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={entry.hostname}
                    onChange={(e) => updateEntry(index, 'hostname', e.target.value)}
                    placeholder="localhost"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]/50"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={entry.comment || ''}
                    onChange={(e) => updateEntry(index, 'comment', e.target.value)}
                    placeholder={t("# 备注说明")}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#7C3AED]/50"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={entry.enabled}
                    onChange={(e) => updateEntry(index, 'enabled', e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#7C3AED] focus:ring-[#7C3AED]/50"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    className="p-1.5 rounded-lg text-white/60 hover:bg-[#EF4444]/10 hover:text-[#EF4444] clickable"
                    onClick={() => removeEntry(index)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button
          className="px-4 py-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 clickable flex items-center gap-2"
          onClick={addEntry}
        >
          <Icon name="plus" size={16} />
          {t('添加条目')}
        </button>

        <button
          className="px-6 py-2.5 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] clickable disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          onClick={saveChanges}
          disabled={loading || validating}
        >
          {loading || validating ? t('保存中...') : t('保存更改')}
        </button>
      </div>
    </div>
  );
}

/**
 * 空状态组件
 */
function EmptyState({ message, action }: { message: string; action?: { label: string; onClick: () => void } }): JSX.Element {
  return (
    <div className="glass-light rounded-xl p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 mb-4">
        <Icon name="server" size={28} color="rgba(255,255,255,0.3)" />
      </div>
      <h3 className="text-lg font-medium text-white mb-2">{message}</h3>
      {action && (
        <button
          className="mt-4 px-4 py-2 rounded-xl bg-[#7C3AED] text-white hover:bg-[#6D28D9] clickable"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
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
      success(t('场景已切换'));
    } catch (err) {
      console.error('Failed to switch scenario:', err);
      showError(t('切换场景失败'));
    }
  };

  // 创建场景
  const handleCreateScenario = async (name: string, description: string) => {
    try {
      const result = await HostsService.CreateScenario(name, description);
      if (result && result.scenario) {
        await loadData();
        success(t('场景创建成功'));
      } else if (result?.error) {
        showError(result.error);
      }
    } catch (err) {
      console.error('Failed to create scenario:', err);
      showError(t('创建场景失败'));
    }
  };

  // 删除场景
  const handleDeleteScenario = async (id: string) => {
    try {
      await HostsService.DeleteScenario(id);
      await loadData();
      success(t('场景已删除'));
    } catch (err) {
      console.error('Failed to delete scenario:', err);
      showError(t('删除场景失败'));
    }
  };

  // 恢复备份
  const handleRestoreBackup = async (id: string) => {
    try {
      await HostsService.RestoreBackup(id);
      await loadData();
      await loadBackups();
      success(t('备份已恢复'));
    } catch (err) {
      console.error('Failed to restore backup:', err);
      showError(t('恢复备份失败'));
    }
  };

  // 删除备份
  const handleDeleteBackup = async (id: string) => {
    try {
      await HostsService.DeleteBackup(id);
      await loadBackups();
      success(t('备份已删除'));
    } catch (err) {
      console.error('Failed to delete backup:', err);
      showError(t('删除备份失败'));
    }
  };

  if (loading) {
    return (
      <div className="glass-light rounded-xl p-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 animate-pulse">
          <Icon name="refresh" size={20} color="rgba(255,255,255,0.3)" />
        </div>
        <p className="text-white/40 mt-4">{t('加载中...')}</p>
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
      <div className="space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{t('Hosts 管理器')}</h2>
            {systemInfo && (
              <p className="text-sm text-white/50">
                {systemInfo.hostsPath} {t('· 当前:')} {systemInfo.currentScenario || t('系统默认')}
              </p>
            )}
          </div>

          {/* 权限指示器 */}
          {systemInfo && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
              systemInfo.hasPrivileges
                ? 'bg-[#22C55E]/20 text-[#22C55E]'
                : 'bg-[#F59E0B]/20 text-[#F59E0B]'
            }`}>
              <Icon name={systemInfo.hasPrivileges ? 'check-circle' : 'exclamation-circle'} size={16} />
              <span className="text-sm font-medium">
                {systemInfo.hasPrivileges ? t('已提权') : t('需要提权')}
              </span>
            </div>
          )}
        </div>

        {/* 视图切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentView('scenarios')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all clickable ${
              currentView === 'scenarios'
                ? 'bg-[#7C3AED] text-white'
                : 'glass-light text-white/60 hover:text-white/80'
            }`}
          >
            {t('场景')}
          </button>
          <button
            onClick={() => setCurrentView('backups')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all clickable ${
              currentView === 'backups'
                ? 'bg-[#7C3AED] text-white'
                : 'glass-light text-white/60 hover:text-white/80'
            }`}
          >
            {t('备份')}
          </button>
        </div>

        {/* 场景视图 */}
        {currentView === 'scenarios' && (
          <>
            {scenarios.length === 0 ? (
              <EmptyState
                message={t("还没有创建任何场景")}
                action={{ label: t('创建第一个场景'), onClick: () => setShowCreateDialog(true) }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className="glass-light p-4 rounded-xl flex flex-col items-center justify-center text-[#A78BFA] hover:bg-white/5 clickable transition-all min-h-[140px] border-2 border-dashed border-[#7C3AED]/30 hover:border-[#7C3AED]/50"
                  onClick={() => setShowCreateDialog(true)}
                >
                  <Icon name="plus" size={32} />
                  <span className="mt-2 font-medium">{t('创建场景')}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* 备份视图 */}
        {currentView === 'backups' && (
          <>
            {backups.length === 0 ? (
              <EmptyState message={t("还没有任何备份记录")} />
            ) : (
              <div className="glass-light rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[#7C3AED]/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-white">{t('场景')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-white">{t('创建时间')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-white">{t('大小')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-white">{t('操作')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((backup) => (
                      <BackupItem
                        key={backup.id}
                        backup={backup}
                        scenarios={scenarios}
                        onRestore={handleRestoreBackup}
                        onDelete={handleDeleteBackup}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
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
