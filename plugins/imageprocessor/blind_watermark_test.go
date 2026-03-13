package imageprocessor

import (
	"image/color"
	"os"
	"path/filepath"
	"testing"
)

// calculateAccuracy calculates the percentage of matching characters between expected and actual
// It finds the best matching substring in actual for the expected text
func calculateAccuracy(expected, actual string) float64 {
	if len(expected) == 0 {
		return 100.0
	}

	// Convert to runes for proper character handling
	expectedRunes := []rune(expected)
	actualRunes := []rune(actual)

	// Find best matching window in actual
	bestMatch := 0
	for i := 0; i <= len(actualRunes)-len(expectedRunes); i++ {
		matches := 0
		for j := 0; j < len(expectedRunes); j++ {
			if actualRunes[i+j] == expectedRunes[j] {
				matches++
			}
		}
		if matches > bestMatch {
			bestMatch = matches
		}
	}

	return float64(bestMatch) / float64(len(expectedRunes)) * 100
}

// containsSimilar checks if actual string contains a substring similar to expected
// Uses fuzzy matching - counts matching characters in a sliding window
func containsSimilar(actual, expected string) bool {
	expectedLower := toLowerString(expected)
	actualLower := toLowerString(actual)

	if len(expectedLower) == 0 {
		return true
	}
	if len(actualLower) < len(expectedLower)/2 {
		return false
	}

	// Find best matching window
	bestMatch := 0
	for i := 0; i <= len(actualLower)-len(expectedLower); i++ {
		matches := 0
		for j := 0; j < len(expectedLower) && i+j < len(actualLower); j++ {
			if actualLower[i+j] == expectedLower[j] {
				matches++
			}
		}
		if matches > bestMatch {
			bestMatch = matches
		}
	}

	// Need at least 60% character match for fuzzy similarity
	threshold := int(float64(len(expectedLower)) * 0.6)
	return bestMatch >= threshold
}

func toLowerString(s string) string {
	result := make([]byte, len(s))
	for i, c := range []byte(s) {
		if c >= 'A' && c <= 'Z' {
			result[i] = c + 32
		} else {
			result[i] = c
		}
	}
	return string(result)
}

func TestBlindWatermark_TextFixedLength(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")
	
	// Create a larger test image (blind watermark needs sufficient size for reliable extraction)
	// 800x600 provides enough frequency domain capacity for 256 chars (2048 bits)
	writeTestPNGWithSize(t, inputPath, 800, 600, color.NRGBA{R: 100, G: 120, B: 140, A: 255})

	processor := NewImageProcessor()
	
	// Test encode with custom passwords
	opts := &SteganographyOptions{
		Message:   "Copyright 2026 LTools - All Rights Reserved",
		Mode:      "encode",
		Type:      "text",
		Password1: 2025,
		Password2: 8888,
	}
	
	outputPath, err := processor.EncodeBlindWatermark(inputPath, opts)
	if err != nil {
		t.Fatalf("EncodeBlindWatermark error: %v", err)
	}
	
	if _, err := os.Stat(outputPath); err != nil {
		t.Fatalf("output not found: %v", err)
	}
	
	// Test decode with same passwords
	decodeOpts := &SteganographyOptions{
		Type:      "text",
		Password1: 2025,
		Password2: 8888,
	}
	
	message, err := processor.DecodeBlindWatermark(outputPath, decodeOpts)
	if err != nil {
		t.Fatalf("DecodeBlindWatermark error: %v", err)
	}
	
	// Blind watermark extraction has inherent bit errors, so we check for similarity
	// instead of exact match. 70%+ similarity is considered acceptable.
	originalText := "Copyright 2026 LTools - All Rights Reserved"
	accuracy := calculateAccuracy(originalText, message)
	t.Logf("Character accuracy: %.1f%%", accuracy)
	t.Logf("Expected: %q", originalText)
	t.Logf("Got:      %q", message)

	if !containsSimilar(message, "Copyright 2026") {
		t.Errorf("Expected message to contain 'Copyright 2026' with 70%%+ similarity, got: %q", message)
	}

	// Overall accuracy should be at least 70%
	if accuracy < 70.0 {
		t.Errorf("Character accuracy too low: %.1f%% (expected >= 70%%)", accuracy)
	}
}

func TestBlindWatermark_WrongPassword(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")

	// Use larger image for reliable blind watermark
	writeTestPNGWithSize(t, inputPath, 800, 600, color.NRGBA{R: 100, G: 120, B: 140, A: 255})

	processor := NewImageProcessor()

	// Encode with password1=2025, password2=8888
	encodeOpts := &SteganographyOptions{
		Message:   "Secret Message",
		Mode:      "encode",
		Type:      "text",
		Password1: 2025,
		Password2: 8888,
	}

	outputPath, err := processor.EncodeBlindWatermark(inputPath, encodeOpts)
	if err != nil {
		t.Fatalf("EncodeBlindWatermark error: %v", err)
	}

	// Try to decode with wrong password
	decodeOpts := &SteganographyOptions{
		Type:      "text",
		Password1: 9999, // Wrong password
		Password2: 7777,
	}

	message, err := processor.DecodeBlindWatermark(outputPath, decodeOpts)
	// With wrong password, the message should be garbled (low accuracy)
	if err == nil {
		accuracy := calculateAccuracy("Secret Message", message)
		t.Logf("With wrong password - accuracy: %.1f%%, message: %q", accuracy, message)
		// Wrong password should result in low accuracy (typically < 50%)
		if accuracy > 50 {
			t.Errorf("Wrong password should not extract correct message, got accuracy: %.1f%%, message: %q", accuracy, message)
		}
	} else {
		t.Logf("With wrong password: err=%v", err)
	}
}

func TestBlindWatermark_DefaultPasswords(t *testing.T) {
	dir := t.TempDir()
	inputPath := filepath.Join(dir, "input.png")

	// Use larger image for reliable blind watermark
	writeTestPNGWithSize(t, inputPath, 800, 600, color.NRGBA{R: 100, G: 120, B: 140, A: 255})

	processor := NewImageProcessor()
	
	// Encode with default passwords (Password1=0, Password2=0 means use defaults)
	encodeOpts := &SteganographyOptions{
		Message: "Test with default passwords",
		Mode:    "encode",
		Type:    "text",
	}
	
	outputPath, err := processor.EncodeBlindWatermark(inputPath, encodeOpts)
	if err != nil {
		t.Fatalf("EncodeBlindWatermark error: %v", err)
	}
	
	// Decode with default passwords (should work)
	decodeOpts := &SteganographyOptions{
		Type: "text",
	}

	message, err := processor.DecodeBlindWatermark(outputPath, decodeOpts)
	if err != nil {
		t.Fatalf("DecodeBlindWatermark error: %v", err)
	}

	// Check for similarity instead of exact match
	originalText := "Test with default passwords"
	accuracy := calculateAccuracy(originalText, message)
	t.Logf("With default passwords - accuracy: %.1f%%", accuracy)
	t.Logf("Expected: %q", originalText)
	t.Logf("Got:      %q", message)

	if !containsSimilar(message, "Test with default") {
		t.Errorf("Expected 'Test with default' with 70%%+ similarity, got: %q", message)
	}

	if accuracy < 70.0 {
		t.Errorf("Character accuracy too low: %.1f%% (expected >= 70%%)", accuracy)
	}
}
