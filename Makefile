SHELL := /bin/bash
.DEFAULT_GOAL := help
NPM ?= npm

.PHONY: help setup setup-submodules build build-native build-share dev smoke test test-desktop test-client test-avatar test-swift test-all docs-check package-mac package-win clean

help: ## Show available targets (npm run has the same commands)
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

setup: ## Install desktop dependencies (npm run setup)
	$(NPM) run setup

setup-submodules: ## Initialize vendor/bloub for avatar builds
	$(NPM) run setup:submodules

build: ## Build the Electron renderer (npm run build)
	$(NPM) run build

build-native: ## Build the macOS native companion (npm run build:native)
	$(NPM) run build:native

build-share: ## Build the macOS share host and 12 extensions (npm run build:share)
	$(NPM) run build:share

dev: ## Build and run the Electron app (npm run dev)
	$(NPM) run dev

smoke: ## Electron UI smoke, isolated workspace (npm run smoke)
	$(NPM) run smoke

test: ## Cross-platform tests (npm test)
	$(NPM) test

test-desktop: ## Electron unit tests
	$(NPM) run test:desktop

test-client: ## Client Protocol SDK tests
	$(NPM) run test:client

test-avatar: ## Bloub avatar renderer test
	$(NPM) run test:avatar

test-swift: ## Swift package tests (macOS only)
	$(NPM) run test:swift

test-all: ## Everything, including Swift
	$(NPM) run test:all

docs-check: ## Validate docs/catalog.json, page status and links
	$(NPM) run docs:check

package-mac: ## Signed + notarized arm64 and x64 DMGs
	$(NPM) run package:mac

package-win: ## Unsigned Windows zip
	$(NPM) run package:win

clean: ## Remove generated build output (keeps node_modules)
	rm -rf desktop/out desktop/native desktop/release desktop/artifacts
	rm -rf native/macos/.build native/macos/dist
