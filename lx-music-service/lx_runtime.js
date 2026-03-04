/**
 * LX Music 自定义源运行时
 *
 * 实现 LX Music Desktop 的自定义源 API 规范
 * 参考: https://lxmusic.toside.cn/desktop/custom-source
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');

/**
 * LX Music API 实现
 */
class LXRuntime {
  constructor() {
    this.sources = new Map(); // 已加载的音源
    this.eventHandlers = new Map(); // 事件处理器

    // 事件名称常量
    this.EVENT_NAMES = {
      request: 'request',
      inited: 'inited',
    };

    // 暴露到 globalThis
    globalThis.lx = this.createLXAPI();
  }

  /**
   * 创建 lx API 对象
   */
  createLXAPI() {
    const self = this;

    return {
      // 事件名称
      EVENT_NAMES: this.EVENT_NAMES,

      // 事件监听
      on: (eventName, handler) => {
        if (!self.eventHandlers.has(eventName)) {
          self.eventHandlers.set(eventName, []);
        }
        self.eventHandlers.get(eventName).push(handler);
      },

      // 发送事件
      send: (eventName, data) => {
        self.handleEvent(eventName, data);
      },

      // HTTP 请求 API（不受跨域限制）
      request: (url, options, callback) => {
        return self.httpRequest(url, options, callback);
      },

      // 加密工具
      utils: {
        crypto: {
          // AES 加密
          aesEncrypt: (data, key, iv) => {
            const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
            let encrypted = cipher.update(data, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            return encrypted;
          },

          // AES 解密
          aesDecrypt: (data, key, iv) => {
            const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
            let decrypted = decipher.update(data, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
          },

          // MD5 哈希
          md5: (data) => {
            return crypto.createHash('md5').update(data).digest('hex');
          },

          // RSA 加密
          rsaEncrypt: (data, publicKey) => {
            return crypto.publicEncrypt(publicKey, Buffer.from(data)).toString('base64');
          },
        },
      },

      // 版本信息
      version: '1.0.0',
    };
  }

  /**
   * HTTP 请求（支持 http/https）
   */
  httpRequest(url, options = {}, callback) {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        callback(null, {
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => {
      callback(err, null);
    });

    req.on('timeout', () => {
      req.destroy();
      callback(new Error('Request timeout'), null);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();

    return req;
  }

  /**
   * 加载自定义源脚本
   */
  async loadScript(scriptPath) {
    try {
      const fs = require('fs');
      const path = require('path');

      const absolutePath = path.resolve(scriptPath);
      const scriptContent = fs.readFileSync(absolutePath, 'utf8');

      // 解析脚本元信息（从注释中提取）
      const metadata = this.parseScriptMetadata(scriptContent);

      console.error(`[LXRuntime] Loading script: ${metadata.name || scriptPath}`);

      // 沙箱化执行脚本
      const scriptFunc = new Function('lx', scriptContent);
      scriptFunc(globalThis.lx);

      const sourceId = metadata.id || path.basename(scriptPath, '.js');
      this.sources.set(sourceId, {
        id: sourceId,
        ...metadata,
        scriptPath: absolutePath,
      });

      console.error(`[LXRuntime] Script loaded successfully: ${sourceId}`);
      return sourceId;
    } catch (err) {
      console.error(`[LXRuntime] Failed to load script ${scriptPath}:`, err.message);
      throw err;
    }
  }

  /**
   * 加载目录中的所有脚本
   */
  async loadScripts(scriptsDir) {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(scriptsDir)) {
      console.error(`[LXRuntime] Scripts directory not found: ${scriptsDir}`);
      return;
    }

    const files = fs.readdirSync(scriptsDir);
    const jsFiles = files.filter((file) => file.endsWith('.js'));

    console.error(`[LXRuntime] Found ${jsFiles.length} scripts in ${scriptsDir}`);

    for (const file of jsFiles) {
      const scriptPath = path.join(scriptsDir, file);
      try {
        await this.loadScript(scriptPath);
      } catch (err) {
        console.error(`[LXRuntime] Skipped ${file} due to error:`, err.message);
      }
    }
  }

  /**
   * 解析脚本元信息（从头部注释）
   */
  parseScriptMetadata(scriptContent) {
    const metadata = {};

    // 提取头部注释块
    const commentMatch = scriptContent.match(/\/\*[\s\S]*?\*\//);
    if (!commentMatch) return metadata;

    const comment = commentMatch[0];

    // 解析元数据字段
    const patterns = {
      name: /@name\s+(.+)/,
      version: /@version\s+(.+)/,
      author: /@author\s+(.+)/,
      description: /@description\s+(.+)/,
      id: /@id\s+(.+)/,
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = comment.match(pattern);
      if (match) {
        metadata[key] = match[1].trim();
      }
    }

    return metadata;
  }

  /**
   * 处理事件
   */
  handleEvent(eventName, data) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[LXRuntime] Error in event handler for ${eventName}:`, err.message);
        }
      });
    }
  }

  /**
   * 处理音源请求
   */
  async handleRequest(source, action, info) {
    return new Promise((resolve, reject) => {
      const requestId = Date.now();

      const requestHandler = (response) => {
        if (response.id === requestId) {
          // 移除监听器
          const handlers = this.eventHandlers.get('response') || [];
          const index = handlers.indexOf(requestHandler);
          if (index > -1) {
            handlers.splice(index, 1);
          }

          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      };

      // 监听响应
      if (!this.eventHandlers.has('response')) {
        this.eventHandlers.set('response', []);
      }
      this.eventHandlers.get('response').push(requestHandler);

      // 发送请求事件
      this.handleEvent(this.EVENT_NAMES.request, {
        id: requestId,
        source,
        action,
        info,
      });
    });
  }

  /**
   * 获取所有已加载的音源
   */
  getSources() {
    return Array.from(this.sources.values());
  }

  /**
   * 获取音源信息
   */
  getSource(sourceId) {
    return this.sources.get(sourceId);
  }
}

module.exports = LXRuntime;
