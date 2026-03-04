//go:build darwin

package plugins

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Foundation -framework ApplicationServices

#import <Foundation/Foundation.h>
#import <ApplicationServices/ApplicationServices.h>

// Check if the app has accessibility permissions
int checkAccessibilityPermissions() {
    NSDictionary *options = @{(__bridge id)kAXTrustedCheckOptionPrompt: @NO};
    BOOL accessibilityEnabled = AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
    return accessibilityEnabled ? 1 : 0;
}
*/
import "C"
import (
	"fmt"
	"log"
	"os/exec"
	"runtime"
)

// CheckAccessibilityPermissions checks if the app has accessibility permissions on macOS
func CheckAccessibilityPermissions() (bool, error) {
	if runtime.GOOS != "darwin" {
		return true, nil // Non-macOS platforms don't need this check
	}

	enabled := C.checkAccessibilityPermissions()
	return enabled == 1, nil
}

// OpenAccessibilitySettings opens System Preferences to the Accessibility section
func OpenAccessibilitySettings() error {
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("this function is only available on macOS")
	}

	// Use the 'open' command to open System Preferences to the Accessibility section
	cmd := exec.Command("open", "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
	if err := cmd.Run(); err != nil {
		log.Printf("[Permissions] Failed to open System Preferences: %v", err)
		return fmt.Errorf("failed to open System Preferences: %w", err)
	}

	log.Println("[Permissions] Opening System Preferences > Privacy & Security > Accessibility")
	return nil
}
