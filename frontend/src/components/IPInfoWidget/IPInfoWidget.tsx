import React, { useState, useEffect, useCallback } from 'react';
import * as IPInfoService from '../../../bindings/ltools/plugins/ipinfo/service';
import { IPInfo, LocalIPInfo } from '../../../bindings/ltools/plugins/ipinfo/models';
import { Icon } from '../Icon';
import { Browser } from '@wailsio/runtime';
import { t } from '@/i18n';

const IPInfoWidget: React.FC = () => {
  const [ipInfo, setIpInfo] = useState<IPInfo | null>(null);
  const [localIPs, setLocalIPs] = useState<LocalIPInfo[]>([]);
  const [hostname, setHostname] = useState<string>('');
  const [macAddress, setMacAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const fetchIPInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, localInfo, host, mac] = await Promise.all([
        IPInfoService.GetIPInfo(),
        IPInfoService.GetLocalIPs(),
        IPInfoService.GetHostname(),
        IPInfoService.GetMACAddress()
      ]);
      setIpInfo(info);
      setLocalIPs(localInfo || []);
      setHostname(host || '');
      setMacAddress(mac || '');
    } catch (err) {
      setError(t('获取IP信息失败，请检查网络连接'));
      console.error('Failed to fetch IP info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIPInfo();
  }, [fetchIPInfo]);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, localInfo, host, mac] = await Promise.all([
        IPInfoService.Refresh(),
        IPInfoService.GetLocalIPs(),
        IPInfoService.GetHostname(),
        IPInfoService.GetMACAddress()
      ]);
      setIpInfo(info);
      setLocalIPs(localInfo || []);
      setHostname(host || '');
      setMacAddress(mac || '');
    } catch (err) {
      setError(t('获取IP信息失败，请检查网络连接'));
      console.error('Failed to refresh IP info:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatTime = (date: Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN');
  };

  // 获取国家旗帜emoji
  const getCountryFlag = (countryCode: string | undefined) => {
    if (!countryCode) return '🌍';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <p className="text-gray-400 animate-pulse">{t('正在获取IP信息...')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center max-w-md">
          <div className="relative inline-block mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
              <Icon name="exclamation-circle" size={36} color="#EF4444" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">{t('连接失败')}</h3>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/80 hover:to-purple-600/80 rounded-xl text-white font-medium transition-all duration-300 flex items-center gap-2 mx-auto shadow-lg shadow-primary/25 hover:shadow-primary/40"
          >
            <Icon name="refresh-cw" className="w-5 h-5" />
            <span>{t('重新连接')}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Icon name="network" size={28} className="text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-[#0D0F1A] flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{t('IP 信息')}</h2>
            <p className="text-sm text-gray-400">{t('实时网络位置信息')}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* 更新时间 */}
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Icon name="clock" className="w-4 h-4" />
            <span className="text-sm">{t('最后更新:')} {formatTime(ipInfo?.fetchedAt || null)}</span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/50 transition-all duration-300"
          >
            <Icon name="refresh-cw" className={`w-4 h-4 text-gray-400 group-hover:text-primary transition-colors ${loading ? 'animate-spin' : ''}`} />
            <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{t('刷新')}</span>
          </button>
        </div>
      </div>

      {/* 左右布局主体 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：IP 和位置信息 */}
        <div className="space-y-6">
          {/* IP地址卡片 - 主要突出 */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-purple-600/10 to-pink-500/5 p-6 border border-primary/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Icon name="network" className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-gray-300">{t('公网 IP 地址')}</span>
              </div>

              <div className="flex items-center justify-between bg-black/30 rounded-2xl p-5 backdrop-blur-sm">
                <div>
                  <p className="text-4xl font-mono font-bold text-white tracking-wider">{ipInfo?.ip}</p>
                  <p className="text-xs text-gray-500 mt-2 font-mono">IPv4 Address</p>
                </div>
                <button
                  onClick={() => copyToClipboard(ipInfo?.ip || '', 'IP')}
                  className="group relative p-3 rounded-xl bg-white/5 hover:bg-primary/20 transition-all duration-300"
                  title={t("复制IP地址")}
                >
                  {copySuccess === 'IP' ? (
                    <Icon name="check" className="w-6 h-6 text-green-400" />
                  ) : (
                    <Icon name="copy" className="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" />
                  )}
                  {copySuccess === 'IP' && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-500 text-white text-xs rounded whitespace-nowrap">
                      {t('已复制')}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 地理位置 */}
          <div className="glass rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Icon name="location" className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('地理位置')}</h3>
            </div>

            <div className="space-y-3">
              {/* 国家/地区 - 突出显示 */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-black/30 to-transparent rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{getCountryFlag(ipInfo?.countryCode)}</span>
                  <div>
                    <p className="text-xs text-gray-500">{t('国家/地区')}</p>
                    <p className="text-xl font-bold text-white">{ipInfo?.country || '-'}</p>
                  </div>
                </div>
                {ipInfo?.countryCode && (
                  <span className="px-3 py-1 bg-white/10 rounded-lg text-sm font-mono text-gray-300">
                    {ipInfo.countryCode}
                  </span>
                )}
              </div>

              {/* 省份和城市 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="location" className="w-3.5 h-3.5 text-gray-500" />
                    <p className="text-xs text-gray-500">{t('省份/地区')}</p>
                  </div>
                  <p className="text-white font-medium text-lg">{ipInfo?.region || '-'}</p>
                </div>
                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon name="location" className="w-3.5 h-3.5 text-gray-500" />
                    <p className="text-xs text-gray-500">{t('城市')}</p>
                  </div>
                  <p className="text-white font-medium text-lg">{ipInfo?.city || '-'}</p>
                </div>
              </div>

              {/* 时区 */}
              <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Icon name="clock" className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-gray-400">{t('时区')}</span>
                </div>
                <span className="text-white font-mono px-3 py-1 bg-white/5 rounded-lg">{ipInfo?.timezone || '-'}</span>
              </div>
            </div>
          </div>

          {/* 本地网络信息 */}
          <div className="glass rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Icon name="server" className="w-5 h-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('本地网络')}</h3>
            </div>

            {/* 主机名和 MAC */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="user" className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">{t('主机名')}</span>
                </div>
                <p className="text-white font-medium truncate" title={hostname}>
                  {hostname || '-'}
                </p>
              </div>
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="network" className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">{t('MAC 地址')}</span>
                </div>
                <p className="text-white font-mono text-sm truncate" title={macAddress}>
                  {macAddress || '-'}
                </p>
              </div>
            </div>

            {/* 本地 IP 列表 */}
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-2">{t('网络接口')}</p>
              {localIPs.length === 0 ? (
                <p className="text-gray-500 text-sm">{t('未找到本地网络接口')}</p>
              ) : (
                localIPs.map((local, index) => (
                  <div
                    key={index}
                    className="p-3 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-300">{local.interface}</span>
                      {local.mac && (
                        <span className="text-xs text-gray-500 font-mono">{local.mac}</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {local.ip && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">IPv4:</span>
                          <span className="text-sm font-mono text-white">{local.ip}</span>
                          <button
                            onClick={() => copyToClipboard(local.ip, `local-${index}`)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title={t("复制 IPv4")}
                          >
                            {copySuccess === `local-${index}` ? (
                              <Icon name="check" className="w-3 h-3 text-green-400" />
                            ) : (
                              <Icon name="copy" className="w-3 h-3 text-gray-500" />
                            )}
                          </button>
                        </div>
                      )}
                      {local.ipv6 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">IPv6:</span>
                          <span className="text-sm font-mono text-white truncate">{local.ipv6}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右侧：网络和坐标信息 */}
        <div className="space-y-6">
          {/* 网络信息 */}
          <div className="glass rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Icon name="server" className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white">{t('网络信息')}</h3>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="server" className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">{t('运营商 (ISP)')}</span>
                </div>
                <p className="text-white font-medium truncate" title={ipInfo?.isp || ''}>
                  {ipInfo?.isp || '-'}
                </p>
              </div>
              <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="server" className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs text-gray-500">{t('组织 (Organization)')}</span>
                </div>
                <p className="text-white font-medium truncate" title={ipInfo?.org || ''}>
                  {ipInfo?.org || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* 地理坐标 */}
          {ipInfo?.lat && ipInfo?.lon && (
            <div className="glass rounded-3xl p-6 border border-white/5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Icon name="location" className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-lg font-bold text-white">{t('地理坐标')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-4 bg-black/20 rounded-2xl text-center border border-white/5">
                  <p className="text-xs text-gray-500 mb-1">{t('纬度 Latitude')}</p>
                  <p className="text-white font-mono text-xl font-bold">{ipInfo.lat.toFixed(4)}°</p>
                </div>
                <div className="p-4 bg-black/20 rounded-2xl text-center border border-white/5">
                  <p className="text-xs text-gray-500 mb-1">{t('经度 Longitude')}</p>
                  <p className="text-white font-mono text-xl font-bold">{ipInfo.lon.toFixed(4)}°</p>
                </div>
              </div>
              {/* 地图链接 - 三个地图服务 */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => Browser.OpenURL(`https://www.google.com/maps?q=${ipInfo.lat},${ipInfo.lon}`)}
                  className="group flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-primary/20 rounded-xl text-gray-400 hover:text-primary transition-all duration-300 border border-white/10 hover:border-primary/40"
                >
                  <Icon name="globe" className="w-4 h-4" />
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button
                  onClick={() => Browser.OpenURL(`https://uri.amap.com/marker?position=${ipInfo.lon},${ipInfo.lat}&name=${t('IP位置')}`)}
                  className="group flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-green-500/20 rounded-xl text-gray-400 hover:text-green-400 transition-all duration-300 border border-white/10 hover:border-green-500/40"
                >
                  <Icon name="location" className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('高德')}</span>
                </button>
                <button
                  onClick={() => Browser.OpenURL(`https://api.map.baidu.com/marker?location=${ipInfo.lat},${ipInfo.lon}&title=${t('IP位置')}&output=html`)}
                  className="group flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-blue-500/20 rounded-xl text-gray-400 hover:text-blue-400 transition-all duration-300 border border-white/10 hover:border-blue-500/40"
                >
                  <Icon name="location" className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('百度')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IPInfoWidget;
