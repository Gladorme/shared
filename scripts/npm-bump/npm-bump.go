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
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/perses/perses/scripts/pkg/npm"
	"github.com/sirupsen/logrus"
)

var versionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+(?:-[\w\d.]+)?$`)

// pluginRuntimePath is the file declaring the version of the packages shared with the plugins.
const pluginRuntimePath = "plugin-system/src/remote/PluginRuntime.tsx"

// updatePluginRuntimeVersions sets the version of every workspace package shared with the plugins by the module
// federation runtime. Each of them is declared in the plugin runtime with a `version` and a `requiredVersion`.
// It returns an error when a workspace package is not declared there, to never release a runtime that is not aligned.
func updatePluginRuntimeVersions(data []byte, workspaces []string, newVersion string) ([]byte, error) {
	for _, workspace := range workspaces {
		sharedModule := regexp.MustCompile(fmt.Sprintf(`(?s)('@perses-dev/%s': \{\s*version: ')[^']*(',.*?requiredVersion: '\^)[^']*(')`, regexp.QuoteMeta(workspace)))
		if !sharedModule.Match(data) {
			return nil, fmt.Errorf("unable to find the shared module @perses-dev/%s in %s", workspace, pluginRuntimePath)
		}
		data = sharedModule.ReplaceAll(data, []byte(fmt.Sprintf("${1}%s${2}%s${3}", newVersion, newVersion)))
	}
	return data, nil
}

func updatePackageVersion(workspaces []string, workspacePath string, newVersion string) error {
	pkgPath := filepath.Join(workspacePath, "package.json")
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		logrus.WithError(err).Fatalf("unable to read the file %s", pkgPath)
	}

	// First, update the package version in the package.json
	bumpVersion := regexp.MustCompile(`"version":\s*"[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc)\.[0-9]+)?"`)
	data = bumpVersion.ReplaceAll(data, []byte(fmt.Sprintf(`"version": "%s"`, newVersion)))

	// Then, update all @perses-dev/* dependencies to the new version
	for _, workspace := range workspaces {
		bumpNPMDeps := regexp.MustCompile(fmt.Sprintf(`"@perses-dev/%s":\s*"(\^)?[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc)\.[0-9]+)?"`, workspace))
		data = bumpNPMDeps.ReplaceAll(data, []byte(fmt.Sprintf(`"@perses-dev/%s": "%s"`, workspace, newVersion)))
	}
	if writeErr := os.WriteFile(pkgPath, data, 0644); writeErr != nil {
		logrus.WithError(writeErr).Fatalf("unable to write the file %s", pkgPath)
	}
	return nil
}

func main() {
	flag.Parse()

	if len(flag.Args()) == 0 {
		logrus.Fatal("version argument is required. Usage: npm-bump <version>")
	}

	version := flag.Args()[0]

	if !versionPattern.MatchString(version) {
		logrus.Fatalf("Invalid semantic version format: %s. Expected format: X.Y.Z or X.Y.Z-prerelease", version)
	}

	workspaces := npm.MustGetWorkspaces(".")
	if len(workspaces) == 0 {
		logrus.Info("No workspaces found")
		return
	}

	// The plugin runtime is read and updated in memory first: if a package is missing there, nothing is written.
	pluginRuntime, err := os.ReadFile(pluginRuntimePath)
	if err != nil {
		logrus.WithError(err).Fatalf("unable to read the file %s", pluginRuntimePath)
	}
	pluginRuntime, err = updatePluginRuntimeVersions(pluginRuntime, workspaces, version)
	if err != nil {
		logrus.WithError(err).Fatal("failed to update the plugin runtime")
	}

	// First, update the root package.json
	if err := updatePackageVersion(workspaces, ".", version); err != nil {
		logrus.WithError(err).Fatal("failed to update root package.json")
	}

	logrus.Infof("Updating %d workspace(s) to version %s", len(workspaces), version)

	for _, workspace := range workspaces {
		if err := updatePackageVersion(workspaces, workspace, version); err != nil {
			logrus.WithError(err).Fatalf("failed to update workspace: %s", workspace)
		}
		logrus.Infof("✓ Updated %s to version %s", workspace, version)
	}

	if writeErr := os.WriteFile(pluginRuntimePath, pluginRuntime, 0644); writeErr != nil {
		logrus.WithError(writeErr).Fatalf("unable to write the file %s", pluginRuntimePath)
	}
	logrus.Infof("✓ Updated %s to version %s", pluginRuntimePath, version)

	logrus.Info("All workspace packages updated successfully")
}
