/**
 * LX Music 服务 - stdin/stdout 版本
 *
 * 基于 JSON-RPC 风格的消息传递
 * 从 stdin 读取请求，向 stdout 写入响应
 */

const readline = require('readline');
const LXRuntime = require('./lx_runtime');
const MusicFreeAdapter = require('./musicfree_adapter');

class StdioServer {
  constructor() {
    this.runtime = new LXRuntime();
    this.mfAdapter = new MusicFreeAdapter();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.requestHandlers = {
      search: this.handleSearch.bind(this),
      getMusicUrl: this.handleGetMusicUrl.bind(this),
      getMusicUrlBatch: this.handleGetMusicUrlBatch.bind(this),
      getLyric: this.handleGetLyric.bind(this),
      getPic: this.handleGetPic.bind(this),
      health: this.handleHealth.bind(this),
    };

    this.stats = {
      requests: 0,
      errors: 0,
      startTime: Date.now(),
    };
  }

  /**
   * 启动服务器
   */
  async start() {
    // 加载 LX Music 格式的音源脚本
    await this.runtime.loadScripts('./sources/');

    // 加载 MusicFree 格式的插件
    await this.loadMusicFreePlugins();

    console.error('[StdioServer] Server started (stdin/stdout mode)');
    console.error(`[StdioServer] Loaded ${this.runtime.getSources().length} LX sources`);
    console.error(`[StdioServer] Loaded ${this.mfAdapter.getPlugins().length} MusicFree plugins`);

    // 监听 stdin
    this.rl.on('line', async (line) => {
      await this.handleLine(line);
    });

    // 错误处理
    this.rl.on('error', (err) => {
      console.error(`[StdioServer] Readline error: ${err.message}`);
    });
  }

  /**
   * 加载 MusicFree 插件
   */
  async loadMusicFreePlugins() {
    const fs = require('fs');
    const path = require('path');
    const sourcesDir = path.join(__dirname, 'sources');

    if (!fs.existsSync(sourcesDir)) {
      return;
    }

    const files = fs.readdirSync(sourcesDir);
    const jsFiles = files.filter((file) => file.endsWith('.js'));

    for (const file of jsFiles) {
      const scriptPath = path.join(sourcesDir, file);
      try {
        // 尝试作为 MusicFree 插件加载
        await this.mfAdapter.loadPlugin(scriptPath);
      } catch (err) {
        // 如果不是 MusicFree 格式，忽略错误（可能是 LX 格式）
      }
    }
  }

  /**
   * 处理每一行输入
   */
  async handleLine(line) {
    this.stats.requests++;

    try {
      const request = JSON.parse(line);
      const response = await this.handleRequest(request);
      this.sendResponse(response);
    } catch (err) {
      this.stats.errors++;
      console.error(`[StdioServer] Parse error: ${err.message}`);
      this.sendResponse({
        id: null,
        code: -32700,
        error: { message: 'Parse error', data: err.message },
      });
    }
  }

  /**
   * 处理请求
   */
  async handleRequest(req) {
    const { id, method, params } = req;

    console.error(`[StdioServer] Request #${id}: method=${method}`);

    try {
      const handler = this.requestHandlers[method];
      if (!handler) {
        return {
          id,
          code: -32601,
          error: { message: `Method not found: ${method}` },
        };
      }

      const data = await handler(params || {});
      console.error(`[StdioServer] Request #${id} succeeded`);
      return { id, code: 0, data };
    } catch (err) {
      console.error(`[StdioServer] Request #${id} failed: ${err.message}`);
      return {
        id,
        code: -32603,
        error: { message: err.message },
      };
    }
  }

  /**
   * 发送响应（写入 stdout）
   */
  sendResponse(response) {
    console.log(JSON.stringify(response));
  }

  /**
   * 搜索歌曲
   */
  async handleSearch(params) {
    const { keyword, source, page = 1, limit = 20 } = params;

    if (!keyword || !source) {
      throw new Error('keyword and source are required');
    }

    // 直接使用 MusicFree 插件
    return await this.mfAdapter.search(source, keyword, page, limit);
  }

