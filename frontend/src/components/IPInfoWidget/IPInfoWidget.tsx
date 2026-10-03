import React, { useState, useEffect, useCallback } from 'react';
import * as IPInfoService from '../../../bindings/ltools/plugins/ipinfo/service';
import { IPInfo, LocalIPInfo } from '../../../bindings/ltools/plugins/ipinfo/models';
import { Icon } from '../Icon';
import { Button, EmptyState, Spinner } from '../ui';
import { Browser } from '@wailsio/runtime';

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
      setError('获取IP信息失败，请检查网络连接');
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
      setError('获取IP信息失败，请检查网络连接');
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

  // fetchedAt 为 RFC3339 字符串(Go time.Time 序列化)
  const formatTime = (date: string | Date | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN');
  };

  // 获取国家旗帜(旗帜本身即信息,保留 emoji 渲染)
  const getCountryFlag = (countryCode: string | undefined) => {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const sectionIcon = (icon: Parameters<typeof Icon>[0]['name']) => (
    <div className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-hairline bg-surface-2">
      <Icon name={icon} size={14} color="var(--color-text-2)" />
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={22} />
          <p className="text-[12px] text-text-3">正在获取 IP 信息…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon="exclamation-circle"
          title="连接失败"
          description={error}
          action={
            <Button variant="primary" icon="refresh-cw" onClick={handleRefresh}>
              重新获取
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-wide h-full overflow-auto">
      {/* 顶部标题栏 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="page-title">IP 信息</h1>
          <p className="page-subtitle">实时网络位置信息</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="tnum flex items-center gap-1.5 text-[11.5px] text-text-4">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-success)' }} />
            最后更新:{formatTime(ipInfo?.fetchedAt || null)}
          </span>
          <Button variant="secondary" size="sm" icon="refresh-cw" onClick={handleRefresh} disabled={loading}>
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 左列 */}
        <div className="min-w-0 space-y-4">
          {/* 公网 IP */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2.5">
              {sectionIcon('network')}
              <span className="text-[12px] font-medium text-text-2">公网 IP 地址</span>
            </div>
            <div className="card-inset flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-mono text-[26px] font-semibold leading-tight text-text-1 tnum select-text">{ipInfo?.ip || '-'}</p>
                <p className="mt-0.5 font-mono text-[10.5px] text-text-4">IPv4 Address</p>
              </div>
              <button
                onClick={() => copyToClipboard(ipInfo?.ip || '', 'IP')}
                className="icon-btn shrink-0"
                title="复制 IP 地址"
              >
                <Icon name={copySuccess === 'IP' ? 'check' : 'copy'} size={16} color={copySuccess === 'IP' ? 'var(--color-success-text)' : undefined} />
              </button>
            </div>
          </div>

          {/* 地理位置 */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2.5">
              {sectionIcon('location')}
              <h3 className="text-[12px] font-medium text-text-2">地理位置</h3>
            </div>

            <div className="space-y-2">
              <div className="card-inset flex items-center justify-between px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {getCountryFlag(ipInfo?.countryCode) && (
                    <span className="text-[22px] leading-none" role="img" aria-label={ipInfo?.country}>
                      {getCountryFlag(ipInfo?.countryCode)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10.5px] text-text-4">国家/地区</p>
                    <p className="truncate text-[13.5px] font-medium text-text-1">{ipInfo?.country || '-'}</p>
                  </div>
                </div>
                {ipInfo?.countryCode && (
                  <span className="badge badge-neutral font-mono">{ipInfo.countryCode}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="card-inset px-4 py-3">
                  <p className="text-[10.5px] text-text-4">省份/地区</p>
                  <p className="truncate text-[13px] font-medium text-text-1">{ipInfo?.region || '-'}</p>
                </div>
                <div className="card-inset px-4 py-3">
                  <p className="text-[10.5px] text-text-4">城市</p>
                  <p className="truncate text-[13px] font-medium text-text-1">{ipInfo?.city || '-'}</p>
                </div>
              </div>

              <div className="card-inset flex items-center justify-between px-4 py-3">
                <span className="text-[12px] text-text-3">时区</span>
                <span className="font-mono text-[12px] text-text-1 select-text">{ipInfo?.timezone || '-'}</span>
              </div>
            </div>
          </div>

          {/* 本地网络 */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2.5">
              {sectionIcon('server')}
              <h3 className="text-[12px] font-medium text-text-2">本地网络</h3>
            </div>

            <div className="mb-2 grid grid-cols-2 gap-2">
              <div className="card-inset px-4 py-3">
                <p className="text-[10.5px] text-text-4">主机名</p>
                <p className="truncate text-[13px] font-medium text-text-1" title={hostname}>{hostname || '-'}</p>
              </div>
              <div className="card-inset px-4 py-3">
                <p className="text-[10.5px] text-text-4">MAC 地址</p>
                <p className="truncate font-mono text-[12.5px] text-text-1" title={macAddress}>{macAddress || '-'}</p>
              </div>
            </div>

            <p className="mb-1.5 mt-3 text-[10.5px] text-text-4">网络接口</p>
            {localIPs.length === 0 ? (
              <p className="text-[12px] text-text-4">未找到本地网络接口</p>
            ) : (
              <div className="space-y-1.5">
                {localIPs.map((local, index) => (
                  <div key={`${local.interface}-${index}`} className="card-inset px-3.5 py-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-text-1">{local.interface}</span>
                      {local.mac && <span className="font-mono text-[10.5px] text-text-4">{local.mac}</span>}
                    </div>
                    <div className="space-y-0.5">
                      {local.ip && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] text-text-4">IPv4</span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-2 select-text">{local.ip}</span>
                          <button
                            onClick={() => copyToClipboard(local.ip, `local-${index}`)}
                            className="icon-btn icon-btn-sm"
                            title="复制 IPv4"
                          >
                            <Icon name={copySuccess === `local-${index}` ? 'check' : 'copy'} size={12} color={copySuccess === `local-${index}` ? 'var(--color-success-text)' : undefined} />
                          </button>
                        </div>
                      )}
                      {local.ipv6 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10.5px] text-text-4">IPv6</span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-2 select-text">{local.ipv6}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右列 */}
        <div className="min-w-0 space-y-4">
          {/* 网络信息 */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2.5">
              {sectionIcon('server')}
              <h3 className="text-[12px] font-medium text-text-2">网络信息</h3>
            </div>
            <div className="space-y-2">
              <div className="card-inset px-4 py-3">
                <p className="text-[10.5px] text-text-4">运营商 (ISP)</p>
                <p className="truncate text-[13px] font-medium text-text-1" title={ipInfo?.isp || ''}>{ipInfo?.isp || '-'}</p>
              </div>
              <div className="card-inset px-4 py-3">
                <p className="text-[10.5px] text-text-4">组织 (Organization)</p>
                <p className="truncate text-[13px] font-medium text-text-1" title={ipInfo?.org || ''}>{ipInfo?.org || '-'}</p>
              </div>
            </div>
          </div>

          {/* 地理坐标 */}
          {ipInfo?.lat != null && ipInfo?.lon != null && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2.5">
                {sectionIcon('location')}
                <h3 className="text-[12px] font-medium text-text-2">地理坐标</h3>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="card-inset px-4 py-3 text-center">
                  <p className="text-[10.5px] text-text-4">纬度 Latitude</p>
                  <p className="mt-0.5 font-mono text-[17px] font-semibold text-text-1 tnum">{ipInfo.lat.toFixed(4)}°</p>
                </div>
                <div className="card-inset px-4 py-3 text-center">
                  <p className="text-[10.5px] text-text-4">经度 Longitude</p>
                  <p className="mt-0.5 font-mono text-[17px] font-semibold text-text-1 tnum">{ipInfo.lon.toFixed(4)}°</p>
                </div>
              </div>
              {/* 地图链接 */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="globe"
                  onClick={() => Browser.OpenURL(`https://www.google.com/maps?q=${ipInfo.lat},${ipInfo.lon}`)}
                >
                  Google
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="location"
                  onClick={() => Browser.OpenURL(`https://uri.amap.com/marker?position=${ipInfo.lon},${ipInfo.lat}&name=IP位置`)}
                >
                  高德
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="location"
                  onClick={() => Browser.OpenURL(`https://api.map.baidu.com/marker?location=${ipInfo.lat},${ipInfo.lon}&title=IP位置&output=html`)}
                >
                  百度
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IPInfoWidget;
