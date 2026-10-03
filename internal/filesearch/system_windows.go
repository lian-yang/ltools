//go:build windows

package filesearch

import (
	"context"
	"encoding/json"
	"os/exec"
	"strings"
	"time"

	"golang.org/x/sys/windows/registry"
	"ltools/internal/processutil"
)

func platformRoots() []string {
	key, err := registry.OpenKey(registry.CURRENT_USER, `Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders`, registry.QUERY_VALUE)
	if err != nil {
		return nil
	}
	defer key.Close()
	var roots []string
	for _, name := range []string{"Desktop", "Personal", "My Pictures", "My Music", "My Video", "{374DE290-123F-4565-9164-39C4925E467B}"} {
		value, _, err := key.GetStringValue(name)
		if err != nil {
			continue
		}
		expanded, err := registry.ExpandString(value)
		if err == nil && expanded != "" {
			roots = append(roots, expanded)
		}
	}
	return roots
}

func systemPaths(parent context.Context) []string {
	ctx, cancel := context.WithTimeout(parent, 8*time.Second)
	defer cancel()
	const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'
$connection = New-Object -ComObject ADODB.Connection
try {
  $connection.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
  $rs = $connection.Execute("SELECT TOP 100000 System.ItemPathDisplay FROM SystemIndex WHERE System.ItemPathDisplay IS NOT NULL AND System.ItemType <> 'Directory' ORDER BY System.DateModified DESC")
  $paths = [System.Collections.Generic.List[string]]::new()
  while (!$rs.EOF) { $p = $rs.Fields.Item(0).Value; if ($p -is [string] -and $p -match '^[A-Za-z]:\\') { $paths.Add($p) }; $rs.MoveNext() }
  ConvertTo-Json -InputObject @($paths.ToArray()) -Compress
} finally { if ($connection.State -ne 0) { $connection.Close() } }
`
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	processutil.Background(cmd)
	output, err := cmd.Output()
	if err != nil {
		return nil
	}
	var paths []string
	_ = json.Unmarshal([]byte(strings.TrimSpace(string(output))), &paths)
	return paths
}
