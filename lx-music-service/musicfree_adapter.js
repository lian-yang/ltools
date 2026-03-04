/**
 * MusicFree 适配器
 *
 * 将 MusicFree 格式的插件适配为 LX Music 格式
 */

const fs = require('fs');
const path = require('path');

class MusicFreeAdapter {
  constructor() {
    this.plugins = new Map();
  }

  /**
   * 加载 MusicFree 插件
   */
  async loadPlugin(scriptPath) {
    try {
      const absolutePath = path.resolve(scriptPath);

      // 加载插件模块
      const plugin = require(absolutePath);

      if (!plugin || !plugin.platform) {
        throw new Error('Invalid MusicFree plugin format');
      }

      const pluginId = plugin.platform;
      this.plugins.set(pluginId, plugin);

      console.error(`[MusicFreeAdapter] Loaded plugin: ${pluginId} v${plugin.version}`);

      return pluginId;
    } catch (err) {
      console.error(`[MusicFreeAdapter] Failed to load plugin ${scriptPath}:`, err.message);
      throw err;
    }
  }

  /**
   * 转换为 LX Music 源信息
   */
  getLXSourceInfo(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;

    return {
      name: plugin.platform,
      id: pluginId,
      type: 'music',
      actions: ['musicUrl', 'lyric', 'pic'],
      qualitys: ['128k', '320k', 'flac'],
    };
  }

  /**
   * 搜索（转换为 LX Music 格式）
   */
  async search(pluginId, keyword, page = 1, limit = 20) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    try {
      // 调用 MusicFree 的搜索方法
      const result = await plugin.search(keyword, page, 'music');

      // 调试：输出原始返回数据的类型和结构
      console.error(`[MusicFreeAdapter] [DEBUG] Plugin ${pluginId} search result type: ${typeof result}`);
      console.error(`[MusicFreeAdapter] [DEBUG] Plugin ${pluginId} search result is array: ${Array.isArray(result)}`);
      if (result && typeof result === 'object') {
        console.error(`[MusicFreeAdapter] [DEBUG] Plugin ${pluginId} result keys: ${JSON.stringify(Object.keys(result))}`);
        if (result.data !== undefined) {
          console.error(`[MusicFreeAdapter] [DEBUG] result.data type: ${typeof result.data}, is array: ${Array.isArray(result.data)}`);
        }
        if (result.songs !== undefined) {
          console.error(`[MusicFreeAdapter] [DEBUG] result.songs type: ${typeof result.songs}, is array: ${Array.isArray(result.songs)}`);
        }
      }

      // 检查返回数据
      if (!result) {
        console.error(`[MusicFreeAdapter] Plugin ${pluginId} returned null/undefined`);
        return { songs: [], total: 0, page };
      }

      // 处理不同的数据格式
      let songs = [];
      if (Array.isArray(result)) {
        // 直接返回数组
        songs = result;
      } else if (result.data && Array.isArray(result.data)) {
        // 返回 { data: [...] } 格式
        songs = result.data;
      } else if (result.songs && Array.isArray(result.songs)) {
        // 返回 { songs: [...] } 格式
        songs = result.songs;
      } else {
        console.error(`[MusicFreeAdapter] Plugin ${pluginId} returned unexpected format:`, Object.keys(result));
        console.error(`[MusicFreeAdapter] [DEBUG] Full result: ${JSON.stringify(result).substring(0, 500)}`);
        return { songs: [], total: 0, page };
      }

      // 转换为 LX Music 格式
      const convertedSongs = songs.slice(0, limit).map((item) => ({
        id: item.id || item.songid,
        name: item.title || item.name,
        singer: item.artist || item.author || '',
        source: pluginId,
        interval: item.interval || '',
        meta: {
          songId: item.id || item.songid,
          albumName: item.album || '',
          picUrl: item.artwork || item.pic || '',
        },
      }));

      return {
        songs: convertedSongs,
        total: result.isEnd ? convertedSongs.length : -1,
        page,
      };
    } catch (err) {
      console.error(`[MusicFreeAdapter] Search error for ${pluginId}:`, err.message);
      throw err;
    }
  }

  /**
   * 获取播放 URL
   */
  async getMusicUrl(pluginId, musicItem, quality = '320k') {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // 转换质量标识
    const qualityMap = {
      '128k': 'standard',
      '320k': 'high',
      'flac': 'lossless',
    };

    const result = await plugin.getMediaSource(musicItem, qualityMap[quality] || 'high');

    if (!result || !result.url) {
      throw new Error('Failed to get music URL');
    }

    return {
      url: result.url,
      quality,
      size: 0,
    };
  }

  /**
   * 获取歌词
   */
  async getLyric(pluginId, musicItem) {
    const plugin = this.plugins.get(pluginId);

    if (!plugin || !plugin.getLyric) {
      return { lyric: '', tlyric: '' };
    }

    const result = await plugin.getLyric(musicItem);

    return {
      lyric: result?.lrc || '',
      tlyric: result?.translation || '',
    };
  }

  /**
   * 获取封面图片
   */
  async getPic(pluginId, musicItem) {
    // 直接返回音乐项中的 artwork
    if (musicItem.artwork) {
      return { url: musicItem.artwork };
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.getPic) {
      return { url: '' };
    }

    const result = await plugin.getPic(musicItem);
    return { url: result || '' };
  }

  /**
   * 获取所有已加载的插件
   */
  getPlugins() {
    return Array.from(this.plugins.keys());
  }
}

module.exports = MusicFreeAdapter;
