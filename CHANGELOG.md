# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.13.0](https://github.com/denolehov/obsidian-git/compare/1.12.0...1.13.0) (2021-09-21)


### Features

* support cloning remote repos ([ab5ece7](https://github.com/denolehov/obsidian-git/commit/ab5ece75ceba3af5845770dc029732d5657720a3))

## [1.12.0](https://github.com/denolehov/obsidian-git/compare/1.11.0...1.12.0) (2021-09-18)


### Features

* support custom git binary path ([7793035](https://github.com/denolehov/obsidian-git/commit/77930351622a86ef3babdb4d60acbc8ff334cc84)), closes [#113](https://github.com/denolehov/obsidian-git/issues/113)

## [1.11.0](https://github.com/denolehov/obsidian-git/compare/1.10.2...1.11.0) (2021-09-15)


### Features

* add remote editing ([f70363b](https://github.com/denolehov/obsidian-git/commit/f70363b522c2e144260411d01e26108f7dedb735))
* support initalizing a new repo ([0fd2062](https://github.com/denolehov/obsidian-git/commit/0fd20627c3c289a05e0aba179b36badfe11d2414))
* support selecting upstream branch ([013878e](https://github.com/denolehov/obsidian-git/commit/013878e378bdbc6bab23c94615fba0c2bb72e1dc))

### [1.10.2](https://github.com/denolehov/obsidian-git/compare/1.10.1...1.10.2) (2021-09-05)


### Bug Fixes

* plugin status bar now displays time from last update (push or pull) ([b835fc3](https://github.com/denolehov/obsidian-git/commit/b835fc3548884dca4084ec37a296ebebf9c9dab7))

### [1.10.1](https://github.com/denolehov/obsidian-git/compare/1.10.0...1.10.1) (2021-08-19)


### Bug Fixes

* checkRequirements cant find user.name/email ([1994a44](https://github.com/denolehov/obsidian-git/commit/1994a44c5ecec121965505e2627d26460425e4dd))
* rename commands to be more consistend ([5e07e80](https://github.com/denolehov/obsidian-git/commit/5e07e80a13640b6ba587185880ba01befbd563ac))

## [1.10.0](https://github.com/denolehov/obsidian-git/compare/1.9.3...1.10.0) (2021-08-11)


### Features

* add submodules support ([2a4ce6d](https://github.com/denolehov/obsidian-git/commit/2a4ce6d47696cd6667b639c8479b37f61346e9be)), closes [#93](https://github.com/denolehov/obsidian-git/issues/93)


### Bug Fixes

* Changed the branchLocal command to branch with no-color ([dbd93cf](https://github.com/denolehov/obsidian-git/commit/dbd93cfe5f127874a514837577b42b34a07bcf3e))

### [1.9.3](https://github.com/denolehov/obsidian-git/compare/1.9.2...1.9.3) (2021-07-13)


### Bug Fixes

* storing lastAutos in a file caused many problems ([2812d94](https://github.com/denolehov/obsidian-git/commit/2812d948f0c6b0534c507425249c93397f71e973)), closes [#90](https://github.com/denolehov/obsidian-git/issues/90) [#78](https://github.com/denolehov/obsidian-git/issues/78)

### [1.9.2](https://github.com/denolehov/obsidian-git/compare/1.9.1...1.9.2) (2021-05-12)


### Bug Fixes

* plugin started wrong when normally enabled ([dc9c4b1](https://github.com/denolehov/obsidian-git/commit/dc9c4b13387067793e315a9aca24c05c75fb6d38))
* storing of last auto backup/pull caused merge conflicts ([cf6f279](https://github.com/denolehov/obsidian-git/commit/cf6f27900d05eb3ffe74222950cd00270879fd6c)), closes [#74](https://github.com/denolehov/obsidian-git/issues/74)

### [1.9.1](https://github.com/denolehov/obsidian-git/compare/1.9.0...1.9.1) (2021-05-07)


### Bug Fixes

* init slowed Obsidian startup time down ([e3f559c](https://github.com/denolehov/obsidian-git/commit/e3f559c14b54ef97eb8d07397d8b92250eeb3d62)), closes [#72](https://github.com/denolehov/obsidian-git/issues/72)

## [1.9.0](https://github.com/denolehov/obsidian-git/compare/1.8.1...1.9.0) (2021-05-02)


### Features

* add env var OBSIDIAN_GIT for scripting ([2b76097](https://github.com/denolehov/obsidian-git/commit/2b7609774cfd8689297c23ea672264cea6255409))
* add option to disable status bar ([0ab55d3](https://github.com/denolehov/obsidian-git/commit/0ab55d3f0805a031e9e3ec5b5cfa21d8c5026330)), closes [#70](https://github.com/denolehov/obsidian-git/issues/70)
* auto pull/backup outlives session ([7ec00e7](https://github.com/denolehov/obsidian-git/commit/7ec00e7cfd113aeb827f282d765ca061d85235a6)), closes [#68](https://github.com/denolehov/obsidian-git/issues/68)

### [1.8.1](https://github.com/denolehov/obsidian-git/compare/1.8.0...1.8.1) (2021-04-12)


### Bug Fixes

* add promise queue ([f95d71a](https://github.com/denolehov/obsidian-git/commit/f95d71a5475107dbf1bbacfb3bdb4e74fd190d15)), closes [#61](https://github.com/denolehov/obsidian-git/issues/61)

## [1.8.0](https://github.com/denolehov/obsidian-git/compare/1.7.0...1.8.0) (2021-03-31)


### Features

* open not supported files in changed files modal in default app ([93930e0](https://github.com/denolehov/obsidian-git/commit/93930e079384d0ae2ed165e94241dc1d0acee82a))

## [1.7.0](https://github.com/denolehov/obsidian-git/compare/1.6.1...1.7.0) (2021-03-24)


### Features

* add git initialization and conflict files status to statusbar ([ba0ef11](https://github.com/denolehov/obsidian-git/commit/ba0ef11a5abcc8ff11d9e33ca8157a283d06920b))
* auto pull on specified interval ([2aa7fb8](https://github.com/denolehov/obsidian-git/commit/2aa7fb866e41c1f7170b723a35d9acd2942921b0)), closes [#59](https://github.com/denolehov/obsidian-git/issues/59)
* conflict files support ([358dc6e](https://github.com/denolehov/obsidian-git/commit/358dc6e492e6ef8156687535d14a9070ebadfb30)), closes [#38](https://github.com/denolehov/obsidian-git/issues/38)
* list changed files ([5e28b94](https://github.com/denolehov/obsidian-git/commit/5e28b9449f3f7f978fe825fb102b61fb27d191e4))


### Bug Fixes

* conflict files pane was opened on pull error ([8d43e7b](https://github.com/denolehov/obsidian-git/commit/8d43e7b32e7b5082c3518537ce32c0627b35dfb2))

### [1.6.1](https://github.com/denolehov/obsidian-git/compare/1.6.0...1.6.1) (2021-03-17)


### Bug Fixes

* disable check for root git repository ([49a68e0](https://github.com/denolehov/obsidian-git/commit/49a68e0396b46c09a49f03898b804f97d1a709b3)), closes [#55](https://github.com/denolehov/obsidian-git/issues/55) [#11](https://github.com/denolehov/obsidian-git/issues/11)

## [1.6.0](https://github.com/denolehov/obsidian-git/compare/1.5.0...1.6.0) (2021-03-15)


### Features

* commit changes with specified message ([e992199](https://github.com/denolehov/obsidian-git/commit/e9921994e135ac01f5eda8f23d7c4db312cedd05)), closes [#26](https://github.com/denolehov/obsidian-git/issues/26)
* list filenames affected by commit in the commit body ([0ce9ac3](https://github.com/denolehov/obsidian-git/commit/0ce9ac310c402a3a7a679fc30e591a045d3a4fb2)), closes [#3](https://github.com/denolehov/obsidian-git/issues/3)
* pull before push ([30d8798](https://github.com/denolehov/obsidian-git/commit/30d8798d433f080404bd22c8a33a1ea49b37648f)), closes [#43](https://github.com/denolehov/obsidian-git/issues/43)


### Bug Fixes

* does not push when no changes detected ([d016dee](https://github.com/denolehov/obsidian-git/commit/d016dee92db4af02446b112de580b5197a3303f3)), fixes [#33](https://github.com/denolehov/obsidian-git/issues/33)
* git repository check ([98fa9f7](https://github.com/denolehov/obsidian-git/commit/98fa9f758f9b08546c0c9319a14fd25b85af4503))
* initialization procedure ([1d71418](https://github.com/denolehov/obsidian-git/commit/1d714181d8967fa6089cd380b879ce652332a3fa)), fixes [#27](https://github.com/denolehov/obsidian-git/issues/27)
* lastUpdate gets changed when no changes are detected ([71d2a59](https://github.com/denolehov/obsidian-git/commit/71d2a59f1d5ea7f7fd08e77b1802a47d0aae3f46))
* needed tracking branch to commit ([619c5d1](https://github.com/denolehov/obsidian-git/commit/619c5d182e95c5f1ca946c56d8c002e6b3f09daf))

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
