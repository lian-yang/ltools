// 批量下载和测试 music.json 中的音源
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const musicJson = require('../music.json');

const SOURCES_DIR = path.join(__dirname, '..', 'sources');
const RESULTS_FILE = path.join(__dirname, 'batch-test-results.json');

// 创建测试目录
if (!fs.existsSync(SOURCES_DIR)) {
  fs.mkdirSync(SOURCES_DIR, { recursive: true });
}

const results = [];

// 下载单个文件
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 处理重定向
        downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// 测试单个插件
async function testPlugin(pluginPath) {
  try {
    // 清除缓存
    delete require.cache[require.resolve(pluginPath)];

    const plugin = require(pluginPath);

    if (!plugin || !plugin.platform) {
      return { valid: false, error: 'Invalid plugin format' };
    }

    const info = {
      valid: true,
      platform: plugin.platform,
      version: plugin.version || 'unknown',
      author: plugin.author || 'unknown',
      supportedSearchType: plugin.supportedSearchType || [],
    };

    // 测试搜索功能
    if (plugin.search && plugin.supportedSearchType?.includes('music')) {
      try {
        const searchResult = await Promise.race([
          plugin.search('周杰伦', 1, 'music'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        info.searchTest = {
          success: true,
          resultCount: searchResult?.data?.length || searchResult?.length || 0
        };
      } catch (err) {
        info.searchTest = {
          success: false,
          error: err.message
        };
      }
    }

    return info;
  } catch (err) {
    return {
      valid: false,
      error: err.message
    };
  }
}

// 主函数
async function main() {
  console.log('=== 批量音源测试开始 ===\n');
  console.log(`总共 ${musicJson.plugins.length} 个音源待测试\n`);

  for (let i = 0; i < musicJson.plugins.length; i++) {
    const pluginUrl = musicJson.plugins[i].url;
    const fileName = path.basename(pluginUrl);
    const filePath = path.join(SOURCES_DIR, fileName);

    console.log(`[${i + 1}/${musicJson.plugins.length}] 测试: ${fileName}`);

    const result = {
      url: pluginUrl,
      fileName,
      downloaded: false,
      testResult: null
    };

    try {
      // 下载
      if (!fs.existsSync(filePath)) {
        await downloadFile(pluginUrl, filePath);
      }
      result.downloaded = true;

      // 测试
      result.testResult = await testPlugin(filePath);

      if (result.testResult.valid) {
        console.log(`  ✅ 有效: ${result.testResult.platform} v${result.testResult.version}`);
        if (result.testResult.searchTest) {
          if (result.testResult.searchTest.success) {
            console.log(`     搜索测试: ✅ 找到 ${result.testResult.searchTest.resultCount} 首歌曲`);
          } else {
            console.log(`     搜索测试: ❌ ${result.testResult.searchTest.error}`);
          }
        }
      } else {
        console.log(`  ❌ 无效: ${result.testResult.error}`);
      }
    } catch (err) {
      result.error = err.message;
      console.log(`  ❌ 下载失败: ${err.message}`);
    }

    results.push(result);
    console.log('');

    // 保存中间结果
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  }

  // 统计
  const validPlugins = results.filter(r => r.testResult?.valid);
  const searchablePlugins = validPlugins.filter(r => r.testResult?.searchTest?.success);

  console.log('\n=== 测试完成 ===\n');
  console.log(`✅ 有效插件: ${validPlugins.length}/${musicJson.plugins.length}`);
  console.log(`🔍 可搜索插件: ${searchablePlugins.length}/${musicJson.plugins.length}`);
  console.log(`📊 结果已保存: ${RESULTS_FILE}`);

  // 列出推荐插件
  if (searchablePlugins.length > 0) {
    console.log('\n=== 推荐插件（支持搜索）===\n');
    searchablePlugins.forEach(p => {
      console.log(`✅ ${p.testResult.platform} v${p.testResult.version} (${p.testResult.author})`);
      console.log(`   文件: ${p.fileName}`);
      console.log(`   搜索结果: ${p.testResult.searchTest.resultCount} 首歌曲\n`);
    });
  }
}

main().catch(console.error);
