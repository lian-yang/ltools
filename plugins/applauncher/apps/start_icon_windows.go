//go:build windows

package apps

import (
	"runtime"
	"unsafe"

	"github.com/lxn/win"
	"golang.org/x/sys/windows"
)

// Shell PIDLs retain the icon for shortcuts, packaged apps and browser apps.
func startAppIcon(id string) string {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	ole := windows.NewLazySystemDLL("ole32.dll")
	initialized, _, _ := ole.NewProc("CoInitializeEx").Call(0, 2)
	if initialized == 0 || initialized == 1 {
		defer ole.NewProc("CoUninitialize").Call()
	}
	shell := windows.NewLazySystemDLL("shell32.dll")
	name, err := windows.UTF16PtrFromString("shell:AppsFolder\\" + id)
	if err != nil {
		return ""
	}
	var pidl uintptr
	result, _, _ := shell.NewProc("SHParseDisplayName").Call(uintptr(unsafe.Pointer(name)), 0, uintptr(unsafe.Pointer(&pidl)), 0, 0)
	if int32(result) < 0 || pidl == 0 {
		return ""
	}
	defer ole.NewProc("CoTaskMemFree").Call(pidl)
	var info win.SHFILEINFO
	result, _, _ = shell.NewProc("SHGetFileInfoW").Call(pidl, 0, uintptr(unsafe.Pointer(&info)), unsafe.Sizeof(info), 0x100|0x8)
	if result == 0 || info.HIcon == 0 {
		return ""
	}
	defer win.DestroyIcon(info.HIcon)
	data, _ := encodeWindowsIcon(info.HIcon)
	return data
}
