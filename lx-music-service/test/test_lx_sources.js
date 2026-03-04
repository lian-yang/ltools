// 测试LX音源
const { spawn } = require('child_process');
const path = require('path');

class TestClient {
  constructor() {
    this.server = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
  }

  async startServer() {
    return new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, '..', 'server.js');

      this.server = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '..'),
      });

      let buffer = '';
      this.server.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        lines.forEach((line) => {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              this.handleResponse(response);
            } catch (err) {
              // 忽略非JSON输出
            }
          }
        });
      });

      this.server.stderr.on('data', (data) => {
        // 只打印重要的日志
        const msg = data.toString().trim();
        if (msg.includes('Loaded') || msg.includes('Error') || msg.includes('Failed')) {
          console.log('[Server]', msg);
        }
      });

      this.server.on('error', (err) => {
        console.error('Server process error:', err);
        reject(err);
      });

      setTimeout(resolve, 1500);
    });
  }

  async request(method, params) {
    return new Promise((resolve, reject) => {
      this.requestId++;
      const id = this.requestId;

      const request = {
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify(request) + '\n');

      // 超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 15000);
    });
  }

  handleResponse(response) {
    const { id, code, data, error } = response;
    const pending = this.pendingRequests.get(id);

    if (!pending) return;

    this.pendingRequests.delete(id);

    if (code === 0) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(error.message || 'Request failed'));
    }
  }

  async close() {
    if (this.server) {
      this.server.kill();
    }
  }
}

async function runTests() {
  const client = new TestClient();

  try {
    console.log('=== 启动服务器 ===');
    await client.startServer();

    console.log('\n=== 测试健康检查 ===');
    const health = await client.request('health', {});
    console.log('可用音源:', health.sources.map(s => `${s.name} (${s.type})`).join(', '));

    // 测试LX音源
    const lxSources = health.sources.filter(s => s.type === 'lx');
    console.log(`\n=== 测试 ${lxSources.length} 个LX音源 ===\n`);

    for (const source of lxSources) {
      console.log(`\n--- 测试 ${source.name} ---`);

      try {
        // 搜索测试
        const searchResult = await client.request('search', {
          keyword: '周杰伦',
          source: source.name,
          page: 1,
          limit: 2,
        });

        if (searchResult.songs && searchResult.songs.length > 0) {
          console.log(`✅ 搜索: 找到 ${searchResult.songs.length} 首歌曲`);
          console.log(`   第一首: "${searchResult.songs[0].name}" - ${searchResult.songs[0].singer}`);

          // 播放链接测试
          const song = searchResult.songs[0];
          try {
            const urlResult = await client.request('getMusicUrl', {
              source: source.name,
              musicInfo: song,
              quality: '320k',
            });

            if (urlResult.url) {
              console.log(`✅ 播放链接: ${urlResult.url.substring(0, 80)}...`);
            } else {
              console.log(`⚠️  播放链接: 空URL`);
            }
          } catch (err) {
            console.log(`❌ 播放链接: ${err.message}`);
          }
        } else {
          console.log(`❌ 搜索: 无结果`);
        }
      } catch (err) {
        console.log(`❌ 错误: ${err.message}`);
      }
    }

    // 测试酷我音源（MusicFree）
    console.log(`\n--- 测试 酷我音乐 (MusicFree) ---`);
    try {
      const searchResult = await client.request('search', {
        keyword: '周杰伦',
        source: '酷我',
        page: 1,
        limit: 1,
      });

      if (searchResult.songs && searchResult.songs.length > 0) {
        const song = searchResult.songs[0];
        console.log(`✅ 搜索: "${song.name}"`);

        const urlResult = await client.request('getMusicUrl', {
          source: '酷我',
          musicInfo: song,
          quality: '320k',
        });

        if (urlResult.url) {
          console.log(`✅ 播放链接: ${urlResult.url.substring(0, 80)}...`);
        }
      }
    } catch (err) {
      console.log(`❌ 错误: ${err.message}`);
    }

    console.log('\n=== 测试完成 ===');
    console.log('\n推荐音源优先级：');
    console.log('1. 酷我音乐 (MusicFree) - 稳定可靠');
    console.log('2. 统一音乐源 (LX) - GD音乐台');
    console.log('3. 长青SVIP音源 (LX) - 支持无损');

  } catch (err) {
    console.error('\n=== 测试失败 ===');
    console.error(err);
  } finally {
    await client.close();
  }
}

runTests();
