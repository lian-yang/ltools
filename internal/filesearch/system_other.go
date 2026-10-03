//go:build !windows

package filesearch

import "context"

func platformRoots() []string              { return nil }
func systemPaths(context.Context) []string { return nil }
