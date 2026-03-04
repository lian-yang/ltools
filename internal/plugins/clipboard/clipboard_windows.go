//go:build windows && cgo

package clipboard

/*
#cgo windows CFLAGS: -O2 -g
#cgo windows LDFLAGS: -lgdi32 -lmsimg32

#include <windows.h>
#include <stdint.h>

// SetPNGToClipboard sets PNG image data to the clipboard on Windows
BOOL SetPNGToClipboard(const void *data, size_t length) {
    if (!data || length == 0) {
        return FALSE;
    }

    // Open clipboard
    if (!OpenClipboard(NULL)) {
        return FALSE;
    }

    // Empty clipboard
    if (!EmptyClipboard()) {
        CloseClipboard();
        return FALSE;
    }

    // Allocate global memory for the PNG data
    HGLOBAL hMem = GlobalAlloc(GMEM_MOVEABLE, length);
    if (!hMem) {
        CloseClipboard();
        return FALSE;
    }

    // Lock the memory and copy data
    void *pMem = GlobalLock(hMem);
    if (!pMem) {
        GlobalFree(hMem);
        CloseClipboard();
        return FALSE;
    }

    CopyMemory(pMem, data, length);
    GlobalUnlock(hMem);

    // Set clipboard data with PNG format
    // Register PNG format if not already registered
    static UINT cfPNG = 0;
    if (cfPNG == 0) {
        cfPNG = RegisterClipboardFormatA("PNG");
        if (cfPNG == 0) {
            // Fallback to CF_DIB if PNG format registration fails
            cfPNG = CF_DIB;
        }
    }

    HANDLE hResult = SetClipboardData(cfPNG, hMem);
    if (!hResult) {
        GlobalFree(hMem);
        CloseClipboard();
        return FALSE;
    }

    // Close clipboard
    CloseClipboard();
    return TRUE;
}

// CreateDIBFromPNG creates a DIB from PNG data for clipboard compatibility
// This is a fallback helper function for applications that don't support PNG format
BOOL CreateDIBFromPNG(const void *pngData, size_t pngLength, HGLOBAL *phDIB, BITMAPINFO **ppbmi) {
    // This is a placeholder for PNG to DIB conversion
    // In a full implementation, you would:
    // 1. Decode the PNG data (using stb_image or similar)
    // 2. Create a DIB with the decoded pixel data
    // 3. Return the DIB handle

    // For now, we'll rely on the PNG format which is widely supported
    // on modern Windows applications
    return FALSE;
}
*/
import "C"
import (
	"bytes"
	"log"
	"unsafe"
)

// SetImage sets an image to the clipboard on Windows
func (c *ImageClipboard) SetImage(imgData []byte) error {
	log.Printf("[Screenshot] SetImage called with %d bytes", len(imgData))

	if len(imgData) == 0 {
		log.Printf("[Screenshot] Error: empty image data")
		return &InvalidImageError{}
	}

	// 验证 PNG 格式（前 8 字节应该是 PNG 签名）
	if len(imgData) < 8 {
		log.Printf("[Screenshot] Error: image data too small (%d bytes)", len(imgData))
		return &InvalidImageError{}
	}

	pngSignature := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	if !bytes.Equal(imgData[:8], pngSignature) {
		log.Printf("[Screenshot] Warning: data may not be PNG format (first 8 bytes: %x)", imgData[:8])
		return &InvalidImageError{}
	}

	// Verify PNG signature
	if len(imgData) >= 8 {
		log.Printf("[Screenshot] PNG signature: %x", imgData[:8])
	}

	// Call the C function
	log.Printf("[Screenshot] Calling SetPNGToClipboard...")
	success := C.SetPNGToClipboard(unsafe.Pointer(&imgData[0]), C.size_t(len(imgData)))

	if success == 0 {
		log.Printf("[Screenshot] ✗ Failed to set image to clipboard")
		return &ClipboardSetError{}
	}

	log.Printf("[Screenshot] ✓ Successfully set image to clipboard")
	return nil
}

// GetImage gets an image from the clipboard on Windows
func (c *ImageClipboard) GetImage() ([]byte, error) {
	log.Printf("[Screenshot] Getting image from Windows clipboard...")

	// Open clipboard
	if C.OpenClipboard(nil) == 0 {
		return nil, &ClipboardSetError{}
	}
	defer C.CloseClipboard()

	// Try PNG format first
	cfPNG := C.RegisterClipboardFormat(C.CString("PNG"))
	if cfPNG != 0 {
		hData := C.GetClipboardData(cfPNG)
		if hData != nil {
			// Lock the memory to get a pointer
			pData := C.GlobalLock(hData)
			if pData != nil {
				defer C.GlobalUnlock(hData)

				// Get the size of the data
				size := C.GlobalSize(hData)
				if size > 0 {
					// Copy the data
					imgData := C.GoBytes(unsafe.Pointer(pData), C.int(size))
					log.Printf("[Screenshot] ✓ Retrieved image from clipboard (%d bytes)", len(imgData))
					return imgData, nil
				}
			}
		}
	}

	// Fallback to DIB format if PNG is not available
	hData := C.GetClipboardData(C.CF_DIB)
	if hData != nil {
		// TODO: Convert DIB to PNG
		// This would require decoding the DIB and encoding to PNG
		log.Printf("[Screenshot] Warning: DIB format not yet supported for reading")
		return nil, &UnsupportedPlatformError{Platform: "windows"}
	}

	log.Printf("[Screenshot] ✗ No image found in clipboard")
	return nil, &NoImageInClipboardError{}
}

// equalBytes compares two byte slices
func equalBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
