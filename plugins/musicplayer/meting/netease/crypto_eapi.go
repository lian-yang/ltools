package netease

import (
	"crypto/aes"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"strings"
)

// 网易云音乐 EAPI 加密常量（来自 Meting Node.js 版本）
const (
	EAPIKey = "e82ckenh8dichen8" // EAPI 加密密钥
)

// encryptEAPI 使用 EAPI 方式加密请求参数
// 这是网易云音乐新版 API 使用的加密方式
func encryptEAPI(urlPath, text string) (string, error) {
	// 1. 构建消息：nobody {url} use {text} md5forencrypt
	message := fmt.Sprintf("nobody%suse%smd5forencrypt", urlPath, text)

	// 2. 计算 MD5 摘要
	digest := md5.Sum([]byte(message))
	digestHex := hex.EncodeToString(digest[:])

	// 3. 构建待加密数据：{url}-36cd479b6b5-{text}-36cd479b6b5-{digest}
	data := fmt.Sprintf("%s-36cd479b6b5-%s-36cd479b6b5-%s", urlPath, text, digestHex)

	// 4. AES-128-ECB 加密
	encrypted, err := aesECBEncrypt([]byte(data), []byte(EAPIKey))
	if err != nil {
		return "", fmt.Errorf("AES encryption failed: %w", err)
	}

	// 5. 转换为大写十六进制字符串
	return strings.ToUpper(hex.EncodeToString(encrypted)), nil
}

// eapiEncryptURL 对完整 URL 进行 EAPI 加密转换
// 将 /api/ 路径替换为 /eapi/
func eapiEncryptURL(originalURL string) string {
	return strings.Replace(originalURL, "/api/", "/eapi/", 1)
}

// aesECBEncrypt 使用 AES-128-ECB 模式加密
func aesECBEncrypt(plaintext, key []byte) ([]byte, error) {
	// 创建 AES 密码块
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	// PKCS7 填充
	blockSize := block.BlockSize()
	plaintext = pkcs7Padding(plaintext, blockSize)

	// ECB 加密（手动实现，因为 Go 标准库不直接支持 ECB）
	ciphertext := make([]byte, len(plaintext))
	for i := 0; i < len(plaintext); i += blockSize {
		block.Encrypt(ciphertext[i:i+blockSize], plaintext[i:i+blockSize])
	}

	return ciphertext, nil
}

// pkcs7Padding PKCS7 填充
func pkcs7Padding(data []byte, blockSize int) []byte {
	padding := blockSize - len(data)%blockSize
	padText := make([]byte, padding)
	for i := range padText {
		padText[i] = byte(padding)
	}
	return append(data, padText...)
}