  /**
   * 获取播放 URL
   */
  async handleGetMusicUrl(params) {
    const { source, musicInfo, quality = '320k' } = params;

    if (!source || !musicInfo) {
      throw new Error('source and musicInfo are required');
    }

    // 直接使用 MusicFree 插件
    return await this.mfAdapter.getMusicUrl(source, musicInfo, quality);
  }

  /**
   * 批量获取播放 URL（多源聚合）
   */
  async handleGetMusicUrlBatch(params) {
    const { songName, singer, songId, duration, sources = ['kw', 'kg', 'tx'], quality = '320k' } = params;

    if (!songName || !singer) {
      throw new Error('songName and singer are required');
    }

    console.error(`[StdioServer] Batch getting music URL: song="${songName}", singer="${singer}", sources=${sources.join(',')}`);

    const urls = [];

    // 并发请求多个源
    const promises = sources.map(async (source) => {
      try {
        let result;

        // 优先使用 MusicFree 插件
        if (this.mfAdapter.getPlugins().includes(source)) {
          // 先搜索歌曲获取完整的 musicInfo
          const searchResult = await this.mfAdapter.search(source, `${songName} ${singer}`, 1, 5);

          if (!searchResult.songs || searchResult.songs.length === 0) {
            console.error(`[StdioServer] Source ${source}: No search results`);
            return null;
          }

          // 查找匹配的歌曲（优先匹配 songId，否则选择第一个结果）
          let matchedSong = searchResult.songs[0];
          if (songId) {
            const found = searchResult.songs.find(s => s.id === songId);
            if (found) matchedSong = found;
          }

          console.error(`[StdioServer] Source ${source}: Found song "${matchedSong.name}" (ID: ${matchedSong.id})`);

          // 使用完整的音乐信息获取 URL
          result = await this.mfAdapter.getMusicUrl(source, matchedSong, quality);
        } else {
          // 使用 LX Runtime
          result = await this.runtime.handleRequest(source, 'musicUrl', {
            type: quality,
            musicInfo: params,
          });
        }

        if (result && result.url) {
          return {
            url: result.url,
            source,
            quality,
            priority: 1,
          };
        }
      } catch (err) {
        console.error(`[StdioServer] Source ${source} failed: ${err.message}`);
      }
      return null;
    });

    const results = await Promise.all(promises);
    results.forEach((item) => {
      if (item) {
        urls.push(item);
      }
    });

    // 按优先级排序（后续可以根据成功率动态调整）
    urls.sort((a, b) => a.priority - b.priority);

    return { urls };
  }

  /**
   * 获取歌词
   */
  async handleGetLyric(params) {
    const { source, musicInfo } = params;

    if (!source || !musicInfo) {
      throw new Error('source and musicInfo are required');
    }

    // 直接使用 MusicFree 插件
    return await this.mfAdapter.getLyric(source, musicInfo);
  }

  /**
   * 获取封面图片
   */
  async handleGetPic(params) {
    const { source, musicInfo } = params;

    if (!source || !musicInfo) {
      throw new Error('source and musicInfo are required');
    }

    // 直接使用 MusicFree 插件
    return await this.mfAdapter.getPic(source, musicInfo);
  }

  /**
   * 健康检查
   */
  async handleHealth() {
    const uptime = (Date.now() - this.stats.startTime) / 1000;

    // 合并 LX 源和 MusicFree 插件
    const sources = [
      ...this.runtime.getSources().map((source) => ({
        id: source.id,
        name: source.name,
        version: source.version,
        type: 'lx',
        available: true,
      })),
      ...this.mfAdapter.getPlugins().map((pluginId) => ({
        id: pluginId,
        name: pluginId,
        version: 'unknown',
        type: 'musicfree',
        available: true,
      })),
    ];

    return {
      status: 'ok',
      uptime,
      requests: this.stats.requests,
      errors: this.stats.errors,
      sources,
    };
  }
}

// 启动服务器
const server = new StdioServer();
server.start().catch((err) => {
  console.error(`[StdioServer] Server error: ${err.message}`);
  process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.error('[StdioServer] Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('[StdioServer] Received SIGINT, shutting down...');
  process.exit(0);
});
