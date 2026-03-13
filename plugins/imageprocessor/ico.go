package imageprocessor

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"io"
)

// encodeICO writes a single-image ICO file containing a PNG payload.
func encodeICO(w io.Writer, img image.Image) error {
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, img); err != nil {
		return err
	}
	data := pngBuf.Bytes()

	width := img.Bounds().Dx()
	height := img.Bounds().Dy()
	if width >= 256 {
		width = 0
	}
	if height >= 256 {
		height = 0
	}

	// ICONDIR header
	if err := binary.Write(w, binary.LittleEndian, uint16(0)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint16(1)); err != nil {
		return err
	}
	if err := binary.Write(w, binary.LittleEndian, uint16(1)); err != nil {
		return err
	}

	// ICONDIRENTRY
	entry := make([]byte, 16)
	entry[0] = byte(width)
	entry[1] = byte(height)
	entry[2] = 0
	entry[3] = 0
	binary.LittleEndian.PutUint16(entry[4:], 1)                 // planes
	binary.LittleEndian.PutUint16(entry[6:], 32)                // bit count
	binary.LittleEndian.PutUint32(entry[8:], uint32(len(data))) // bytes in resource
	binary.LittleEndian.PutUint32(entry[12:], 6+16)             // image offset

	if _, err := w.Write(entry); err != nil {
		return err
	}

	_, err := w.Write(data)
	return err
}
