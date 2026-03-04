#!/usr/bin/env node

/**
 * 源管理工具
 *
 * 用于下载、管理和测试 MusicFree 源
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const SOURCES_DIR = path.join(__dirname, 'sources');
const MUSIC_JSON = path.join(__dirname, 'music.json');

/**
 * 下载文件
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;

    console.log(`Downloading: ${url}`);

    const file = fs.createWriteStream(dest);
    client
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // 处理重定向
          downloadFile(response.headers.location, dest).then(resolve).catch(reject);
          return;
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded: ${path.basename(dest)}`);
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {});
        console.error(`❌ Failed: ${path.basename(dest)} - ${err.message}`);
        reject(err);
      });
  });
}

/**
 * 下载所有源
 */
async function downloadAllSources() {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
  }

  const musicJson = JSON.parse(fs.readFileSync(MUSIC_JSON, 'utf8'));
  const plugins = musicJson.plugins;

  console.log(`\n📦 Found ${plugins.length} sources in music.json\n`);

  let success = 0;
  let failed = 0;

  for (const plugin of plugins) {
    const url = plugin.url;
    const filename = path.basename(url);
    const dest = path.join(SOURCES_DIR, filename);

    // 如果文件已存在，跳过
    if (fs.existsSync(dest)) {
      console.log(`⏭️  Skipped (exists): ${filename}`);
      continue;
    }

    try {
      await downloadFile(url, dest);
      success++;
      // 延迟避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      failed++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Downloaded: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${plugins.length - success - failed}\n`);
}

/**
 * 列出已下载的源
 */
function listSources() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.log('No sources directory found');
    return;
  }

  const files = fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.js'));

  console.log(`\n📋 Downloaded sources (${files.length}):\n`);

  files.forEach((file, index) => {
    const filePath = path.join(SOURCES_DIR, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(1);
    console.log(`   ${index + 1}. ${file} (${size} KB)`);
  });

  console.log('');
}

/**
 * 下载指定的源
 */
async function downloadSource(name) {
  if (!fs.existsSync(SOURCES_DIR)) {
    fs.mkdirSync(SOURCES_DIR, { recursive: true });
  }

  const musicJson = JSON.parse(fs.readFileSync(MUSIC_JSON, 'utf8'));
  const plugins = musicJson.plugins;

  const plugin = plugins.find((p) => p.url.includes(name));

  if (!plugin) {
    console.log(`❌ Source "${name}" not found in music.json`);
    return;
  }

  const url = plugin.url;
  const filename = path.basename(url);
  const dest = path.join(SOURCES_DIR, filename);

  try {
    await downloadFile(url, dest);
    console.log(`\n✅ Successfully downloaded: ${filename}\n`);
  } catch (err) {
    console.log(`\n❌ Failed to download: ${err.message}\n`);
  }
}

/**
 * 清理所有源
 */
function cleanSources() {
  if (!fs.existsSync(SOURCES_DIR)) {
    console.log('No sources directory found');
    return;
  }

  const files = fs.readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.js') && f !== 'test-source.js');

  files.forEach((file) => {
    const filePath = path.join(SOURCES_DIR, file);
    fs.unlinkSync(filePath);
    console.log(`🗑️  Deleted: ${file}`);
  });

  console.log(`\n✅ Cleaned ${files.length} source files\n`);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'download':
      if (args[1]) {
        await downloadSource(args[1]);
      } else {
        await downloadAllSources();
      }
      break;

    case 'list':
      listSources();
      break;

    case 'clean':
      cleanSources();
      break;

    default:
      console.log(`
🎵 LX Music Source Manager

Usage:
  node source-manager.js <command> [options]

Commands:
  download [name]  Download all sources or a specific source by name
  list             List all downloaded sources
  clean            Remove all downloaded sources (except test-source.js)

Examples:
  node source-manager.js download        # Download all sources
  node source-manager.js download 6yueting  # Download specific source
  node source-manager.js list            # List downloaded sources
  node source-manager.js clean           # Clean all sources
      `);
  }
}

main().catch(console.error);
