# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.5.0](https://github.com/denolehov/obsidian-git/compare/v1.2.0...v1.5.0) (2020-12-08)


### Features

* add {{files}} template placeholder ([64adf0f](https://github.com/denolehov/obsidian-git/commit/64adf0f464cfdad544fec225e52798ccbb565d4d))
* add option to toggle pushing to remote


### Bug Fixes

* change "auto push" setting to "disable push" to resolve issues with obsidian settings not loading correctly ([e00014c](https://github.com/denolehov/obsidian-git/commit/e00014cb269efa6391ebeb1d1e0026d209635bfe))
* correctly update `.lastUpdate` timestamp during push/pull ([4b61297](https://github.com/denolehov/obsidian-git/commit/4b61297be84fa7940e2909ddfdd2ef1d8608e20d))
* fix plugin getting stuck at "checking repo status.." message ([4875519](https://github.com/denolehov/obsidian-git/commit/4875519f9986946f0628a343c8ffd94686b86fa4))
* fix status bar messages race conditions ([f3f0a63](https://github.com/denolehov/obsidian-git/commit/f3f0a63132e0cd38c27d0e14c08a8b7c59134a83))

## [1.4.0](https://github.com/denolehov/obsidian-git/compare/v1.3.0...v1.4.0) (2020-11-01)


### Features

* display messages in status bar (including error ones) ([e1e0fcc](https://github.com/denolehov/obsidian-git/commit/e1e0fcc26d5736637239316d5881a696f78eca30))

## [1.3.0](https://github.com/denolehov/obsidian-git/compare/v1.2.0...v1.3.0) (2020-10-31)


### Features

* add `{{numFiles}}` placeholder ([fbc6ce8](https://github.com/denolehov/obsidian-git/commit/fbc6ce85d4f6f2b183c7a41f9cbd8f2814027e92))
* add more granular customization of `{{date}}` commit message placeholder ([7063f5a](https://github.com/denolehov/obsidian-git/commit/7063f5a902c3141671ddbf3c82c2076e07cc872b))

## [1.2.0](https://github.com/denolehov/obsidian-git/compare/v1.1.0...v1.2.0) (2020-10-31)


### Features

* `master` branch is no longer hardcoded ([dc8f3bd](https://github.com/denolehov/obsidian-git/commit/dc8f3bda9751a358fdd64771eec0c6b25bb07f6d))
* allow specifying `{{date}}` placeholder in commit message ([43c5f6e](https://github.com/denolehov/obsidian-git/commit/43c5f6e509d1284411ff26332b7820710fd51c2f))
* rename "Autosave" to "Vault backup interval" ([26cd1e3](https://github.com/denolehov/obsidian-git/commit/26cd1e371ad5b7076ac1da7575983ba4f6791713))


### Bug Fixes

* fix `undefined` backup settings and rearrange settings a bit ([68f8b84](https://github.com/denolehov/obsidian-git/commit/68f8b8438c9aba3c314ee2baa857bfd1efd587d2))
* register interval functions so Obsidian properly unloads them ([717a538](https://github.com/denolehov/obsidian-git/commit/717a53811ef55907ca804ead83d7db6a4747199f))
* save settings on plugin unload ([67cd7a3](https://github.com/denolehov/obsidian-git/commit/67cd7a3f9303505b86b6399694bf1d8e4c8bff4e))

## [1.1.0](https://github.com/denolehov/obsidian-git/compare/v1.0.0...v1.1.0) (2020-10-29)


### Features

* Add "Disable notifications" setting + some minor fixes ([ec240a7](https://github.com/denolehov/obsidian-git/commit/ec240a7122656e551b93a79ad5af9b7be138b2ec))
* Add an option to automatically fetch updates from remote repository when Obsidian starts ([aa59d29](https://github.com/denolehov/obsidian-git/commit/aa59d29fb23ac5b42d8c6a644fdc413a04931966))
* Add status bar that shows status updates ([80dbf0f](https://github.com/denolehov/obsidian-git/commit/80dbf0f647fe27237bd86174feebe7987a90be63))

## [1.0.0](https://github.com/denolehov/obsidian-git/compare/v0.0.6...v1.0.0) (2020-10-27)


### Bug Fixes

* update some Notice messages ([a97c44e](https://github.com/denolehov/obsidian-git/commit/a97c44e2f5a1581e5bb8ea432deca108df8c7fde))

### [0.0.6](https://github.com/denolehov/obsidian-git/compare/v0.0.5...v0.0.6) (2020-10-27)


### Features

* Add autosave feature ([6f0d6bc](https://github.com/denolehov/obsidian-git/commit/6f0d6bc0b8b84fe6e14fcf1c85e6a6213c9da578))

### [0.0.5](https://github.com/denolehov/obsidian-git/compare/v0.0.4...v0.0.5) (2020-10-27)


### Features

* Add an ability to specify custom commit message (specified in plugin settings) ([ca67112](https://github.com/denolehov/obsidian-git/commit/ca671124c5b2dc5127b76f48ab94e63d1e2b3626))

### [0.0.4](https://github.com/denolehov/obsidian-git/compare/v0.0.3...v0.0.4) (2020-10-27)


### Features

* Improve UX a bit by showing notification of what's happening when user presses hotkey ([c562e74](https://github.com/denolehov/obsidian-git/commit/c562e746d7538923a378104d0204dad1f3f2aa61))

### [0.0.3](https://github.com/denolehov/obsidian-git/compare/v0.0.2...v0.0.3) (2020-10-27)


### Features

* add an ability to push changes to a remote repository ([f229516](https://github.com/denolehov/obsidian-git/commit/f2295165fbd77dd9ed6e4cdd2f6d085b3ee78bfe))

### [0.0.2](https://github.com/denolehov/obsidian-git/compare/v0.0.1...v0.0.2) (2020-10-27)


### Features

* Add an ability to pull changes from remote repository. ([88da6e5](https://github.com/denolehov/obsidian-git/commit/88da6e5bc01ef5066ab994e69640e0e101ed6b8f))

### 0.0.1 (2020-10-27)
