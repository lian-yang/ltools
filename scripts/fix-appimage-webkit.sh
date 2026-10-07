#!/usr/bin/env bash
# 修复 wails3 打包的 Linux AppImage 中 WebKit 辅助进程无法启动的问题。
#
# 背景：WebKit 的发行版构建（非 DEVELOPER_MODE）把辅助进程
# （WebKitWebProcess / WebKitNetworkProcess）的查找路径硬编码为编译期绝对路径
# /usr/lib/<triplet>/webkit2gtk-4.1，且无任何环境变量或相对路径回退
# （Source/WebKit/Shared/glib/ProcessExecutablePathGLib.cpp 的 findWebKitProcess）。
# 宿主机未安装 webkit2gtk 时（AppImage 目录测试环境、普通用户机器）webview
# 子进程必然 spawn 失败，g_error 直接中止应用。
#
# 处理三步：
#   1. 等长补丁 libwebkit2gtk 内嵌的两处绝对路径前缀为相对路径
#      （"/usr/..." → "usr/..."，去掉开头的 / 并补 NUL，总长不变）
#   2. 替换 AppRun：启动前 cd 到 AppDir（相对路径按进程 CWD 解析），
#      并设置 WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1——webkit 2.40+ 中
#      WEBKIT_FORCE_SANDBOX=0 已不再能禁用沙箱，而容器/嵌套环境下
#      宿主机没有 /usr/bin/bwrap，沙箱初始化会再次致命失败
#   3. mksquashfs 重新打包并拼接回原 runtime
#
# 实现说明：不执行 AppImage 自带的 runtime（--appimage-extract / appimagetool），
# 而是用 squashfs-tools 直接按偏移解包/重打包——本脚本因此在无 FUSE、无
# binfmt 仿真的环境（CI 容器、Docker Desktop Rosetta 等）同样可用。
# 依赖：python3、squashfs-tools（unsquashfs/mksquashfs）。
#
# 用法: fix-appimage-webkit.sh <AppImage 路径>
set -euo pipefail

APPIMAGE="${1:?用法: fix-appimage-webkit.sh <AppImage 路径>}"
APPIMAGE="$(readlink -f "$APPIMAGE")"

for tool in python3 unsquashfs mksquashfs; do
  command -v "$tool" >/dev/null || { echo "错误：缺少 $tool（apt-get install squashfs-tools python3）" >&2; exit 1; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> 解包 $(basename "$APPIMAGE")（按 squashfs 偏移，不执行 runtime）"
# 魔数 "hsqs" 可能以常量形式出现在 runtime 的 .rodata 里（squashfs-tools 即如此），
# 所以对每个候选偏移用 unsquashfs -l 实际试解，第一个能完整列出内容的即真偏移
CANDIDATES="$(python3 - "$APPIMAGE" <<'PY'
import sys

data = open(sys.argv[1], 'rb').read()
off = 0
while True:
    off = data.find(b'hsqs', off)
    if off < 0:
        break
    print(off)
    off += 4
PY
)"
[ -n "$CANDIDATES" ] || { echo "错误：未找到任何 squashfs 魔数" >&2; exit 1; }
OFFSET=""
for CAND in $CANDIDATES; do
  if unsquashfs -q -l -o "$CAND" "$APPIMAGE" >/dev/null 2>&1; then
    OFFSET="$CAND"
    break
  fi
done
[ -n "$OFFSET" ] || { echo "错误：没有任何候选偏移能通过 unsquashfs 试解" >&2; exit 1; }
echo "squashfs 偏移: $OFFSET"
head -c "$OFFSET" "$APPIMAGE" > "$WORK/runtime.bin"
unsquashfs -q -n -o "$OFFSET" -d "$WORK/squashfs-root" "$APPIMAGE" >/dev/null
SQ="$WORK/squashfs-root"
[ -f "$SQ/AppRun" ] || { echo "错误：解包结果缺少 AppRun" >&2; exit 1; }

echo "==> 补丁 libwebkit2gtk：绝对辅助进程路径 → 相对路径（等长替换）"
python3 - "$SQ" <<'PY'
import glob, sys

sq = sys.argv[1]
# linuxdeploy/wails3 将库平铺在 usr/lib/，也可能保留 usr/lib/<triplet>/ 层级，
# 因此递归查找
candidates = glob.glob(sq + '/usr/lib/**/libwebkit2gtk-4.1.so.0.*', recursive=True)
assert len(candidates) == 1, f'libwebkit2gtk-4.1.so.0.* 找到 {len(candidates)} 个: {candidates}'
p = candidates[0]
with open(p, 'rb') as f:
    data = f.read()

# 注意：长字符串必须先替换，否则短前缀会先破坏长字符串
pairs = [
    (b'/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/injected-bundle/',
     b'usr/lib/x86_64-linux-gnu/webkit2gtk-4.1/injected-bundle/\x00'),
    (b'/usr/lib/x86_64-linux-gnu/webkit2gtk-4.1',
     b'usr/lib/x86_64-linux-gnu/webkit2gtk-4.1\x00'),
]
for old, new in pairs:
    assert len(old) == len(new), f'补丁必须等长: {old!r}'
    count = data.count(old)
    data = data.replace(old, new)
    print(f'{old.decode()!r}: 替换 {count} 处')
    assert count >= 1, '未找到目标字符串，库文件布局可能已变化'

with open(p, 'wb') as f:
    f.write(data)
print('已补丁:', p)
PY

echo "==> 替换 AppRun（cd 到 AppDir + 禁用 webkit 沙箱）"
rm -f "$SQ/AppRun.bin"
mv "$SQ/AppRun" "$SQ/AppRun.bin"
cat > "$SQ/AppRun" <<'EOF'
#!/bin/bash
APPDIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
# WebKit 发行版构建把辅助进程路径硬编码为 PKGLIBEXECDIR（本镜像已补丁为相对
# 路径），相对路径按子进程 CWD 解析，因此必须先切换到 AppDir。
cd "$APPDIR"
# AppImage 运行环境无法保证宿主机存在 /usr/bin/bwrap；禁用 webkit 自带的
# bubblewrap 沙箱（沙箱内再起沙箱也无意义）。
export WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS=1
export LD_LIBRARY_PATH="$APPDIR/usr/lib:$APPDIR/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
EXEC_NAME="$(grep -m1 '^Exec=' "$APPDIR"/*.desktop | cut -d= -f2- | awk '{print $1}')"
exec "$APPDIR/usr/bin/${EXEC_NAME:-ltools}" "$@"
EOF
chmod +x "$SQ/AppRun"

echo "==> 重新打包（mksquashfs + 拼接回原 runtime）"
mksquashfs "$SQ" "$WORK/payload-new.img" -all-root -noappend -no-progress -exit-on-error \
  -comp zstd -Xcompression-level 19 -b 1M >/dev/null
# 先写临时文件再原子替换，避免中途失败截断原 AppImage
cat "$WORK/runtime.bin" "$WORK/payload-new.img" > "$APPIMAGE.tmp"
mv "$APPIMAGE.tmp" "$APPIMAGE"
echo "==> 完成: $APPIMAGE ($(stat -c%s "$APPIMAGE" 2>/dev/null || stat -f%z "$APPIMAGE") bytes)"
