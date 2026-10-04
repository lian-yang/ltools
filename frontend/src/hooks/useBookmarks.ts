import { useState, useCallback } from 'react';
import * as BookmarkService from '../../bindings/ltools/plugins/bookmark/bookmarkservice';
import type { SearchResult } from '../../bindings/ltools/plugins/bookmark/models';
import type { Bookmark } from '../../bindings/ltools/plugins/bookmark/browser/models';
import { t } from '@/i18n';

export type { Bookmark, SearchResult };

export interface CacheStatus {
  available: boolean;
  last_sync: string;
  total_count: number;
  browser_stats: Record<string, number>;
  is_expired: boolean;
}

export function useBookmarks() {
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      return [];
    }

    setSearching(true);
    setError(null);

    try {
      const results = await BookmarkService.Search(query);
      return results || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('搜索失败');
      setError(errorMsg);
      return [];
    } finally {
      setSearching(false);
    }
  }, []);

  const sync = useCallback(async (): Promise<boolean> => {
    setSyncing(true);
    setError(null);

    try {
      await BookmarkService.Sync();
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('同步失败');
      setError(errorMsg);
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  const getCacheStatus = useCallback(async (): Promise<CacheStatus | null> => {
    try {
      const status = await BookmarkService.GetCacheStatus();
      return status as CacheStatus;
    } catch (err) {
      return null;
    }
  }, []);

  const openURL = useCallback(async (url: string): Promise<boolean> => {
    try {
      await BookmarkService.OpenURL(url);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('打开链接失败');
      setError(errorMsg);
      return false;
    }
  }, []);

  const exportHTML = useCallback(async (): Promise<string | null> => {
    try {
      const path = await BookmarkService.ExportHTML();
      return path || null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('导出 HTML 失败');
      setError(errorMsg);
      return null;
    }
  }, []);

  const exportJSON = useCallback(async (): Promise<string | null> => {
    try {
      const path = await BookmarkService.ExportJSON();
      return path || null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('导出 JSON 失败');
      setError(errorMsg);
      return null;
    }
  }, []);

  return {
    search,
    sync,
    getCacheStatus,
    openURL,
    exportHTML,
    exportJSON,
    searching,
    syncing,
    error,
  };
}
