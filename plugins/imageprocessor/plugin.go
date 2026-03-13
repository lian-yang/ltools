package imageprocessor

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"ltools/internal/plugins"
)

const (
	PluginID      = "imageprocessor.builtin"
	PluginName    = "图片处理"
	PluginVersion = "1.0.0"
)

// ImageProcessorPlugin provides image processing functionality
type ImageProcessorPlugin struct {
	*plugins.BasePlugin
	app        *application.App
	dataDir    string
	processor  *ImageProcessor
	progress   *BatchProgress
	cancelFlag bool
}

// NewImageProcessorPlugin creates a new image processor plugin
func NewImageProcessorPlugin() *ImageProcessorPlugin {
	metadata := &plugins.PluginMetadata{
		ID:          PluginID,
		Name:        PluginName,
		Version:     PluginVersion,
		Author:      "LTools Team",
		Description: "本地批量图片处理，支持压缩、裁剪、水印、隐写术、Favicon 和 OG Image 生成",
		Icon:        "photo",
		Type:        plugins.PluginTypeBuiltIn,
		State:       plugins.PluginStateInstalled,
		Permissions: []plugins.Permission{
			plugins.PermissionFileSystem,
		},
		Keywords:   []string{"图片", "压缩", "裁剪", "水印", "favicon", "og image", "image", "compress", "crop", "watermark"},
		ShowInMenu: plugins.BoolPtr(true),
		HasPage:    plugins.BoolPtr(true),
	}

	return &ImageProcessorPlugin{
		BasePlugin: plugins.NewBasePlugin(metadata),
		progress: &BatchProgress{
			IsRunning: false,
		},
		cancelFlag: false,
	}
}

// Init initializes the plugin
func (p *ImageProcessorPlugin) Init(app *application.App) error {
	if err := p.BasePlugin.Init(app); err != nil {
		return err
	}
	p.app = app
	return nil
}

// SetDataDir sets the data directory for persistence
func (p *ImageProcessorPlugin) SetDataDir(dataDir string) error {
	p.dataDir = dataDir
	return nil
}

// ServiceStartup is called when the application starts
func (p *ImageProcessorPlugin) ServiceStartup(app *application.App) error {
	if err := p.BasePlugin.ServiceStartup(app); err != nil {
		return err
	}
	p.app = app
	p.processor = NewImageProcessor()
	return nil
}

// ServiceShutdown is called when the application shuts down
func (p *ImageProcessorPlugin) ServiceShutdown(app *application.App) error {
	// Cancel any running batch operations
	p.cancelFlag = true
	return p.BasePlugin.ServiceShutdown(app)
}

// Enabled returns true if the plugin is enabled
func (p *ImageProcessorPlugin) Enabled() bool {
	return p.BasePlugin.Enabled()
}

// SetEnabled enables or disables the plugin
func (p *ImageProcessorPlugin) SetEnabled(enabled bool) error {
	return p.BasePlugin.SetEnabled(enabled)
}
