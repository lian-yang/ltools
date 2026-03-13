package imageprocessor

// ProcessingMode represents different image processing modes
type ProcessingMode string

const (
	ModeCompress      ProcessingMode = "compress"      // 图片压缩
	ModeCrop          ProcessingMode = "crop"          // 图片裁剪
	ModeWatermark     ProcessingMode = "watermark"     // 添加水印
	ModeSteganography ProcessingMode = "steganography" // 隐写术
	ModeFavicon       ProcessingMode = "favicon"       // Favicon 生成
)

// ImageFile represents metadata for an image file
type ImageFile struct {
	Path     string `json:"path"`     // 文件路径
	Name     string `json:"name"`     // 文件名
	Size     int64  `json:"size"`     // 文件大小（字节）
	Width    int    `json:"width"`    // 图片宽度
	Height   int    `json:"height"`   // 图片高度
	Format   string `json:"format"`   // 图片格式（jpeg, png, gif, webp）
	Mode     string `json:"mode"`     // 图片模式（RGB, RGBA, etc.）
	Modified int64  `json:"modified"` // 修改时间戳
}

// CompressOptions represents image compression options
type CompressOptions struct {
	Quality      int    `json:"quality"`      // 压缩质量（1-100）
	MaxWidth     int    `json:"maxWidth"`     // 最大宽度（0 表示不限制）
	MaxHeight    int    `json:"maxHeight"`    // 最大高度（0 表示不限制）
	OutputFormat string `json:"outputFormat"` // 输出格式（jpeg, png, webp），空表示保留原格式
}

// CropOptions represents image cropping options
type CropOptions struct {
	X      int `json:"x"`      // 裁剪起点 X 坐标
	Y      int `json:"y"`      // 裁剪起点 Y 坐标
	Width  int `json:"width"`  // 裁剪宽度
	Height int `json:"height"` // 裁剪高度
	// 预设比例（可选）
	AspectRatio string `json:"aspectRatio"` // 宽高比（如 "16:9", "4:3", "1:1"）
}

// WatermarkPosition represents watermark position
type WatermarkPosition string

const (
	PositionSingle WatermarkPosition = "single" // 单个水印（可通过 offsetX/offsetY 定位）
	PositionTile   WatermarkPosition = "tile"   // 平铺水印
)

// WatermarkOptions represents watermark options
type WatermarkOptions struct {
	Type      string            `json:"type"`      // 水印类型：text, image
	Text      string            `json:"text"`      // 文字水印内容
	FontPath  string            `json:"fontPath"`  // 字体文件路径（可选）
	FontFamily string           `json:"fontFamily"` // 字体族名（用于前端渲染）
	FontSize  int               `json:"fontSize"`  // 字体大小
	FontColor string            `json:"fontColor"` // 字体颜色（十六进制，如 #FFFFFF）
	ImagePath string            `json:"imagePath"` // 图片水印路径
	Position  WatermarkPosition `json:"position"`  // 水印位置：single（单个）或 tile（平铺）
	OffsetX   int               `json:"offsetX"`   // X 偏移量（像素），正数向右，负数向左
	OffsetY   int               `json:"offsetY"`   // Y 偏移量（像素），正数向下，负数向上
	Rotation  float64           `json:"rotation"`  // 旋转角度（度），0-360
	Opacity   float64           `json:"opacity"`   // 透明度（0-1）
	Margin    int               `json:"margin"`    // 边距（平铺模式使用）
	Scale     float64           `json:"scale"`     // 水印缩放比例（0-1）
	TileSpacingX int             `json:"tileSpacingX"` // 平铺模式 X 间距
	TileSpacingY int             `json:"tileSpacingY"` // 平铺模式 Y 间距
}

// SteganographyOptions represents blind watermark options
type SteganographyOptions struct {
	Message  string `json:"message"`  // 要嵌入的文本信息
	Mode     string `json:"mode"`     // encode 或 decode
	Type     string `json:"type"`     // 水印类型: text, image
	ImagePath string `json:"imagePath"` // 水印图片路径（Type=image 时使用）
	Password1 int   `json:"password1"` // 密码种子1（默认: 1）
	Password2 int   `json:"password2"` // 密码种子2（默认: 2）
}

