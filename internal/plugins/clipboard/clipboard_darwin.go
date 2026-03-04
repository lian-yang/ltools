//go:build darwin

package clipboard

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

// Static variable to hold image data between calls
static NSData *g_imageData = nil;

// SetPNGToClipboard sets PNG image data to the clipboard on macOS
int SetPNGToClipboard(const void *data, size_t length) {
    @autoreleasepool {
        // Create NSData from the PNG data
        NSData *pngData = [NSData dataWithBytes:data length:length];

        // Create NSImage from PNG data
        NSImage *image = [[NSImage alloc] initWithData:pngData];
        if (!image) {
            return 0;
        }

        // Get the pasteboard
        NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];

        // Clear the pasteboard and declare types
        [pasteboard clearContents];
        NSArray *types = @[@"public.png", @"PNG data"];
        [pasteboard declareTypes:types owner:nil];

        // Write the image to the pasteboard
        BOOL success = [pasteboard setData:pngData forType:@"public.png"];
        if (!success) {
            // Try alternative type
            success = [pasteboard setData:pngData forType:@"PNG data"];
        }

        return success ? 1 : 0;
    }
}

// GetImageFromClipboard gets image data from the clipboard on macOS
// Returns a pointer to the data (valid until next call) or NULL if no image
const void* GetImageFromClipboard() {
    @autoreleasepool {
        // Release previous data
        if (g_imageData != nil) {
            [g_imageData release];
            g_imageData = nil;
        }

        // Get the pasteboard
        NSPasteboard *pasteboard = [NSPasteboard generalPasteboard];

        // Check for available image types
        NSArray *supportedTypes = @[
            @"public.png",
            @"PNG data",
            @"public.tiff",
            @"NSTIFFPboardType",
            @"public.jpeg",
            @"JPEG data"
        ];

        NSString *availableType = [pasteboard availableTypeFromArray:supportedTypes];
        if (!availableType) {
            return NULL;
        }

        // Get the data
        NSData *data = [pasteboard dataForType:availableType];
        if (!data || [data length] == 0) {
            return NULL;
        }

        // If it's TIFF, convert to PNG
        if ([availableType isEqualToString:@"public.tiff"] ||
            [availableType isEqualToString:@"NSTIFFPboardType"]) {
            NSImage *image = [[NSImage alloc] initWithData:data];
            if (!image) {
                return NULL;
            }

            // Convert to PNG representation
            CGImageRef cgImage = [image CGImageForProposedRect:NULL context:nil hints:nil];
            if (!cgImage) {
                [image release];
                return NULL;
            }

            NSBitmapImageRep *imageRep = [[NSBitmapImageRep alloc] initWithCGImage:cgImage];
            NSData *pngData = [imageRep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
            [imageRep release];
            [image release];

            if (!pngData) {
                return NULL;
            }

            g_imageData = [pngData retain];
        } else {
            // Already PNG or JPEG, use directly
            g_imageData = [data retain];
        }

        return [g_imageData bytes];
    }
}

// GetImageDataLength returns the length of the image data
size_t GetImageDataLength() {
    if (g_imageData == nil) {
        return 0;
    }
    return [g_imageData length];
}
*/
import "C"
import (
	"bytes"
	"log"
)

// SetImage sets an image to the clipboard on macOS
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

	// 验证 PNG 签名
	if len(imgData) >= 8 {
		log.Printf("[Screenshot] PNG signature: %x", imgData[:8])
	}

	// Convert Go slice to C pointer
	log.Printf("[Screenshot] Converting data to C pointer...")
	data := C.CBytes(imgData)
	defer C.free(data)

	// Call the C function
	log.Printf("[Screenshot] Calling SetPNGToClipboard...")
	success := C.SetPNGToClipboard(data, C.size_t(len(imgData)))

	if success == 0 {
		log.Printf("[Screenshot] ✗ Failed to set image to clipboard")
		return &ClipboardSetError{}
	}

	log.Printf("[Screenshot] ✓ Successfully set image to clipboard")
	return nil
}

// GetImage gets an image from the clipboard on macOS
func (c *ImageClipboard) GetImage() ([]byte, error) {
	//log.Printf("[Clipboard] Getting image from macOS clipboard...")

	// Use CGO to access NSPasteboard
	data := C.GetImageFromClipboard()
	if data == nil {
		//log.Printf("[Clipboard] No image found in clipboard")
		return nil, &NoImageInClipboardError{}
	}

	// Get the length of the data
	length := C.GetImageDataLength()
	if length == 0 {
		//log.Printf("[Clipboard] Image data is empty")
		return nil, &NoImageInClipboardError{}
	}

	// Copy the data to a Go byte slice
	imgData := C.GoBytes(data, C.int(length))

	//log.Printf("[Clipboard] ✓ Retrieved image from clipboard (%d bytes)", len(imgData))
	return imgData, nil
}
