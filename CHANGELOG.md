# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.28.0](https://github.com/denolehov/obsidian-git/compare/2.27.0...2.28.0) (2024-10-26)


### Features

* pull on commit-and-sync even if no commit happened ([263e675](https://github.com/denolehov/obsidian-git/commit/263e675ead38fba8a7d5a5f3349830477817ca25)), closes [#787](https://github.com/denolehov/obsidian-git/issues/787)
* reload settings on file change ([d453c6f](https://github.com/denolehov/obsidian-git/commit/d453c6fe85143b6afcd672e3fd65ef7851dd9ae3)), closes [#779](https://github.com/denolehov/obsidian-git/issues/779)


### Bug Fixes

* recognize more errors as network issues ([4aceed3](https://github.com/denolehov/obsidian-git/commit/4aceed30c5b349431f7a5ed21c4d3b4bdabb88e7)), closes [#735](https://github.com/denolehov/obsidian-git/issues/735)
* refresh status after opening source control view ([666b8a8](https://github.com/denolehov/obsidian-git/commit/666b8a8f263ce49a3d02dbfb040aa774cce95db2))
* rework errors ([ee3eff4](https://github.com/denolehov/obsidian-git/commit/ee3eff46e0d98999e6ab312971392adc008d4f6e))
* strip files list after 500 entries in source control view ([fe1aedb](https://github.com/denolehov/obsidian-git/commit/fe1aedb0a12d4e0b5d4a81821a8d08c1417dd6b8))
* typo in settings ([1e6c3dd](https://github.com/denolehov/obsidian-git/commit/1e6c3dddae7f5cd3b8393f36817fba94ed3cd12d))

## [2.27.0](https://github.com/denolehov/obsidian-git/compare/2.26.0...2.27.0) (2024-09-18)


### Features

* rename backup to commit-and-sync and better settings page ([cd9ffc2](https://github.com/denolehov/obsidian-git/commit/cd9ffc2ebe964dc59c8ce5d114f444222eb1d068))


### Bug Fixes

* discard deleted files ([42bf536](https://github.com/denolehov/obsidian-git/commit/42bf536b7973ef35a251a88fa61127b9a3b9972d))
* discard not tracked directory ([183929b](https://github.com/denolehov/obsidian-git/commit/183929b0cf3da47670faf930d3b6700df65db5c4))
* don't refresh views if git client is not ready ([7887c7f](https://github.com/denolehov/obsidian-git/commit/7887c7f4518fd2f1f83810ad3fc13cb53af4fe19))
* refresh data on view loading ([73d2c29](https://github.com/denolehov/obsidian-git/commit/73d2c299298d3b11dd5a0e976b1187d46d17041e))
* show better diff view for non existing file ([07d9fce](https://github.com/denolehov/obsidian-git/commit/07d9fce47306a3315128327bec6e50ac351d9bff))
* trigger vault backup after edit on file rename ([d1ad3d4](https://github.com/denolehov/obsidian-git/commit/d1ad3d49a116db03c926df26044e181f9a53a3a0)), closes [#765](https://github.com/denolehov/obsidian-git/issues/765)

## [2.26.0](https://github.com/denolehov/obsidian-git/compare/2.25.0...2.26.0) (2024-09-01)


### Features

* open source control view with ribbon button ([dea4d6f](https://github.com/denolehov/obsidian-git/commit/dea4d6f915492ecc3d43b259fbe8764b9c6210a4))


### Bug Fixes

* open diffs in new split with middle click ([65ef5ba](https://github.com/denolehov/obsidian-git/commit/65ef5ba2fa783717baaea24d05c6dcc8e760596d))
* remove root folding line in git views ([b2df0ed](https://github.com/denolehov/obsidian-git/commit/b2df0ed27b2af948df06dcc45021005b8c54e363))

## [2.25.0](https://github.com/denolehov/obsidian-git/compare/2.24.3...2.25.0) (2024-07-23)


### Features

* add context menu to git views ([115c4ba](https://github.com/denolehov/obsidian-git/commit/115c4baccaaf0e905fa8eefee8cb5f35abfff88f)), closes [#615](https://github.com/denolehov/obsidian-git/issues/615)


### Bug Fixes

* catch sidebar leaf being null ([86065c9](https://github.com/denolehov/obsidian-git/commit/86065c987bb478cbf65b4baca1745d7162041b5d))
* don't require .git suffix to open file on github ([9b264bf](https://github.com/denolehov/obsidian-git/commit/9b264bffb49a36d86f8af4c17435de2e6ca6c580)), closes [#753](https://github.com/denolehov/obsidian-git/issues/753)
* open file on github from submodule ([4981f8b](https://github.com/denolehov/obsidian-git/commit/4981f8bcc2eacda44fcebf8a95f458acd514febc)), closes [#592](https://github.com/denolehov/obsidian-git/issues/592)
* use active color for buttons in file component ([c28d44b](https://github.com/denolehov/obsidian-git/commit/c28d44b1c6f358cdb0113ebcc4b1634a161dfdf2))

### [2.24.3](https://github.com/denolehov/obsidian-git/compare/2.24.2...2.24.3) (2024-06-22)


### Bug Fixes

* Adjust git.cwd to use a relative path to git root ([#733](https://github.com/denolehov/obsidian-git/issues/733)) ([ed31553](https://github.com/denolehov/obsidian-git/commit/ed31553a8cf25548ab722c4edf40d8d0a20df4e8))
* limit amount of files to list in commit msg ([a0416ed](https://github.com/denolehov/obsidian-git/commit/a0416edf5f3ac5d9adc9fc37cf9a9c932583ced4))
* support vault in subdirectory of git repo ([#722](https://github.com/denolehov/obsidian-git/issues/722)) ([171693f](https://github.com/denolehov/obsidian-git/commit/171693f7fda542f4ba0452a54979d92c8ecfcdb6))

### [2.24.2](https://github.com/denolehov/obsidian-git/compare/2.24.1...2.24.2) (2024-05-09)


### Bug Fixes

* ask for upstream branch in backup ([d1143f7](https://github.com/denolehov/obsidian-git/commit/d1143f7d643581ddf674b492921bf0aab9044643))
* hide line authoring on small width window([#684](https://github.com/denolehov/obsidian-git/issues/684)) ([6a89424](https://github.com/denolehov/obsidian-git/commit/6a89424231ab45ca7741a6d9b96693f63ca40e6e))

### [2.24.1](https://github.com/denolehov/obsidian-git/compare/2.24.0...2.24.1) (2024-03-12)


### Bug Fixes

* disable line authoring on mobile ([ac28656](https://github.com/denolehov/obsidian-git/commit/ac2865676135a22a81f8d1a440825e7583aa73ec))

## [2.24.0](https://github.com/denolehov/obsidian-git/compare/2.23.2...2.24.0) (2024-03-04)


### Features

* show date and author in history view ([a6e33d3](https://github.com/denolehov/obsidian-git/commit/a6e33d30d1556c485cc2ac6467972aa471b94758)), closes [#691](https://github.com/denolehov/obsidian-git/issues/691)


### Bug Fixes

* update submodules without outer remote repo ([675cef5](https://github.com/denolehov/obsidian-git/commit/675cef52d4e0ebbd2d11ff2322aa21649574bf9d)), closes [#701](https://github.com/denolehov/obsidian-git/issues/701)

### [2.23.2](https://github.com/denolehov/obsidian-git/compare/2.23.1...2.23.2) (2024-01-31)


### Bug Fixes

* many issues with list changed files ([8b3fc8b](https://github.com/denolehov/obsidian-git/commit/8b3fc8bd69b76193086d5b3a814546a9e3cf51ea)), closes [#655](https://github.com/denolehov/obsidian-git/issues/655)

### [2.23.1](https://github.com/denolehov/obsidian-git/compare/2.23.0...2.23.1) (2024-01-29)


### Bug Fixes

* commit in source control view ([90985b1](https://github.com/denolehov/obsidian-git/commit/90985b1b7733eb39247b3aaa71ddc2482012f272)), closes [#686](https://github.com/denolehov/obsidian-git/issues/686)

## [2.23.0](https://github.com/denolehov/obsidian-git/compare/2.22.2...2.23.0) (2024-01-28)


### Features

* add commit amend command ([8f10261](https://github.com/denolehov/obsidian-git/commit/8f10261b08a498b0fc8f989209c1e0b048a27c35)), closes [#648](https://github.com/denolehov/obsidian-git/issues/648)
* add setting to disable 'No changes...' popups ([#676](https://github.com/denolehov/obsidian-git/issues/676)) ([bfd6de9](https://github.com/denolehov/obsidian-git/commit/bfd6de9092aaa18d7624b374d10873a179f12351))


### Bug Fixes

* fold only one item ([cd1d932](https://github.com/denolehov/obsidian-git/commit/cd1d93226a4e2f5ebfaa89ada97851c60f35a4fd)), closes [#680](https://github.com/denolehov/obsidian-git/issues/680)

### [2.22.2](https://github.com/denolehov/obsidian-git/compare/2.22.1...2.22.2) (2024-01-26)

### [2.22.1](https://github.com/denolehov/obsidian-git/compare/2.22.0...2.22.1) (2024-01-08)


### Bug Fixes

* allow different ssh remote user than git ([5b6400c](https://github.com/denolehov/obsidian-git/commit/5b6400cc85c827bc13e11ffa1bc0cbb3bd6cfd26)), closes [#664](https://github.com/denolehov/obsidian-git/issues/664)
* create new remote ([1a4cca8](https://github.com/denolehov/obsidian-git/commit/1a4cca8baf20de91ce3ee825740a85f1d33c1744)), closes [#599](https://github.com/denolehov/obsidian-git/issues/599)
* grammar improvement in settings ([#635](https://github.com/denolehov/obsidian-git/issues/635)) ([1d81577](https://github.com/denolehov/obsidian-git/commit/1d81577877ccb548b06fb91036a246aa442a41ae))
* tooltip direction ([#600](https://github.com/denolehov/obsidian-git/issues/600)) ([a913303](https://github.com/denolehov/obsidian-git/commit/a91330381e83cfc2ece14186325b129d7fc9b6bf))
* update settings grammar ([#656](https://github.com/denolehov/obsidian-git/issues/656)) ([d9e8be1](https://github.com/denolehov/obsidian-git/commit/d9e8be14b5dbb64a9b78b2d3fe56c474bd57596f))

## [2.22.0](https://github.com/denolehov/obsidian-git/compare/2.21.0...2.22.0) (2023-08-30)


### Features

* highlight opened diff view file ([5708c63](https://github.com/denolehov/obsidian-git/commit/5708c63ad7cad72c3939a4d554a5b98bc04783ed)), closes [#545](https://github.com/denolehov/obsidian-git/issues/545)


### Bug Fixes

* ui alignment ([a9adfff](https://github.com/denolehov/obsidian-git/commit/a9adfff996d570f8e893a2e2786059d0fa2e1cb9))

## [2.21.0](https://github.com/denolehov/obsidian-git/compare/2.20.7...2.21.0) (2023-08-22)


### Features

* add fetch command ([222245b](https://github.com/denolehov/obsidian-git/commit/222245b7c750bd4d2740aa25913d74d538e5035d))
* mark push button when push is ready ([32936eb](https://github.com/denolehov/obsidian-git/commit/32936eb76dff45c2333660791faa0bc8f86e1154)), closes [#557](https://github.com/denolehov/obsidian-git/issues/557)


### Bug Fixes

* clarify backup after file change setting ([30d12ca](https://github.com/denolehov/obsidian-git/commit/30d12ca872c523cc3d6ee2987c2299270f50a578)), closes [#575](https://github.com/denolehov/obsidian-git/issues/575)
* show file name in diff view on mobile ([20e0aba](https://github.com/denolehov/obsidian-git/commit/20e0aba46fa3454f8dabc60dd9d3c579efc322ee)), closes [#564](https://github.com/denolehov/obsidian-git/issues/564)

### [2.20.7](https://github.com/denolehov/obsidian-git/compare/2.20.6...2.20.7) (2023-07-31)


### Bug Fixes

* properly collapse icon in tree views ([919d7f8](https://github.com/denolehov/obsidian-git/commit/919d7f8f65174e76a4f13a992b3f37931eaf7262))
* refresh status bar after push ([ed31df8](https://github.com/denolehov/obsidian-git/commit/ed31df88effc5e686cb2e81e0379df93627bdd9b)), closes [#566](https://github.com/denolehov/obsidian-git/issues/566)

### [2.20.6](https://github.com/denolehov/obsidian-git/compare/2.20.5...2.20.6) (2023-07-16)


### Bug Fixes

* allow empty commit in history view ([2571473](https://github.com/denolehov/obsidian-git/commit/257147311cf65a2b5dedf957f4c71ad9624ce7be))

### [2.20.5](https://github.com/denolehov/obsidian-git/compare/2.20.4...2.20.5) (2023-06-29)


### Bug Fixes

* disallow clone in vault root on desktop ([c073d19](https://github.com/denolehov/obsidian-git/commit/c073d19283c01af4fdc79002d1913b1d5672a5fd)), closes [#540](https://github.com/denolehov/obsidian-git/issues/540)
* textarea for commit message in settings ([ea4a7a1](https://github.com/denolehov/obsidian-git/commit/ea4a7a105a8a954e705b372dac127fa3a83fddc1))

### [2.20.4](https://github.com/denolehov/obsidian-git/compare/2.20.3...2.20.4) (2023-06-21)


### Bug Fixes

* make  `{{files}}` variable visible in settings ([#536](https://github.com/denolehov/obsidian-git/issues/536)) ([07abcce](https://github.com/denolehov/obsidian-git/commit/07abcce878a66e686e7f0221c68df746f69b590b))
* missing git file status 113 ([#537](https://github.com/denolehov/obsidian-git/issues/537)) ([ba2b40c](https://github.com/denolehov/obsidian-git/commit/ba2b40cbc5687f92ab9ca6a65110d5d6ec39c2ca))

### [2.20.3](https://github.com/denolehov/obsidian-git/compare/2.20.2...2.20.3) (2023-06-04)


### Bug Fixes

* show correct empty diff ([c8bbe7c](https://github.com/denolehov/obsidian-git/commit/c8bbe7c5d2b7beb49ab5fa55922f289c2bcdbed1)), closes [#327](https://github.com/denolehov/obsidian-git/issues/327)

### [2.20.2](https://github.com/denolehov/obsidian-git/compare/2.20.1...2.20.2) (2023-06-02)


### Bug Fixes

* hide line authoring settings on mobile ([c135c0b](https://github.com/denolehov/obsidian-git/commit/c135c0b49cd0cc8033ea40f64e6f922702375aa0))
* properly resolve merge conflict ([80c0b65](https://github.com/denolehov/obsidian-git/commit/80c0b65f8d0d8dc8dbddff61118bd79733ffce94)), closes [#502](https://github.com/denolehov/obsidian-git/issues/502)

### [2.20.1](https://github.com/denolehov/obsidian-git/compare/2.20.0...2.20.1) (2023-05-31)


### Bug Fixes

* use queue for actions in source control view ([eb20dd4](https://github.com/denolehov/obsidian-git/commit/eb20dd4c93cb6013e9aef1e47f817586261507d5)), closes [#517](https://github.com/denolehov/obsidian-git/issues/517)

## [2.20.0](https://github.com/denolehov/obsidian-git/compare/2.19.1...2.20.0) (2023-05-17)


### Features

* Line Authoring ([aa8dd1b](https://github.com/denolehov/obsidian-git/commit/aa8dd1b3cf0fc440c4d7177831795f3fc5b0076c)), closes [#321](https://github.com/denolehov/obsidian-git/issues/321)


### Bug Fixes

* use proper tree structure on Obsidian 1.3.1 ([c124943](https://github.com/denolehov/obsidian-git/commit/c124943d5f1ba388f700524e517a43cf9682abc8)), closes [#512](https://github.com/denolehov/obsidian-git/issues/512)

### [2.19.1](https://github.com/denolehov/obsidian-git/compare/2.19.0...2.19.1) (2023-04-04)


### Bug Fixes

* handle missing tracking branch ([#483](https://github.com/denolehov/obsidian-git/issues/483)) ([703fc18](https://github.com/denolehov/obsidian-git/commit/703fc18e7dccec89c810e6529a869ec5c271c21e))

## [2.19.0](https://github.com/denolehov/obsidian-git/compare/2.18.0...2.19.0) (2023-03-22)


### Features
* new History view
* show last commit time in status bar ([b6d93a1](https://github.com/denolehov/obsidian-git/commit/b6d93a1b8574b1d9dc56c3be9bf8403d95fcef26)), closes [#334](https://github.com/denolehov/obsidian-git/issues/334)


### Bug Fixes

* catch error in diffView ([cbff377](https://github.com/denolehov/obsidian-git/commit/cbff37701fd8aa8b9e1257d09fb8ca9fb655b35b))
* catch huge auto intervals ([35bca00](https://github.com/denolehov/obsidian-git/commit/35bca003c98637f65295fe7d5a8bc4ae1fd68b07)), closes [#153](https://github.com/denolehov/obsidian-git/issues/153)

## [2.18.0](https://github.com/denolehov/obsidian-git/compare/2.17.4...2.18.0) (2023-03-20)


### Features

* add setting to hide file menu actions ([a59d38a](https://github.com/denolehov/obsidian-git/commit/a59d38a9f00042a1c27dc64426cd93e595f8eb6b)), closes [#456](https://github.com/denolehov/obsidian-git/issues/456)
* show last commit time in status bar ([4525fef](https://github.com/denolehov/obsidian-git/commit/4525fef302c23b54c233186bdbf898615fc1b314)), closes [#334](https://github.com/denolehov/obsidian-git/issues/334)


### Bug Fixes

* catch huge auto intervals ([b96efc5](https://github.com/denolehov/obsidian-git/commit/b96efc5e06654f144d5837e784da297d79496c51)), closes [#153](https://github.com/denolehov/obsidian-git/issues/153)
* minor source control view improvements ([fd7792c](https://github.com/denolehov/obsidian-git/commit/fd7792c80403d884d09c31bb09a76799bbd0dff0))
* typo in settings ([4014057](https://github.com/denolehov/obsidian-git/commit/4014057879d24cb176a2ee1baac868fab05bc856)), closes [#468](https://github.com/denolehov/obsidian-git/issues/468)

### [2.17.4](https://github.com/denolehov/obsidian-git/compare/2.17.3...2.17.4) (2023-03-07)


### Bug Fixes

* add additional author check ([58ce847](https://github.com/denolehov/obsidian-git/commit/58ce84749936c78a2789f3eae1e2de3877350b96))

### [2.17.3](https://github.com/denolehov/obsidian-git/compare/2.17.2...2.17.3) (2023-03-07)


### Bug Fixes

* better error message for missing author ([2e9e3b1](https://github.com/denolehov/obsidian-git/commit/2e9e3b135de411f764ba6eef5b0aaf4d21216b55))
* don't checkout when nothing changed after merge ([f807d8a](https://github.com/denolehov/obsidian-git/commit/f807d8a19712bc8f697e37ba1a571b47be77c064))
* show diff with custom base path ([fdde0bf](https://github.com/denolehov/obsidian-git/commit/fdde0bf83b4fedf430fe829724992207f1393d48))
* use correct git path on clone on mobile ([686c323](https://github.com/denolehov/obsidian-git/commit/686c3230daff6a7fa1d51cf9270295ad975e2599))

### [2.17.2](https://github.com/denolehov/obsidian-git/compare/2.17.1...2.17.2) (2023-03-06)


### Bug Fixes

* use correct git dir on mobile ([fd456e5](https://github.com/denolehov/obsidian-git/commit/fd456e5f505ba1bedc0ab85fdc62ee9aa91c18e5))

### [2.17.1](https://github.com/denolehov/obsidian-git/compare/2.17.0...2.17.1) (2023-03-05)


### Bug Fixes

* show missing repo message ([70a6464](https://github.com/denolehov/obsidian-git/commit/70a64640f3b21fe61bbdaf0b6215d2878df732be))

## [2.17.0](https://github.com/denolehov/obsidian-git/compare/2.16.0...2.17.0) (2023-02-25)


### Features

* include old file name in log ([fa34fb5](https://github.com/denolehov/obsidian-git/commit/fa34fb5c87c9d9d6b294ef3fe28f5c7538df21ac))
* specify depth on clone ([cf81f0c](https://github.com/denolehov/obsidian-git/commit/cf81f0c1ea72931b2274265e32ab4db2d11d0c82)), closes [#307](https://github.com/denolehov/obsidian-git/issues/307)


### Bug Fixes

* correct git dir for clone on mobile ([0b06487](https://github.com/denolehov/obsidian-git/commit/0b0648716f790e2676509b77dee444a72ef06814))
* handle github link errors ([#445](https://github.com/denolehov/obsidian-git/issues/445)) ([fd294cc](https://github.com/denolehov/obsidian-git/commit/fd294ccf50237c24000559d0d99cff4758e43b1a))

## [2.16.0](https://github.com/denolehov/obsidian-git/compare/2.15.0...2.16.0) (2023-01-16)


### Features

* additional environment variables ([f9b1bca](https://github.com/denolehov/obsidian-git/commit/f9b1bca38c6db23f05abfb211933f7ce4f69db7f)), closes [#414](https://github.com/denolehov/obsidian-git/issues/414)
* custom GIT_DIR ([978453e](https://github.com/denolehov/obsidian-git/commit/978453ebb1cf0df1c70bd169665709cd512264dd))

## [2.15.0](https://github.com/denolehov/obsidian-git/compare/2.14.0...2.15.0) (2023-01-06)


### Features

* improve discard modal ([872fc18](https://github.com/denolehov/obsidian-git/commit/872fc182743df108a42ae244699bb2d2b03d7c69))

## [2.14.0](https://github.com/denolehov/obsidian-git/compare/2.13.0...2.14.0) (2022-12-14)


### Features

* add instructions to conflict  file ([50291d3](https://github.com/denolehov/obsidian-git/commit/50291d3b182ba4789dac25164ca66f511ba1ab67)), closes [#402](https://github.com/denolehov/obsidian-git/issues/402)


### Bug Fixes

* close empty leaf of deleted conflict file ([cd6027d](https://github.com/denolehov/obsidian-git/commit/cd6027dcb8f3f9c353c9e9f9592b057c06fceb70)), closes [#401](https://github.com/denolehov/obsidian-git/issues/401)

## [2.13.0](https://github.com/denolehov/obsidian-git/compare/2.12.1...2.13.0) (2022-12-07)


### Features

* add file name to diff view tab name ([8520c2b](https://github.com/denolehov/obsidian-git/commit/8520c2beed20f9fe20e6af830c34f59b1678b36a))


### Bug Fixes

* move commit msg setting to correct heading ([88eabc9](https://github.com/denolehov/obsidian-git/commit/88eabc930ca98ea205d366e874a245af964efabd))
* use correct path for diff view via command ([1150351](https://github.com/denolehov/obsidian-git/commit/1150351e6bdf066e59cd7579e9efc087d4d5a595)), closes [#397](https://github.com/denolehov/obsidian-git/issues/397)

### [2.12.1](https://github.com/denolehov/obsidian-git/compare/2.12.0...2.12.1) (2022-11-27)


### Bug Fixes

* use correct git implementation ([2def322](https://github.com/denolehov/obsidian-git/commit/2def32278a6dadab4777aae38a57821f5d044406)), closes [#387](https://github.com/denolehov/obsidian-git/issues/387) [#386](https://github.com/denolehov/obsidian-git/issues/386)

## [2.12.0](https://github.com/denolehov/obsidian-git/compare/2.11.0...2.12.0) (2022-11-27)


### Features

* set last auto backup to last commit ([d8cfbf2](https://github.com/denolehov/obsidian-git/commit/d8cfbf2efe31770f6fd7ac6399bb7563f3caa831)), closes [#73](https://github.com/denolehov/obsidian-git/issues/73)

## [2.11.0](https://github.com/denolehov/obsidian-git/compare/2.10.2...2.11.0) (2022-11-26)


### Features

* add backup button to source control view ([477b166](https://github.com/denolehov/obsidian-git/commit/477b16644dddd13dce1bde1600aed996b2b8f377)), closes [#374](https://github.com/denolehov/obsidian-git/issues/374)


### Bug Fixes

* hide 'finished pull'  notice when hiding notifications ([8ba0e75](https://github.com/denolehov/obsidian-git/commit/8ba0e7526001eaefed71b2978e9f1ab76ab18136)), closes [#292](https://github.com/denolehov/obsidian-git/issues/292)

### [2.10.2](https://github.com/denolehov/obsidian-git/compare/2.10.1...2.10.2) (2022-11-17)


### Bug Fixes

* focus diff view via command ([e56641c](https://github.com/denolehov/obsidian-git/commit/e56641c25f9672fcffeb0801f09ca7eadf99ede0)), closes [#377](https://github.com/denolehov/obsidian-git/issues/377)

### [2.10.1](https://github.com/denolehov/obsidian-git/compare/2.10.0...2.10.1) (2022-11-13)


### Bug Fixes

* add remote on mobile ([c529a37](https://github.com/denolehov/obsidian-git/commit/c529a377195fea76028b424d5973aae80498670e)), closes [#375](https://github.com/denolehov/obsidian-git/issues/375)

## [2.10.0](https://github.com/denolehov/obsidian-git/compare/2.9.4...2.10.0) (2022-11-08)


### Features

* log git commands ([a63bb8a](https://github.com/denolehov/obsidian-git/commit/a63bb8a0063b69cc020a0fd0017b42d7ee31ed1e))


### Bug Fixes

* reorder settings item ([8d5b596](https://github.com/denolehov/obsidian-git/commit/8d5b59658500329b9f52a68127d619c3f5016906))

### [2.9.4](https://github.com/denolehov/obsidian-git/compare/2.9.3...2.9.4) (2022-11-04)


### Bug Fixes

* unset config on empty value ([d0f927e](https://github.com/denolehov/obsidian-git/commit/d0f927ecec9aeeae4ee86873511a208bf943e29c))

### [2.9.3](https://github.com/denolehov/obsidian-git/compare/2.9.2...2.9.3) (2022-11-03)

### [2.9.2](https://github.com/denolehov/obsidian-git/compare/2.9.1...2.9.2) (2022-11-02)


### Bug Fixes

* detect network unreachable ([76b894c](https://github.com/denolehov/obsidian-git/commit/76b894c21085ff99d2f0bbaf1c4f46351e3f19f1)), closes [#211](https://github.com/denolehov/obsidian-git/issues/211)
* hide notification on mobile ([7d62527](https://github.com/denolehov/obsidian-git/commit/7d6252795ca62f4176fee90d674041659a0a1d9f)), closes [#292](https://github.com/denolehov/obsidian-git/issues/292)

### [2.9.1](https://github.com/denolehov/obsidian-git/compare/2.9.0...2.9.1) (2022-11-02)


### Bug Fixes

* set path env var ([8a2ae4d](https://github.com/denolehov/obsidian-git/commit/8a2ae4dfe2ebb0023a351c251845d29a311a9560))

## [2.9.0](https://github.com/denolehov/obsidian-git/compare/2.8.0...2.9.0) (2022-11-01)


### Features

* custom PATH env paths ([2c42609](https://github.com/denolehov/obsidian-git/commit/2c4260942a738421bf517f1b0d063b536345f8bf))


### Bug Fixes

* store username in localstorage ([f3668ac](https://github.com/denolehov/obsidian-git/commit/f3668ac23f13d263e50b7d6b716d91150a11b6c7))

## [2.8.0](https://github.com/denolehov/obsidian-git/compare/2.7.0...2.8.0) (2022-10-18)


### Features

* new discard icon ([730e9a6](https://github.com/denolehov/obsidian-git/commit/730e9a6405b4018dc987b29c0a156feb01b583f2))


### Bug Fixes

* align buttons ([a09bc4a](https://github.com/denolehov/obsidian-git/commit/a09bc4ac2b5165b11a740230db55a4ef05e3c219))
* center buttons in discard modal ([79a1e86](https://github.com/denolehov/obsidian-git/commit/79a1e86ce5ba7e039393c49414b0e408e940aaa5))
* create .gitignore if not exists ([ac8e3ee](https://github.com/denolehov/obsidian-git/commit/ac8e3ee380340fbeedf0dac8e80a4c28aeadffa8))
* full directory path on hover ([0f2c9d5](https://github.com/denolehov/obsidian-git/commit/0f2c9d56b1733450283af487c740d01908201284))

## [2.7.0](https://github.com/denolehov/obsidian-git/compare/2.6.0...2.7.0) (2022-10-18)


### Features

* discard all changes ([3461a30](https://github.com/denolehov/obsidian-git/commit/3461a300ee563a316faf5d198473f2ccc323b1e8))
* discard directories ([149805f](https://github.com/denolehov/obsidian-git/commit/149805f24e310e2b225be904c75094b90d38dd33))
* stage/unstage button on category ([3373e6d](https://github.com/denolehov/obsidian-git/commit/3373e6d0ee4f2a4d84e7b3513fd7712046b2e889))


### Bug Fixes

* correct height for textarea ([b44c900](https://github.com/denolehov/obsidian-git/commit/b44c9008db9b12b1e4f23ef5fc87151618953231))
* jittering of refresh button ([dbf36b2](https://github.com/denolehov/obsidian-git/commit/dbf36b2a63617b4d937f75326cd007ea08cfb622))
* sum folder paths in n depth ([e690164](https://github.com/denolehov/obsidian-git/commit/e690164c0ef6bc1749008357299f92b9a244d960))
* unstage all on mobile ([4507fdb](https://github.com/denolehov/obsidian-git/commit/4507fdb9c6f2f5c890198a18980586d892786d0e))
* unstage dir ([3d421b7](https://github.com/denolehov/obsidian-git/commit/3d421b70e0611b5dbbd91c23668e8b98df57116a))
* unstage folder on desktop ([56afe51](https://github.com/denolehov/obsidian-git/commit/56afe510ade79fab52a8a1aa2a9c15739d16a904))

## [2.6.0](https://github.com/denolehov/obsidian-git/compare/2.5.1...2.6.0) (2022-10-13)


### Features

* combine multiple empty directory into one in git view ([4e45e6a](https://github.com/denolehov/obsidian-git/commit/4e45e6accc468402033c5b56d6fb56ec5b461c1e))
* redesign source control view ([06f3c22](https://github.com/denolehov/obsidian-git/commit/06f3c229cfd199c716401ad1f4e524e2e23bc4f7))
* stage/unstage directory ([61b3eb3](https://github.com/denolehov/obsidian-git/commit/61b3eb3ac38553ef4cda0512be19b1f4480d613c))

### [2.5.1](https://github.com/denolehov/obsidian-git/compare/2.5.0...2.5.1) (2022-09-29)


### Bug Fixes

* push with file named like branch ([2664bfe](https://github.com/denolehov/obsidian-git/commit/2664bfe633e9ea0c76123ed7b0d4ac56aaf05b10)), closes [#171](https://github.com/denolehov/obsidian-git/issues/171)

## [2.5.0](https://github.com/denolehov/obsidian-git/compare/2.4.1...2.5.0) (2022-09-28)


### Features

* improve source control view style ([d5647a8](https://github.com/denolehov/obsidian-git/commit/d5647a8e2e49c8a77f28854bb4c276a17f390d55))


### Bug Fixes

* reveal source control view ([c88a1b4](https://github.com/denolehov/obsidian-git/commit/c88a1b43633e9964e3a9f60e94c0dc7f8307edc1))

### [2.4.1](https://github.com/denolehov/obsidian-git/compare/2.4.0...2.4.1) (2022-09-22)


### Bug Fixes

* keep git view on unload ([8b846da](https://github.com/denolehov/obsidian-git/commit/8b846da0010a852b5422d64034c1e4b309fa7f35)), closes [#321](https://github.com/denolehov/obsidian-git/issues/321)

## [2.4.0](https://github.com/denolehov/obsidian-git/compare/2.3.0...2.4.0) (2022-09-22)


### Features

* prefill edit remote modal ([223193c](https://github.com/denolehov/obsidian-git/commit/223193c51b362788a0682dc598c7d0eefa9ccdf0))


### Bug Fixes

* middle click to open file/diff in new tab ([ddb1164](https://github.com/denolehov/obsidian-git/commit/ddb1164b10f5e0d373daaa4cd8ec4d60119cc544))

## [2.3.0](https://github.com/denolehov/obsidian-git/compare/2.2.1...2.3.0) (2022-09-21)


### Features

* branch management ([caaacd1](https://github.com/denolehov/obsidian-git/commit/caaacd11c8634e86b01dc19dfb57b546adedf7e6)), closes [#132](https://github.com/denolehov/obsidian-git/issues/132) [#220](https://github.com/denolehov/obsidian-git/issues/220)


### Bug Fixes

* backup with reset sync method ([41a00ff](https://github.com/denolehov/obsidian-git/commit/41a00ff8b17212a23c515d0f19be69a0b8d2f1c1)), closes [#319](https://github.com/denolehov/obsidian-git/issues/319)

### [2.2.1](https://github.com/denolehov/obsidian-git/compare/2.2.0...2.2.1) (2022-09-20)


### Bug Fixes

* localstorage migration ([1d9391a](https://github.com/denolehov/obsidian-git/commit/1d9391a970624f03fcc60fb68f3bd8ee450af24b))

## [2.2.0](https://github.com/denolehov/obsidian-git/compare/2.1.2...2.2.0) (2022-09-20)


### Features

* diff view on mobile ([86b4d5a](https://github.com/denolehov/obsidian-git/commit/86b4d5ad4be23b420fe0efd0f3dfd989047be23a)), closes [#302](https://github.com/denolehov/obsidian-git/issues/302)


### Bug Fixes

* respect obsidian default hotkey for open file ([b8631f4](https://github.com/denolehov/obsidian-git/commit/b8631f4ff0b9a0bdeacc829248195085f4512f1d)), closes [#306](https://github.com/denolehov/obsidian-git/issues/306)
* save localstorage per vault ([a3c4e4f](https://github.com/denolehov/obsidian-git/commit/a3c4e4f8916b78160de074e72444c5ccd91c32b2))

### [2.1.2](https://github.com/denolehov/obsidian-git/compare/2.1.1...2.1.2) (2022-09-19)


### Bug Fixes

* respect obsidian default hotkey for open diff ([271ec02](https://github.com/denolehov/obsidian-git/commit/271ec022d4caa91ebf0f4c1d82755bb879525ef6)), closes [#306](https://github.com/denolehov/obsidian-git/issues/306)
* scroll line number in diff view ([1a01e30](https://github.com/denolehov/obsidian-git/commit/1a01e30357894980d8c5ffc77d2828af57174af7)), closes [#318](https://github.com/denolehov/obsidian-git/issues/318)

### [2.1.1](https://github.com/denolehov/obsidian-git/compare/2.1.0...2.1.1) (2022-09-15)


### Bug Fixes

* open diff in new leaf ([6914830](https://github.com/denolehov/obsidian-git/commit/6914830ce03651b7f9604ba7be81581636a34f5b)), closes [#306](https://github.com/denolehov/obsidian-git/issues/306)
* retry auth with different credentials ([f8da5f4](https://github.com/denolehov/obsidian-git/commit/f8da5f455a15f27e93e8b317af3bf9dba7dc3d57)), closes [#296](https://github.com/denolehov/obsidian-git/issues/296)

## [2.1.0](https://github.com/denolehov/obsidian-git/compare/2.0.3...2.1.0) (2022-09-08)


### Features

* disable plugin per device ([82b2c1a](https://github.com/denolehov/obsidian-git/commit/82b2c1ad82196927eda16b965094f025a1ed2960)), closes [#301](https://github.com/denolehov/obsidian-git/issues/301)
* specify source control refresh timer ([a1ecb1b](https://github.com/denolehov/obsidian-git/commit/a1ecb1b39954422de150169a71d0b9da8ee84167)), closes [#199](https://github.com/denolehov/obsidian-git/issues/199)

### [2.0.3](https://github.com/denolehov/obsidian-git/compare/2.0.2...2.0.3) (2022-09-06)


### Bug Fixes

* don't show mobile notice on new installation ([218f002](https://github.com/denolehov/obsidian-git/commit/218f002f433ec3a69f92ebfdf1876c50cd99e85c))

### [2.0.2](https://github.com/denolehov/obsidian-git/compare/2.0.1...2.0.2) (2022-09-06)


### Bug Fixes

* don't show mobile notice on mobile ([c93ddfa](https://github.com/denolehov/obsidian-git/commit/c93ddfaee5d7621248f2ed1183b8819a7d216706))

### [2.0.1](https://github.com/denolehov/obsidian-git/compare/2.0.0...2.0.1) (2022-09-06)

## [2.0.0](https://github.com/denolehov/obsidian-git/compare/1.31.0...2.0.0) (2022-09-06)


### ⚠ BREAKING CHANGES

* mobile support

### Features

* mobile support ([9ffda76](https://github.com/denolehov/obsidian-git/commit/9ffda762dbc0cba380942acdeabcb66adce8253d)), closes [#57](https://github.com/denolehov/obsidian-git/issues/57)


### Bug Fixes

* password field description ([9dc5f7c](https://github.com/denolehov/obsidian-git/commit/9dc5f7c7bab3a3b1b24d42ae2fadb10e48cbc292)), closes [#293](https://github.com/denolehov/obsidian-git/issues/293)

## [1.31.0](https://github.com/denolehov/obsidian-git/compare/1.30.0...1.31.0) (2022-08-28)


### Features

* command to backup and close Obsidian ([c144d80](https://github.com/denolehov/obsidian-git/commit/c144d80e719fae5d3aba6f0ff5535172993a2c69)), closes [#13](https://github.com/denolehov/obsidian-git/issues/13)


### Bug Fixes

* **mobile** don't show push notice on empty push ([9986667](https://github.com/denolehov/obsidian-git/commit/998666778ed07f380b6a4057afc33ca637c472c7))
* set upstream branch for existing remote branch ([c454b9d](https://github.com/denolehov/obsidian-git/commit/c454b9d7ae3323e5c9f4e758e139e97eb85ec40e)), closes [#224](https://github.com/denolehov//github.com/denolehov/obsidian-git/issues/224/issues/issuecomment-1229136511)

## [1.30.0](https://github.com/denolehov/obsidian-git/compare/1.29.2...1.30.0) (2022-08-24)


### Features

* store git binary path in localstorage ([bd8bafc](https://github.com/denolehov/obsidian-git/commit/bd8bafc904e0f14501a9985c0ae490bea98297be)), closes [#283](https://github.com/denolehov/obsidian-git/issues/283)


### Bug Fixes

* **mobile:** clone and delete local config dir ([9b0bc8a](https://github.com/denolehov/obsidian-git/commit/9b0bc8afb2f21440382f40a442dfc7b1bd369cca))
* **mobile:** readdir with empty base path ([1c38b91](https://github.com/denolehov/obsidian-git/commit/1c38b913d15ed6a2410eeb9b0da7ae9675ef3ab3))
* respect custom base path in open in github ([c4e8acf](https://github.com/denolehov/obsidian-git/commit/c4e8acf62586b477434bd0c7e55c3ea0c0c99e8e)), closes [#284](https://github.com/denolehov/obsidian-git/issues/284)
* too many changes to display ([c4bf4eb](https://github.com/denolehov/obsidian-git/commit/c4bf4eb8bd7d3e9110b354910eed9e29bafbafa6))

### [1.29.2](https://github.com/denolehov/obsidian-git/compare/1.29.1...1.29.2) (2022-08-22)


### Bug Fixes

* catch ssh network failure ([62e4a6a](https://github.com/denolehov/obsidian-git/commit/62e4a6a255e2ceedd38e4a016fa92f407e052485)), closes [#211](https://github.com/denolehov/obsidian-git/issues/211)
* diff of new file ([92d24bf](https://github.com/denolehov/obsidian-git/commit/92d24bf8f25749f48ea8646088adec55a1ae2c25)), closes [#277](https://github.com/denolehov/obsidian-git/issues/277)
* **mobile:** set correct base path after clone ([3a69b79](https://github.com/denolehov/obsidian-git/commit/3a69b79583d3e76b22b36ef5c414fc4b98d1fdb7)), closes [#282](https://github.com/denolehov/obsidian-git/issues/282)
* require upstream branch for pull ([3fac8ad](https://github.com/denolehov/obsidian-git/commit/3fac8ad86f8885ca322865b6e27f4a43b804a6ce)), closes [#261](https://github.com/denolehov/obsidian-git/issues/261)

### [1.29.1](https://github.com/denolehov/obsidian-git/compare/1.29.0...1.29.1) (2022-08-19)


### Bug Fixes

* export mock IsomorphicGit.ts ([aa5fa37](https://github.com/denolehov/obsidian-git/commit/aa5fa37579903243f6623fa99592203c76cd5478)), closes [#281](https://github.com/denolehov/obsidian-git/issues/281)

## [1.29.0](https://github.com/denolehov/obsidian-git/compare/1.28.0...1.29.0) (2022-08-19)


### Features

* add delete repo command ([26cdfb8](https://github.com/denolehov/obsidian-git/commit/26cdfb8629f2909e019fecebecd6ff745ad0b932))
* add to .gitignore command ([c824903](https://github.com/denolehov/obsidian-git/commit/c824903ea8572619b147b405dee76e51b4970f9c))
* edit .gitignore ([1cad1b7](https://github.com/denolehov/obsidian-git/commit/1cad1b72649c4ad7da931a32bb891176e2f96b3d))
* commit only staged files ([f6f4a97](https://github.com/denolehov/obsidian-git/commit/f6f4a97c36acda5950bb156f1732ab0ece89a63e))
* fix clone overwrite ([d853a4e](https://github.com/denolehov/obsidian-git/commit/d853a4ea00f636bcf98a3e5c31ad360923f30219))
* hide settings when git is not ready ([4c40556](https://github.com/denolehov/obsidian-git/commit/4c40556653132767d1dd424fa37c75ccf7cafe86))
* set author to config ([f40920d](https://github.com/denolehov/obsidian-git/commit/f40920d9970dcdf6146b9b108b76cad88d166fdc))
* stage and unstage to context menu ([081ad1d](https://github.com/denolehov/obsidian-git/commit/081ad1dda58f6ae8a3458bf8568de5165824410d))


### Bug Fixes

* abort edit remotes on no url ([e617278](https://github.com/denolehov/obsidian-git/commit/e617278e68019583b39ac961de27fe84d46f572a))
* require valid repo for list changed files ([fe300c7](https://github.com/denolehov/obsidian-git/commit/fe300c767d4dac81ce9968e29106eaaf6aeb3ea2))
* restart notice after clone ([140bed5](https://github.com/denolehov/obsidian-git/commit/140bed5cde1772b8c59a72db9ffa89a6eac9151e))
* set base path after clone ([0327090](https://github.com/denolehov/obsidian-git/commit/032709096b6afd8411868135596d5b9ef6c19fbd))
* stage individual file ([76e317b](https://github.com/denolehov/obsidian-git/commit/76e317b5320b3a7e9ab303b402518f3791333a8d))

## [1.28.0](https://github.com/denolehov/obsidian-git/compare/1.27.1...1.28.0) (2022-07-25)


### Features

* stage and unstage current file ([f014e52](https://github.com/denolehov/obsidian-git/commit/f014e52e11cbb345a313914a9e71e0807a0d4197)), closes [#265](https://github.com/denolehov/obsidian-git/issues/265)


### Bug Fixes

* register event listener after initial load ([d32d0f4](https://github.com/denolehov/obsidian-git/commit/d32d0f4bc26db390da8008e8af878eef97ba98f4))

### [1.27.1](https://github.com/denolehov/obsidian-git/compare/1.27.0...1.27.1) (2022-07-20)


### Bug Fixes

* check for too big files in source control view ([2275d4f](https://github.com/denolehov/obsidian-git/commit/2275d4f716c00a305bf4371e9cb1b934669b2272))

## [1.27.0](https://github.com/denolehov/obsidian-git/compare/1.26.4...1.27.0) (2022-07-20)


### Features

* check for too big files ([f0f3942](https://github.com/denolehov/obsidian-git/commit/f0f394246fb001dcd4b5b42f17d764f7a95a4486)), closes [#248](https://github.com/denolehov/obsidian-git/issues/248) [#189](https://github.com/denolehov/obsidian-git/issues/189)

### [1.26.4](https://github.com/denolehov/obsidian-git/compare/1.26.3...1.26.4) (2022-07-20)


### Bug Fixes

* Version History Diff for empty base path ([3b9b699](https://github.com/denolehov/obsidian-git/commit/3b9b69938d97c1a257755a4896857fe8ee8db557)), closes [#263](https://github.com/denolehov/obsidian-git/issues/263)

### [1.26.3](https://github.com/denolehov/obsidian-git/compare/1.26.2...1.26.3) (2022-07-17)


### Bug Fixes

* commit only staged files, again ([ba35555](https://github.com/denolehov/obsidian-git/commit/ba35555eebbac5f4a69aaa7da6847928e0ddd017)), closes [#253](https://github.com/denolehov/obsidian-git/issues/253)

### [1.26.2](https://github.com/denolehov/obsidian-git/compare/1.26.1...1.26.2) (2022-07-16)


### Bug Fixes

* clarification about disabling notifications ([#249](https://github.com/denolehov/obsidian-git/issues/249)) ([f90b284](https://github.com/denolehov/obsidian-git/commit/f90b284f1f4140eab6aec1b77353cb52e661a8e3))
* commit only staged files ([f71fdf5](https://github.com/denolehov/obsidian-git/commit/f71fdf58271c1490887f057c6ecc5e6d3689dbd4)), closes [#253](https://github.com/denolehov/obsidian-git/issues/253)
* open diff view in correct pane ([96d2913](https://github.com/denolehov/obsidian-git/commit/96d2913c67bf8348953440954d5e41986c6b121b)), closes [#252](https://github.com/denolehov/obsidian-git/issues/252)
* open files from source control view ([0d5ec26](https://github.com/denolehov/obsidian-git/commit/0d5ec262187281517c4a63a78c417c8d9940750f)), closes [#258](https://github.com/denolehov/obsidian-git/issues/258)

### [1.26.1](https://github.com/denolehov/obsidian-git/compare/1.26.0...1.26.1) (2022-06-09)


### Bug Fixes

* open file with custom base path ([8a11666](https://github.com/denolehov/obsidian-git/commit/8a11666e6d430ed3fba952a584b9f8af6cc462fe))
* use correct path with custom base path ([0d86e68](https://github.com/denolehov/obsidian-git/commit/0d86e6872fa16c809f7bf71f05e344acaf31008d))

## [1.26.0](https://github.com/denolehov/obsidian-git/compare/1.25.3...1.26.0) (2022-06-09)


### Features

* different intervals for commit and push ([59367aa](https://github.com/denolehov/obsidian-git/commit/59367aa3d0fde912cf393f5e48989758f44b82e0)), closes [#106](https://github.com/denolehov/obsidian-git/issues/106)
* show changes files count in status bar ([d091694](https://github.com/denolehov/obsidian-git/commit/d0916947546aad84f506f39f9f754a6b3c33f42c)), closes [#243](https://github.com/denolehov/obsidian-git/issues/243)


### Bug Fixes

* handle merge conflict better ([101aff9](https://github.com/denolehov/obsidian-git/commit/101aff991ecaecd57f004dd7bfd1811866b755e5))

### [1.25.3](https://github.com/denolehov/obsidian-git/compare/1.25.2...1.25.3) (2022-05-14)


### Bug Fixes

* show renamed files ([b76c783](https://github.com/denolehov/obsidian-git/commit/b76c78332978dbbf7045f94295ed3228de7132a9)), closes [#226](https://github.com/denolehov/obsidian-git/issues/226)

### [1.25.2](https://github.com/denolehov/obsidian-git/compare/1.25.1...1.25.2) (2022-05-07)


### Bug Fixes

* improve base path description ([8ee3a63](https://github.com/denolehov/obsidian-git/commit/8ee3a63fff91d4c9fd61cb9da73cc738026b8af1))

### [1.25.1](https://github.com/denolehov/obsidian-git/compare/1.25.0...1.25.1) (2022-04-22)


### Bug Fixes

* recursive submodules ([#217](https://github.com/denolehov/obsidian-git/issues/217)) ([98f566f](https://github.com/denolehov/obsidian-git/commit/98f566ffa29bb99dde44615f52fd352c099bd7f4))

## [1.25.0](https://github.com/denolehov/obsidian-git/compare/1.24.1...1.25.0) (2022-04-07)


### Features

* custom git repository root ([#209](https://github.com/denolehov/obsidian-git/issues/209)) ([4157e42](https://github.com/denolehov/obsidian-git/commit/4157e42fa6cbd0f69d8ed03169c5bc836229d6d4))
* offline mode ([6989ba4](https://github.com/denolehov/obsidian-git/commit/6989ba4fd7ce44bfac5c6f7479cf41ef8fcb5de3)), closes [#211](https://github.com/denolehov/obsidian-git/issues/211)


### Bug Fixes

* refresh source control view less frequently ([b90b1a5](https://github.com/denolehov/obsidian-git/commit/b90b1a5fa596142f42698727dd76cadd97e9bdc6))

### [1.24.1](https://github.com/denolehov/obsidian-git/compare/1.24.0...1.24.1) (2022-03-23)


### Bug Fixes

* :adhesive_bandage: More specific CSS selectors for the diff-view ([c0c9a38](https://github.com/denolehov/obsidian-git/commit/c0c9a381f2c4c0527674e4e215e2418c71d68b73))
* refresh source control view on first open ([6e75300](https://github.com/denolehov/obsidian-git/commit/6e75300424eb8d78f1a4c79caf830ce5d5fd1727))

## [1.24.0](https://github.com/denolehov/obsidian-git/compare/1.23.0...1.24.0) (2022-03-18)


### Features

* add show, diff, log as api ([b3a72a4](https://github.com/denolehov/obsidian-git/commit/b3a72a46dfb917b28ca9af7848994668d1846b64))

## [1.23.0](https://github.com/denolehov/obsidian-git/compare/1.22.0...1.23.0) (2022-03-18)


### Features

* reworked diff view handling ([be4856b](https://github.com/denolehov/obsidian-git/commit/be4856b0f3a6ecc7f4416f98d9eb05a992b61443)), closes [#202](https://github.com/denolehov/obsidian-git/issues/202) [#203](https://github.com/denolehov/obsidian-git/issues/203)


### Bug Fixes

* expand selection width on stagedFileComponent too ([daf8ac7](https://github.com/denolehov/obsidian-git/commit/daf8ac7e4279d6334fd36b4706c85c77d2e8dbbe))
* highlight staged file on hover ([ef0d3e6](https://github.com/denolehov/obsidian-git/commit/ef0d3e6640712669e8d303d7cf1bff7dbdedbc7d))
* refresh source control view on exception ([c1eee7b](https://github.com/denolehov/obsidian-git/commit/c1eee7b0d378677dff4da75fc3945b88c3ede7d3)), closes [#183](https://github.com/denolehov/obsidian-git/issues/183)

## [1.22.0](https://github.com/denolehov/obsidian-git/compare/1.21.2...1.22.0) (2022-03-02)


### Features

* separate commit message for auto backup ([b59db5d](https://github.com/denolehov/obsidian-git/commit/b59db5dc816479fd6dad5d798d0979c49c8b8ccf)), closes [#197](https://github.com/denolehov/obsidian-git/issues/197)


### Bug Fixes

* automatically refresh source control ([9c2b063](https://github.com/denolehov/obsidian-git/commit/9c2b063584366226da876c9e5e6509868b6a01cd)), closes [#199](https://github.com/denolehov/obsidian-git/issues/199)
* correct pull changes count ([6aead15](https://github.com/denolehov/obsidian-git/commit/6aead155571eda2499ef1ab6377236152124df96)), closes [#198](https://github.com/denolehov/obsidian-git/issues/198)

### [1.21.2](https://github.com/denolehov/obsidian-git/compare/1.21.1...1.21.2) (2022-03-01)


### Bug Fixes

* catch git error on commit ([fe78ae3](https://github.com/denolehov/obsidian-git/commit/fe78ae364e5296a378a3d0844a3daa53b3d024c7))
* stage files without glob pattern ([99b1f6c](https://github.com/denolehov/obsidian-git/commit/99b1f6c3d61e4b2fca274531fa98359af0a8c64e)), closes [#196](https://github.com/denolehov/obsidian-git/issues/196)

### [1.21.1](https://github.com/denolehov/obsidian-git/compare/1.21.0...1.21.1) (2022-02-19)


### Bug Fixes

* better automatic backup/pull description ([10c3072](https://github.com/denolehov/obsidian-git/commit/10c307228da5c79cf62acfa2d6c90d2f519855a8)), closes [#181](https://github.com/denolehov/obsidian-git/issues/181)
* catch more git errors ([153fd82](https://github.com/denolehov/obsidian-git/commit/153fd82d7467d6c58905fa77c4376b2e79594810))
* stage filenames with leading '-' ([c06296e](https://github.com/denolehov/obsidian-git/commit/c06296e364962474299687e941fcdab8e03c9061)), closes [#184](https://github.com/denolehov/obsidian-git/issues/184)

### [1.21.0](https://github.com/denolehov/obsidian-git/compare/1.20.1...1.20.2) (2022-02-02)


### Bug Fixes

* stage files in vault below git root ([9d3c662](https://github.com/denolehov/obsidian-git/commit/9d3c6620f32b392935a689a9ff645aa664f49478)), closes [#172](https://github.com/denolehov/obsidian-git/issues/172)

### Features

* new sync method ([f1d6b33](https://github.com/denolehov/obsidian-git/commit/f1d6b334972b76271a15883c31784812f24d6878))

### [1.20.1](https://github.com/denolehov/obsidian-git/compare/1.20.0...1.20.1) (2022-01-29)


### Bug Fixes

* show correct debug console hotkey ([087582e](https://github.com/denolehov/obsidian-git/commit/087582e429d96345c1f1ee17e0d6a1eeb71d9489)), closes [#175](https://github.com/denolehov/obsidian-git/issues/175)

## [1.20.0](https://github.com/denolehov/obsidian-git/compare/1.19.0...1.20.0) (2022-01-08)


### Features

* :sparkles: Add "Open File in GitHub" Command, fix [#149](https://github.com/denolehov/obsidian-git/issues/149) ([2c216d0](https://github.com/denolehov/obsidian-git/commit/2c216d033fe0a82a68cf4951d72b5af4e9d10c87))
* :sparkles: Add Command to open file history on GitHub ([e7dd288](https://github.com/denolehov/obsidian-git/commit/e7dd288ba85a87e783d18c2b51e9027ec20f94fa))
* :sparkles: Add Diff View ([78cd43f](https://github.com/denolehov/obsidian-git/commit/78cd43fadece2b2d6bed80582bba18d842632e1a)), closes [#158](https://github.com/denolehov/obsidian-git/issues/158)
* :sparkles: Add Folder view to Sidebar ([919dc44](https://github.com/denolehov/obsidian-git/commit/919dc4435f08e8b3217ee66237a0671687bdb5a1)), closes [#134](https://github.com/denolehov/obsidian-git/issues/134)
* :sparkles: Allow multiline commit messages, fix [#157](https://github.com/denolehov/obsidian-git/issues/157) ([80ea17e](https://github.com/denolehov/obsidian-git/commit/80ea17e34f07f43bfe2aef1b5c520160a0e71e10))
* Add toggle in Settings to choose default layout ([38c7240](https://github.com/denolehov/obsidian-git/commit/38c7240918d1e463044431d976b9025eb1fdc318))


### Bug Fixes

* :bug: Fix RegEx for openInGitHub ([ca59a2d](https://github.com/denolehov/obsidian-git/commit/ca59a2db581643cfd77f3663850fe1243efe4260))
* :children_crossing: Show diff on double click ([407dcc0](https://github.com/denolehov/obsidian-git/commit/407dcc05d6e9679c7487c1d2dfa78f580c16b5da))
* catch diff for deleted file ([710cd2c](https://github.com/denolehov/obsidian-git/commit/710cd2cc6e69c1561277c762518ba0ba903e91f3))
* different tree data structure ([0fd2f95](https://github.com/denolehov/obsidian-git/commit/0fd2f954b66f0336475f8babb1904130711cbc50))
* many minor fixes ([7d29bef](https://github.com/denolehov/obsidian-git/commit/7d29bef4ed7793b399a704f73a3ab458e043e595))
* refresh source control view on change ([45e54e2](https://github.com/denolehov/obsidian-git/commit/45e54e21d097492d35084e4b7c52e1f7df5c59b1))
* remove tree structure from settings ([5af00ae](https://github.com/denolehov/obsidian-git/commit/5af00ae593d573016694da3bc9bbb218c8baa978))

## [1.19.0](https://github.com/denolehov/obsidian-git/compare/1.18.1...1.19.0) (2021-12-22)


### Features

* add rebase option for pull ([b04e444](https://github.com/denolehov/obsidian-git/commit/b04e444e99ca31d1abb1e4bfdd81cbdaca88caec)), closes [#155](https://github.com/denolehov/obsidian-git/issues/155)

### [1.18.1](https://github.com/denolehov/obsidian-git/compare/1.18.0...1.18.1) (2021-12-09)


### Bug Fixes

* use more specific css class ([471b257](https://github.com/denolehov/obsidian-git/commit/471b257671b861f69747882fcd67be22f7dca287))

## [1.18.0](https://github.com/denolehov/obsidian-git/compare/1.17.0...1.18.0) (2021-12-09)


### Features

* add commands for push and commit ([82dd037](https://github.com/denolehov/obsidian-git/commit/82dd037189a4dbe1b8ef7cad13d0c11b0817af2d)), closes [#122](https://github.com/denolehov/obsidian-git/issues/122)
* use icons for status bar ([96dcbc4](https://github.com/denolehov/obsidian-git/commit/96dcbc443369803a6f11d69ca80f34176025864a)), closes [#147](https://github.com/denolehov/obsidian-git/issues/147)


### Bug Fixes

* show error notices for a longer time ([d455489](https://github.com/denolehov/obsidian-git/commit/d45548993bcb95924a28f723d616e6c2f8c7c293)), closes [#148](https://github.com/denolehov/obsidian-git/issues/148)

## [1.17.0](https://github.com/denolehov/obsidian-git/compare/1.16.2...1.17.0) (2021-12-08)


### Features

* add hostname commit message placeholder ([32d8382](https://github.com/denolehov/obsidian-git/commit/32d8382c804b1e86effb409246dad06cad78506d)), closes [#146](https://github.com/denolehov/obsidian-git/issues/146)


### Bug Fixes

* clear autobackup/pull correctly ([1c5eeab](https://github.com/denolehov/obsidian-git/commit/1c5eeab098609ab5925a2ddda3aeef76db2660b3))
* don't start autobackup with 0 interval time ([a36c741](https://github.com/denolehov/obsidian-git/commit/a36c741cb1a5e557615768af3656dc76d6391ed0))

### [1.16.2](https://github.com/denolehov/obsidian-git/compare/1.16.1...1.16.2) (2021-11-29)


### Bug Fixes

* don't use new auto backup after change by default ([cc95a96](https://github.com/denolehov/obsidian-git/commit/cc95a96613386c30c379457d7d33198808403c63))

### [1.16.1](https://github.com/denolehov/obsidian-git/compare/1.16.0...1.16.1) (2021-11-28)


### Bug Fixes

* proper utf-8 encoding ([1bc7d28](https://github.com/denolehov/obsidian-git/commit/1bc7d2844ec3b3a954abe3c11766fd1e2d1c1b2a)), closes [#121](https://github.com/denolehov/obsidian-git/issues/121)

## [1.16.0](https://github.com/denolehov/obsidian-git/compare/1.15.1...1.16.0) (2021-11-28)


### Features

* add auto backup after last change ([192a947](https://github.com/denolehov/obsidian-git/commit/192a9474af7fbd607d451c8b95afaa46c84b7a9d)), closes [#140](https://github.com/denolehov/obsidian-git/issues/140)

### [1.15.1](https://github.com/denolehov/obsidian-git/compare/1.15.0...1.15.1) (2021-11-25)


### Bug Fixes

* use custom git binary path for git check ([7188753](https://github.com/denolehov/obsidian-git/commit/718875300f6f9d22e8773a5336bd70b095f63845))

## [1.15.0](https://github.com/denolehov/obsidian-git/compare/1.14.3...1.15.0) (2021-11-11)


### Features

* add custom commit message to auto backup ([b3d8077](https://github.com/denolehov/obsidian-git/commit/b3d8077bab29edf2602cd57a392969abf89e4241)), closes [#135](https://github.com/denolehov/obsidian-git/issues/135)

### [1.14.3](https://github.com/denolehov/obsidian-git/compare/1.14.2...1.14.3) (2021-11-03)

### Bug Fixes

* open file from Git view when no other file is opened

### [1.14.2](https://github.com/denolehov/obsidian-git/compare/1.14.1...1.14.2) (2021-11-01)


### Bug Fixes

* replace '?' by 'U' for untracked files ([64cf162](https://github.com/denolehov/obsidian-git/commit/64cf1623e50513f0f46141f6860650d0a865238c))
* wrap tooltip for long paths ([1fc4c1f](https://github.com/denolehov/obsidian-git/commit/1fc4c1fd7afbdbb08d7e3a061dd5d602e6f195a3))

### [1.14.1](https://github.com/denolehov/obsidian-git/compare/1.14.0...1.14.1) (2021-11-01)


### Bug Fixes

* list files in commit body ([f52a18b](https://github.com/denolehov/obsidian-git/commit/f52a18b3a3b6b05d643541baf2f74c32bb3e88d4)), closes [#131](https://github.com/denolehov/obsidian-git/issues/131)

## [1.14.0](https://github.com/denolehov/obsidian-git/compare/1.13.1...1.14.0) (2021-10-31)


### Features

* New Git view in the sidebar to stage and commit individual files. Thanks to @phibr0 for making the UI


### [1.13.1](https://github.com/denolehov/obsidian-git/compare/1.13.0...1.13.1) (2021-09-30)


### Bug Fixes

* changed files path was wrong with whitespaces ([043f02f](https://github.com/denolehov/obsidian-git/commit/043f02f89daea8051612b5f7816564ba7f7657e8)), closes [#119](https://github.com/denolehov/obsidian-git/issues/119)

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
