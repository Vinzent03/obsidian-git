# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.29.0](https://github.com/denolehov/obsidian-git/compare/1.28.0...1.29.0) (2022-08-19)


### Features

* add delete repo command ([26cdfb8](https://github.com/denolehov/obsidian-git/commit/26cdfb8629f2909e019fecebecd6ff745ad0b932))
* add progress to push and clone ([110b6ba](https://github.com/denolehov/obsidian-git/commit/110b6baca8649f3c04b5f2b9d787f22bc78fbb18))
* add to .gitignore command ([c824903](https://github.com/denolehov/obsidian-git/commit/c824903ea8572619b147b405dee76e51b4970f9c))
* cache status for commit ([846c1fe](https://github.com/denolehov/obsidian-git/commit/846c1fee9052c8d446ec169fba38b5c541669809))
* commit only staged files ([f6f4a97](https://github.com/denolehov/obsidian-git/commit/f6f4a97c36acda5950bb156f1732ab0ece89a63e))
* edit .gitignore ([1cad1b7](https://github.com/denolehov/obsidian-git/commit/1cad1b72649c4ad7da931a32bb891176e2f96b3d))
* fix clone overwrite ([d853a4e](https://github.com/denolehov/obsidian-git/commit/d853a4ea00f636bcf98a3e5c31ad360923f30219))
* hide settings when git is not ready ([4c40556](https://github.com/denolehov/obsidian-git/commit/4c40556653132767d1dd424fa37c75ccf7cafe86))
* merge conflicts ([14eb538](https://github.com/denolehov/obsidian-git/commit/14eb538d8fa01198bb9e944b0f01c7e1c04945a2))
* notice when getting status ([c743092](https://github.com/denolehov/obsidian-git/commit/c7430926ec4dc8d3e827f7898a962984c9ac4009))
* progressbar on fetch ([2fe8d3a](https://github.com/denolehov/obsidian-git/commit/2fe8d3a0a47ea85176288145dd319776f74392ab))
* set author to config ([f40920d](https://github.com/denolehov/obsidian-git/commit/f40920d9970dcdf6146b9b108b76cad88d166fdc))
* stage and unstage to context menu ([081ad1d](https://github.com/denolehov/obsidian-git/commit/081ad1dda58f6ae8a3458bf8568de5165824410d))
* two build options ([a3db9f3](https://github.com/denolehov/obsidian-git/commit/a3db9f370602ae4685eb23e1f5ebd7bc09f6338d))


### Bug Fixes

* abort edit remotes on no url ([e617278](https://github.com/denolehov/obsidian-git/commit/e617278e68019583b39ac961de27fe84d46f572a))
* add missing packages and remove import ([4434772](https://github.com/denolehov/obsidian-git/commit/44347725f6e97dfd12d2f5a64c9750edc36087ad))
* add progress to checkout in pull ([2bce927](https://github.com/denolehov/obsidian-git/commit/2bce927ae8ab40372b2c217a9ae57b37fd390340))
* add vault_path ([e15d353](https://github.com/denolehov/obsidian-git/commit/e15d3533e1b21231569ac6dcd432749105730556))
* allow clone in current directory ([8f61a1a](https://github.com/denolehov/obsidian-git/commit/8f61a1a921c6df11953293f6d290eadf827ffee2))
* allow empty in general modal ([43f282e](https://github.com/denolehov/obsidian-git/commit/43f282e8b9c8b86c7404f3375efd3d7ff9ca4642))
* author ([02ed605](https://github.com/denolehov/obsidian-git/commit/02ed605357a5109ce46d7fcb88fa75bdb0e43b8b))
* base path and remotes ([5aa7e8d](https://github.com/denolehov/obsidian-git/commit/5aa7e8df46e3216bce748ca4a29b5b08c6180766))
* cache ctime ([0041232](https://github.com/denolehov/obsidian-git/commit/00412320e995837aa0210b0a3a4b6c4d16791759))
* can push ([bfb05d0](https://github.com/denolehov/obsidian-git/commit/bfb05d02f586baca82972ac25225f10da52c6625))
* canPush ([5415ff5](https://github.com/denolehov/obsidian-git/commit/5415ff5b4b8028637d761f43945ad2195241ce32))
* change conficted files type ([d1a557c](https://github.com/denolehov/obsidian-git/commit/d1a557cba52c907db3331f5c70763d6fb7bc103d))
* check existing repo ([9ef8096](https://github.com/denolehov/obsidian-git/commit/9ef809660674de1ec97819a4eae399623a481351))
* check remote branch ([cb11b45](https://github.com/denolehov/obsidian-git/commit/cb11b453672931950d333eab1b23ca3a486604b2))
* correct committed files count ([8a985d6](https://github.com/denolehov/obsidian-git/commit/8a985d68dd6c00650df0ddea36fb878f4473bf4b))
* declare ALLOWSIMPLEGIT as global ([6faf703](https://github.com/denolehov/obsidian-git/commit/6faf7030aa9dcbbfeae952eb8ca21f0cf9b17905))
* detect missing .git/index file ([8521891](https://github.com/denolehov/obsidian-git/commit/85218917873e38bdc6e07635aa992be4a140addb))
* detect utf8 encoding properly ([688d70e](https://github.com/denolehov/obsidian-git/commit/688d70e0066945a8be0716a9e035a6cc2dda2809))
* disable refresh source control by default on mobile ([ad9d0f8](https://github.com/denolehov/obsidian-git/commit/ad9d0f8a556f6e377bc5080c8584b28a51b702d0))
* discard ([23e262d](https://github.com/denolehov/obsidian-git/commit/23e262de59e627f408037896f1ea167a5349a6f9))
* easier fix for newer Obsidian versions ([75625a0](https://github.com/denolehov/obsidian-git/commit/75625a08b5e0307226dcfebb53a21d0ca9a93eb8))
* format commit message ([0078573](https://github.com/denolehov/obsidian-git/commit/007857358b43639422c856bcaa907609008820ff))
* handle conflict when using simplegit ([6195ce3](https://github.com/denolehov/obsidian-git/commit/6195ce3b1b604f26768244f7633a1bac19888633))
* hide pulled files when empty ([8267e1b](https://github.com/denolehov/obsidian-git/commit/8267e1b21910ccadc14f25caa976e05947a1cf91))
* http calls on newer Obsidian versions ([a4cd006](https://github.com/denolehov/obsidian-git/commit/a4cd006949102bf1f790b844ff1783b8d9618edc))
* improve adapter performance ([4f6f778](https://github.com/denolehov/obsidian-git/commit/4f6f778cd43a2d1d42a437c170a85b0495a02ba4))
* improve conflict support ([c71d1b0](https://github.com/denolehov/obsidian-git/commit/c71d1b0932b5738850bef7311db22ccb8e874dea))
* **isomorphic:** pull ([84d34fc](https://github.com/denolehov/obsidian-git/commit/84d34fcd656c765f0a3dc273382ec1496ccc4cc4))
* move repo to method ([633234d](https://github.com/denolehov/obsidian-git/commit/633234d42603bf8aaa71330c0c189b335de92be8))
* proper types ([07084e9](https://github.com/denolehov/obsidian-git/commit/07084e91bee778ec561df942d31bfc15854d2a8b))
* pull progress and author ([3d8602b](https://github.com/denolehov/obsidian-git/commit/3d8602b58f6183cb5532915b486062b2284ba6dd))
* pulled files count ([9d61906](https://github.com/denolehov/obsidian-git/commit/9d619064e3c8ebf1500cec1cbbe7bfd1e75d6b59))
* pushed files count ([e50a185](https://github.com/denolehov/obsidian-git/commit/e50a185662abc14daa91e5da88c0557eabc9216e))
* relative to vault path ([a70c10a](https://github.com/denolehov/obsidian-git/commit/a70c10a4ef67264975a1abbfab745e8eb0633394))
* reload plugin after clone ([ce4f9bb](https://github.com/denolehov/obsidian-git/commit/ce4f9bb13c5cd44c1db459ae6e0a7a9a2057d0d3))
* reload plugin after clone ([87c66ce](https://github.com/denolehov/obsidian-git/commit/87c66ce1efc50b61ae6230fa88a45b0cb92bd623))
* reload plugin on clone ([82dc9c0](https://github.com/denolehov/obsidian-git/commit/82dc9c035a85b813a49e5c2ff3d5a5c604ae0323))
* remove unnecessary try catch ([a6618e3](https://github.com/denolehov/obsidian-git/commit/a6618e3bf67d7658c8298a0f0849138a758b140a))
* require valid repo for list changed files ([fe300c7](https://github.com/denolehov/obsidian-git/commit/fe300c767d4dac81ce9968e29106eaaf6aeb3ea2))
* restart notice after clone ([140bed5](https://github.com/denolehov/obsidian-git/commit/140bed5cde1772b8c59a72db9ffa89a6eac9151e))
* set base path after clone ([0327090](https://github.com/denolehov/obsidian-git/commit/032709096b6afd8411868135596d5b9ef6c19fbd))
* set desktop only in manifest ([3cee0b0](https://github.com/denolehov/obsidian-git/commit/3cee0b07654933ec4fbc565b6a26233f94beb0d8))
* set upstream branch ([7aa5523](https://github.com/denolehov/obsidian-git/commit/7aa552378504322963a9dee33d7591d0eedbb00b))
* show pulled files when pulled via command ([9022917](https://github.com/denolehov/obsidian-git/commit/90229171334d9b25c8631a993da894e8f56ae18d))
* show/hide settings depending on gitmanager instance ([8f28de8](https://github.com/denolehov/obsidian-git/commit/8f28de831af68f5bac385e12b39d1050ccb2c833))
* simplify can push ([897054f](https://github.com/denolehov/obsidian-git/commit/897054fe03df1ce114a97069e4af22430e035cf9))
* stage individual file ([76e317b](https://github.com/denolehov/obsidian-git/commit/76e317b5320b3a7e9ab303b402518f3791333a8d))
* staging ([c725082](https://github.com/denolehov/obsidian-git/commit/c725082ef9c2f878c9e10102afd95e0f8d0b15a3))
* statusMessage of http request ([7c2d080](https://github.com/denolehov/obsidian-git/commit/7c2d080baf7e70c67adacefc62b9be3288e146da))
* unstage all ([2ff83d3](https://github.com/denolehov/obsidian-git/commit/2ff83d3bba5db2f16d2c4719ea73194d8a0357f7))
* use localstorage for password ([d7c16c6](https://github.com/denolehov/obsidian-git/commit/d7c16c68fac414aee58030fd2fd325f066534efc))
* use setImmediate alternative ([9d29f3f](https://github.com/denolehov/obsidian-git/commit/9d29f3fd1041d99e126aabe7d6794356b0e4ac31))
* use timout ([dc7d33a](https://github.com/denolehov/obsidian-git/commit/dc7d33a03bcee441bc263bb0bb2365b88ffe70ef))
* walkentry can be null ([3aae1f3](https://github.com/denolehov/obsidian-git/commit/3aae1f3b82b6cb1138753cabbe9d60e972741318))

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
