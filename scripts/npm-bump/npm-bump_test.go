// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/perses/perses/scripts/pkg/npm"
)

const pluginRuntimeFixture = `      shared: {
        '@perses-dev/spec': {
          version: '0.3.0',
          lib: () => getHostSharedModule('@perses-dev/spec'),
          shareConfig: {
            singleton: true,
            requiredVersion: '^0.3.0',
          },
        },
        '@perses-dev/client': {
          version: '0.56.0-beta.1',
          lib: () => getHostSharedModule('@perses-dev/client'),
          shareConfig: {
            singleton: true,
            requiredVersion: '^0.56.0-beta.1',
          },
        },
        '@perses-dev/components': {
          version: '0.56.0-beta.1',
          lib: () => getHostSharedModule('@perses-dev/components'),
          shareConfig: {
            singleton: true,
            requiredVersion: '^0.56.0-beta.1',
          },
        },
        echarts: {
          version: '6.1.0',
          shareConfig: {
            singleton: true,
            requiredVersion: '^6.1.0',
          },
        },
      },
`

func TestUpdatePluginRuntimeVersions(t *testing.T) {
	workspaces := []string{"components", "client"}
	// Only the two workspace packages change: @perses-dev/spec and echarts keep their version.
	expected := strings.ReplaceAll(pluginRuntimeFixture, "0.56.0-beta.1", "1.2.3")

	got, err := updatePluginRuntimeVersions([]byte(pluginRuntimeFixture), workspaces, "1.2.3")
	if err != nil {
		t.Fatalf("updatePluginRuntimeVersions() error = %v", err)
	}
	if string(got) != expected {
		t.Errorf("updatePluginRuntimeVersions() = %s, expected %s", got, expected)
	}

	// Updating again with the same version changes nothing.
	again, err := updatePluginRuntimeVersions(got, workspaces, "1.2.3")
	if err != nil {
		t.Fatalf("second updatePluginRuntimeVersions() error = %v", err)
	}
	if string(again) != expected {
		t.Errorf("second updatePluginRuntimeVersions() = %s, expected %s", again, expected)
	}
}

func TestUpdatePluginRuntimeVersions_MissingPackage(t *testing.T) {
	_, err := updatePluginRuntimeVersions([]byte(pluginRuntimeFixture), []string{"components", "dashboards"}, "1.2.3")
	if err == nil {
		t.Fatal("updatePluginRuntimeVersions() error = nil, expected an error for a package that is not shared")
	}
	if !strings.Contains(err.Error(), "@perses-dev/dashboards") {
		t.Errorf("updatePluginRuntimeVersions() error = %q, expected it to name @perses-dev/dashboards", err)
	}
}

// TestUpdatePluginRuntimeVersions_RepositoryFile checks the real plugin runtime of the repository: every workspace
// package must be declared in it, and only the two versions of each of them are updated.
func TestUpdatePluginRuntimeVersions_RepositoryFile(t *testing.T) {
	const repositoryRoot = "../.."
	const version = "999.999.999"

	workspaces, err := npm.GetWorkspaces(repositoryRoot)
	if err != nil {
		t.Fatalf("unable to read the workspaces: %v", err)
	}
	if len(workspaces) == 0 {
		t.Fatal("no workspace found in the root package.json")
	}
	data, err := os.ReadFile(filepath.Join(repositoryRoot, pluginRuntimePath))
	if err != nil {
		t.Fatalf("unable to read %s: %v", pluginRuntimePath, err)
	}

	got, err := updatePluginRuntimeVersions(data, workspaces, version)
	if err != nil {
		t.Fatalf("updatePluginRuntimeVersions() error = %v", err)
	}
	if count := strings.Count(string(got), version); count != 2*len(workspaces) {
		t.Errorf("the version appears %d times in the updated plugin runtime, expected %d", count, 2*len(workspaces))
	}
}
