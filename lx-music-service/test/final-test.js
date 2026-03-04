// 最终测试：所有音源的搜索+播放测试
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
      this.server = spawn('node', ['server.js'], {
        cwd: __dirname + '/..',
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
            } catch (err) {}
          }
        });
      });

      this.server.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('Loaded') || msg.includes('Error')) {
          console.log('[Server]', msg);
        }
      });

      setTimeout(resolve, 1500);
    });
  }

  async request(method, params) {
    return new Promise((resolve, reject) => {
      this.requestId++;
      const id = this.requestId;
      this.pendingRequests.set(id, { resolve, reject });
      this.server.stdin.write(JSON.stringify({ id, method, params }) + '\n');
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Timeout'));
        }
      }, 15000);
    });
  }

  handleResponse(response) {
    const { id, code, data, error } = response;
    const pending = this.pendingRequests.get(id);
    if (!pending) return;
    this.pendingRequests.delete(id);
    code === 0 ? pending.resolve(data) : pending.reject(new Error(error?.message || 'Failed'));
  }

  async close() {
    if (this.server) this.server.kill();
  }
}

async function runTests() {
  const client = new TestClient();
  try {
    console.log('=== 启动服务器 ===\n');
    await client.startServer();

    const health = await client.request('health', {});
    console.log(`✅ 加载 ${health.sources.length} 个音源\n`);

    console.log('=== 测试所有音源 ===\n');

    for (const source of health.sources) {
      console.log(`\n【${source.name}】(${source.type})`);

      try {
        // 搜索测试
        const searchResult = await client.request('search', {
          keyword: '周杰伦',
          source: source.name,
          page: 1,
          limit: 1,
        });

        if (searchResult.songs?.length > 0) {
          const song = searchResult.songs[0];
          console.log(`  ✅ 搜索: "${song.name}" - ${song.singer}`);

          // 播放链接测试
          try {
            const urlResult = await client.request('getMusicUrl', {
              source: source.name,
              musicInfo: song,
              quality: '320k',
            });

            if (urlResult.url) {
              console.log(`  ✅ 播放: ${urlResult.url}`);
              console.log(`  📊 状态: 完全可用 ⭐⭐⭐⭐⭐`);
            } else {
              console.log(`  ⚠️  播放: 空URL`);
              console.log(`  📊 状态: 仅搜索 ⭐⭐⭐`);
            }
          } catch (err) {
            console.log(`  ❌ 播放: ${err.message}`);
            console.log(`  📊 状态: 仅搜索 ⭐⭐⭐`);
          }
        } else {
          console.log(`  ❌ 搜索: 无结果`);
          console.log(`  📊 状态: 不可用 ⭐`);
        }
      } catch (err) {
        console.log(`  ❌ 错误: ${err.message}`);
        console.log(`  📊 状态: 失败 ⭐`);
      }
    }

    console.log('\n\n=== 测试完成 ===');
  } catch (err) {
    console.error('测试失败:', err);
  } finally {
    await client.close();
  }
}

runTests();
