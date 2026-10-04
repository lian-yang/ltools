# LTools

<div align="center">

**LTools** - A Plugin-Based Desktop Toolbox

[English](README.en.md) | [简体中文](README.md)

A modern, cross-platform desktop application built with Wails v3, featuring a plugin-based architecture.

[![Go Version](https://img.shields.io/badge/Go-1.25+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![React Version](https://img.shields.io/badge/React-18.2-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Wails](https://img.shields.io/badge/Wails-v3%20alpha-61B4E8?style=flat)](https://v3.wails.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/lian-yang/ltools?include_prereleases)](https://github.com/lian-yang/ltools/releases)

<div align="center">
  <a href="https://github.com/lian-yang/ltools/releases/latest">📥 Download Latest Release</a>
  ·
  <a href="https://github.com/lian-yang/ltools/issues">🐛 Report an Issue</a>
  ·
  <a href="https://github.com/lian-yang/ltools/discussions">💬 Discussions</a>
</div>

</div>

## Screenshots

<div align="center">
  <img src="resource/images/screenshot-01-home.png" alt="Main Window" width="700">
  <p>Main Window</p>
</div>

<div align="center">
  <img src="resource/images/screenshot-09-calculator.png" alt="Calculator" width="700">
  <p>Calculator</p>
</div>

<div align="center">
  <img src="resource/images/screenshot-05-plugins.png" alt="Plugin Market" width="700">
  <p>Plugin Market</p>
</div>

<div align="center">
  <img src="resource/images/screenshot-06-settings.png" alt="Settings" width="700">
  <p>Settings (shortcut configuration)</p>
</div>

## Built-in Plugins

- **🎵 Music Player** - Built-in music source service with multiple sources, synced lyrics and playlists
- **📅 Date & Time** - Live current date, time and weekday
- **🔢 Calculator** - Basic arithmetic with history
- **📋 Clipboard Manager** - Automatically monitors and manages clipboard history
- **💻 System Info** - CPU, memory, uptime and other system stats
- **📝 JSON Editor** - Format, validate and edit JSON data
- **⚙️ Process Manager** - View and manage system processes
- **📸 Screenshot Tool** - Capture, annotate and manage screenshots
- **🔐 Password Generator** - Generate secure random passwords
- **🔖 Bookmark Search** - Search Chrome browser bookmarks
- **🌐 Hosts Manager** - Edit and manage the system hosts file
- **🚇 Tunnel Manager** - FRP tunneling management
- **🔒 Password Vault** - Locally encrypted storage for passwords and secrets
- **🌍 IP Info** - Look up IP address geolocation
- **📌 Sticky Notes** - Desktop sticky notes / pinned images
- **🤖 AI Translation** - Offline translation with local models (Ollama) and cloud APIs
- **📄 Markdown** - Markdown editing and preview
- **📱 QR Code** - Generate QR codes
- **🖼️ Image Host** - Image upload and management (GitHub + jsDelivr)
- **📋 Kanban** - Task board management
- **🚀 App Launcher** - Quickly launch applications

## Core Features

- **🌐 Internationalized** - English UI by default in non-Chinese locales; Chinese is used automatically on Chinese systems. Switch anytime in Settings (Follow System / 中文 / English)
- **🔄 Auto Update** - Checks for updates 10 seconds after launch, supports silent install
- **🔍 Global Search** - Quickly search plugins with a shortcut (Cmd/Ctrl+5)
- **⌨️ Shortcuts** - Customizable global shortcuts to trigger plugin features
- **🎯 System Tray** - Minimize to the system tray and keep running in the background
- **🧩 Plugin Management** - Enable/disable plugins and inspect plugin info
- **🛡️ Permission System** - Fine-grained plugin permission control

## Tech Stack

### Backend
- **Go 1.25+** - Core business logic
- **Wails v3 (alpha)** - Cross-platform desktop framework
- **gohook** - Global shortcut support
- **gopsutil** - System information
- **screenshot** - Screen capture

### Frontend
- **React 18.2** - UI framework
- **TypeScript 5.2** - Type safety
- **Vite 5** - Build tool
- **TailwindCSS 4** - Styling
- **Monaco Editor** - JSON editor

## Project Structure

```
ltools/
├── main.go                 # Application entry
├── internal/
│   └── plugins/            # Plugin core architecture
│       ├── plugin.go       # Plugin interface definitions
│       ├── manager.go      # Plugin manager
│       ├── registry.go     # Plugin registry
│       ├── shortcuts.go    # Shortcut management
│       └── search_window_service.go  # Global search
├── plugins/                # Built-in plugin implementations
│   ├── musicplayer/        # 🎵 Music player (with music source service)
│   ├── datetime/           # Date & Time
│   ├── calculator/         # Calculator
│   ├── clipboard/          # Clipboard manager
│   ├── sysinfo/            # System info
│   ├── jsoneditor/         # JSON editor
│   ├── processmanager/     # Process manager
│   ├── screenshot2/        # Screenshot tool
│   ├── password/           # Password generator
│   ├── bookmark/           # Bookmark search
│   ├── hosts/              # Hosts manager
│   ├── tunnel/             # Tunnel manager
│   ├── vault/              # Password vault
│   ├── ipinfo/             # IP info
│   ├── sticky/             # Sticky notes
│   ├── localtranslate/     # AI translation
│   ├── markdown/           # Markdown editor
│   ├── qrcode/             # QR code
│   ├── imagebed/           # Image host
│   ├── kanban/             # Kanban
│   └── applauncher/        # App launcher
├── lx-music-service/       # Music source service (standalone project)
├── frontend/               # Frontend code
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── i18n/           # i18n runtime + English dictionary
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Page components
│   │   ├── windows/        # Window components
│   │   ├── router/         # Routing
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utilities
│   ├── bindings/           # Auto-generated bindings
│   └── dist/               # Build output
├── scripts/                # Build and release scripts
├── .github/workflows/      # Release CI/CD
└── build/                  # Build configuration
```

## Installation

### Download

Download the latest version from the [Releases](https://github.com/lian-yang/ltools/releases) page:

| Platform | File | Notes |
|------|------|------|
| **macOS** (ARM64) | `ltools-*-darwin-arm64.dmg` | DMG installer (recommended) |
| **macOS** (ARM64) | `ltools-*-darwin-arm64.tar.gz` | Apple Silicon (M1/M2/M3) |
| **macOS** (AMD64) | `ltools-*-darwin-amd64.tar.gz` | Intel Mac |
| **Windows** | `ltools-*-windows-amd64-installer.exe` | NSIS installer |
| **Linux** | `ltools-*-linux-amd64.AppImage` | AppImage (recommended) |
| **Linux** | `ltools-*-linux-amd64.deb` | Debian/Ubuntu |
| **Linux** | `ltools-*-linux-amd64.rpm` | RHEL/CentOS/Fedora |

> **⚠️ Important**: The music player requires **Node.js >= 16.0.0**

### Requirements

- **Go** 1.25 or later (development)
- **Node.js** 16.0 or later (required by the music player)
- **Task** (optional, recommended)

## Building from Source

```bash
# Clone the repository
git clone https://github.com/lian-yang/ltools.git
cd ltools

# Build the frontend
cd frontend && npm install && npm run build && cd ..

# Build the application
wails3 build
```

Or with Task:

```bash
task build
```

## Language / Internationalization

The UI follows your system locale automatically:

- Chinese systems (`zh-*`) → Chinese UI
- All other locales → English UI

You can override this in **Settings → General → Language** (Follow System / 简体中文 / English). The choice is persisted and applies to all windows.

Translation strings live in `frontend/src/i18n/` — the English dictionary is `frontend/src/i18n/locales/en.ts`, keyed by the original Chinese strings with English fallbacks when a key is missing.

## Contributing

Issues and Pull Requests are welcome!

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/awesome-feature`)
3. Commit your changes (`git commit -m 'Add some awesome feature'`)
4. Push to the branch (`git push origin feature/awesome-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Wails](https://wails.io/) - The excellent Go desktop framework
- [React](https://react.dev/) - UI library
- [TailwindCSS](https://tailwindcss.com/) - CSS framework
- All plugin and open-source library authors