// FaviconOptions represents favicon generation options (not used, kept for API compatibility)
type FaviconOptions struct {
	// All standard favicon files are generated automatically:
	// - android-chrome-192x192.png
	// - android-chrome-512x512.png
	// - apple-touch-icon.png (180x180)
	// - favicon-16x16.png
	// - favicon-32x32.png
	// - favicon.ico (48x48)
	// - site.webmanifest
}

// ProcessingRequest represents a batch processing request
type ProcessingRequest struct {
	Files  []string        `json:"files"`  // 文件路径列表
	Mode   ProcessingMode  `json:"mode"`   // 处理模式
	Compress      *CompressOptions      `json:"compress,omitempty"`
	Crop          *CropOptions          `json:"crop,omitempty"`
	Watermark     *WatermarkOptions     `json:"watermark,omitempty"`
	Steganography *SteganographyOptions `json:"steganography,omitempty"`
	Favicon       *FaviconOptions       `json:"favicon,omitempty"`
}

// ProcessingResult represents the result of processing a single file
type ProcessingResult struct {
	InputPath  string `json:"inputPath"`  // 输入文件路径
	OutputPath string `json:"outputPath"` // 输出文件路径
	Success    bool   `json:"success"`    // 是否成功
	Error      string `json:"error"`      // 错误信息（如果有）
	SizeBefore int64  `json:"sizeBefore"` // 处理前大小
	SizeAfter  int64  `json:"sizeAfter"`  // 处理后大小
	Duration   int64  `json:"duration"`   // 处理耗时（毫秒）
}

// BatchProgress represents batch processing progress
type BatchProgress struct {
	Total     int               `json:"total"`     // 总文件数
	Completed int               `json:"completed"` // 已完成数
	Failed    int               `json:"failed"`    // 失败数
	Current   string            `json:"current"`   // 当前处理的文件
	Results   []ProcessingResult `json:"results"`   // 处理结果列表
	StartTime int64             `json:"startTime"` // 开始时间戳
	IsRunning bool              `json:"isRunning"` // 是否正在运行
}

// PreviewResult represents the result of image preview
type PreviewResult struct {
	DataURL string `json:"dataURL"` // Base64 Data URL
	Width   int    `json:"width"`   // 预览宽度
	Height  int    `json:"height"`  // 预览高度
}

// SteganographyDecodeResult represents the result of decoding steganography
type SteganographyDecodeResult struct {
	Success bool   `json:"success"` // 是否成功
	Message string `json:"message"` // 解码出的信息
	Error   string `json:"error"`   // 错误信息
}

// FaviconGenerateResult represents the result of favicon generation
type FaviconGenerateResult struct {
	OutputPath string            `json:"outputPath"` // 输出目录
	Files      map[string]string `json:"files"`      // 生成的文件（文件名 -> 路径）
	Success    bool              `json:"success"`
	Error      string            `json:"error"`
}

// ImageInfo represents detailed image information
type ImageInfo struct {
	ImageFile
	HasAlpha      bool   `json:"hasAlpha"`      // 是否有透明通道
	BitDepth      int    `json:"bitDepth"`      // 位深度
	DPI           int    `json:"dpi"`           // DPI
	ColorProfile  string `json:"colorProfile"`  // 颜色配置文件
	EXIF          map[string]string `json:"exif"` // EXIF 信息
}

// FontInfo represents information about a system font
type FontInfo struct {
	Name       string `json:"name"`       // 字体名称（显示用）
	Family     string `json:"family"`     // 字体族名
	Path       string `json:"path"`       // 字体文件路径
	Style      string `json:"style"`      // 样式（Regular, Bold, Italic 等）
	IsMonospace bool  `json:"isMonospace"` // 是否为等宽字体
}
