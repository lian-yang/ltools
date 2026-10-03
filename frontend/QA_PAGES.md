# 视觉验收页面清单(dev:mock 模式,端口 9245)

主窗口(带侧栏):
- [] /                              首页仪表盘
- [] /plugins                       插件市场
- [] /settings                      设置-通用
- [] /settings?tab=shortcuts        设置-快捷键
- [] /settings?tab=sync             设置-同步
- [] /settings?tab=plugins          设置-插件
- [] /settings?tab=about            设置-关于
- [] /plugins/clipboard.builtin     剪贴板历史
- [] /plugins/calculator.builtin    计算器
- [] /plugins/datetime.builtin      日期时间
- [] /plugins/jsoneditor.builtin    JSON 编辑器
- [] /plugins/sysinfo.builtin       系统信息
- [] /plugins/processmanager.builtin 进程管理
- [] /plugins/hosts.builtin         Hosts
- [] /plugins/tunnel.builtin        内网穿透
- [] /plugins/qrcode.builtin        二维码
- [] /plugins/password.builtin      密码生成
- [] /plugins/kanban.builtin        看板
- [] /plugins/markdown.builtin      Markdown
- [] /plugins/bookmark.builtin      书签
- [] /plugins/sticky.builtin        便签
- [] /plugins/vault.builtin         密码库
- [] /plugins/ipinfo.builtin        IP 信息
- [] /plugins/imagebed.builtin      图床
- [] /plugins/imageprocessor.builtin 图片处理
- [] /plugins/localtranslate.builtin 本地翻译
- [] /plugins/musicplayer.builtin   音乐播放
- [] /plugins/screenshot2.builtin   截图

独立窗口(无侧栏,宽高特殊):
- [] /search                        全局搜索(400×560)
- [] /sticky-window                 便签窗(240×240)
- [] /localtranslate-window         翻译窗
- [] /music-player                  音乐播放器窗

验收要点(每页):
1. 无紫色/渐变/发光残留;强调色面积克制
2. 侧栏选中态、hover 态正确
3. 列表空态/加载态渲染
4. 数字 tnum、代码 font-mono
5. 900×600 与 1440×900 两档不破版
