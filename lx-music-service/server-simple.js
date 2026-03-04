/**
 * 音乐服务 - 简化版本
 *
 * 只支持 MusicFree 插件格式
 * 移除了 LX Runtime 和复杂的故障转移逻辑
 */

const readline = require('readline');
const MusicFreeAdapter = require('./musicfree_adapter');

class SimpleMusicServer {
  constructor() {
    this.mfAdapter = new MusicFreeAdapter();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.requestHandlers = {
      search: this.handleSearch.bind(this),
      getMusicUrl: this.handleGetMusicUrl.bind(this),
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
    // 加载 MusicFree 插件
    await this.loadPlugins();

    console.error(`[MusicServer] Server started`);
    console.error(`[MusicServer] Loaded ${this.mfAdapter.getPlugins().length} plugins`);

    // 监听 stdin
    this.rl.on('line', async (line) => {
      await this.handleLine(line);
    });
  }

  /**
   * 加载插件
   */
  async loadPlugins() {
    const fs = require('fs');
    const path = require('path');
    const sourcesDir = path.join(__dirname, 'sources');

    if (!fs.existsSync(sourcesDir)) {
      console.error(`[MusicServer] Sources directory not found: ${sourcesDir}`);
      return;
    }

    const files = fs.readdirSync(sourcesDir);
    const jsFiles = files.filter((file) => file.endsWith('.js'));

    for (const file of jsFiles) {
      const scriptPath = path.join(sourcesDir, file);
      try {
        await this.mfAdapter.loadPlugin(scriptPath);
      } catch (err) {
        console.error(`[MusicServer] Failed to load ${file}: ${err.message}`);
      }
    }
  }

  /**
   * 处理一行输入
   */
  async handleLine(line) {
    try {
      const request = JSON.parse(line);
      const response = await this.handleRequest(request);
      console.log(JSON.stringify(response));
    } catch (err) {
      console.log(JSON.stringify({
        id: null,
        code: -32700,
        error: { message: `Parse error: ${err.message}` },
      }));
    }
  }

  /**
   * 处理请求
   */
  async handleRequest(request) {
    const { id, method, params } = request;
    this.stats.requests++;

    try {
      const handler = this.requestHandlers[method];
      if (!handler) {
        throw new Error(`Unknown method: ${method}`);
      }

      const result = await handler(params);
      return { id, code: 0, data: result };
    } catch (err) {
      this.stats.errors++;
      return {
        id,
        code: -1,
        error: { message: err.message },
      };
    }
  }

  /**
   * 搜索歌曲
   */
  async handleSearch(params) {
    const { keyword, source, page = 1, limit = 20 } = params;

    if (!keyword || !source) {
      throw new Error('keyword and source are required');
    }

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

    return await this.mfAdapter.getMusicUrl(source, musicInfo, quality);
  }

  /**
   * 获取歌词
   */
  async handleGetLyric(params) {
    const { source, musicInfo } = params;

    if (!source || !musicInfo) {
      throw new Error('source and musicInfo are required');
    }

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

    return await this.mfAdapter.getPic(source, musicInfo);
  }

  /**
   * 健康检查
   */
  async handleHealth() {
    const uptime = (Date.now() - this.stats.startTime) / 1000;

    const sources = this.mfAdapter.getPlugins().map((name) => ({
      name,
      type: 'musicfree',
      available: true,
    }));

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
const server = new SimpleMusicServer();
server.start().catch((err) => {
  console.error(`[MusicServer] Fatal error: ${err.message}`);
  process.exit(1);
});
