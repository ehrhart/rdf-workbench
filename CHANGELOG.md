# Changelog

## [1.2.0](https://github.com/ehrhart/rdf-workbench/compare/v1.1.0...v1.2.0) (2026-09-04)


### Features

* **frontend:** add Oxigraph provider, import, and compose stack ([0342252](https://github.com/ehrhart/rdf-workbench/commit/0342252b9bd417d141017948f98758be5b321b81))

## [1.1.0](https://github.com/ehrhart/rdf-workbench/compare/v1.0.0...v1.1.0) (2026-08-29)


### Features

* **frontend:** configurable dereference paths ([954ba56](https://github.com/ehrhart/rdf-workbench/commit/954ba565f0824d82c1e065ddeff4508e5b09a75a))
* **frontend:** larger touch targets and compact labels on small screens ([a36bc50](https://github.com/ehrhart/rdf-workbench/commit/a36bc5098e6143d1560e0454b057ec421791c49a))


### Bug Fixes

* **frontend:** add title to app icon svg ([a003a2a](https://github.com/ehrhart/rdf-workbench/commit/a003a2ab9ef94235145709080a0760d05f05f88c))

## [1.0.0](https://github.com/ehrhart/rdf-workbench/compare/v0.1.0...v1.0.0) (2026-08-28)


### Features

* **adapter:** throttle failed logins per username ([35e2a2a](https://github.com/ehrhart/rdf-workbench/commit/35e2a2ad2925a86469362fa497e49cd2c8f632cb))
* **frontend:** add app favicon ([61ced6b](https://github.com/ehrhart/rdf-workbench/commit/61ced6b6d1c51d2f4d7734d6754628ae8777677b))
* **frontend:** display release version in sidebar ([803cd65](https://github.com/ehrhart/rdf-workbench/commit/803cd65200035bf4570d7698e1e3f97de0188faf))
* **graphs:** link graph visualization to resource page ([318bfca](https://github.com/ehrhart/rdf-workbench/commit/318bfca8b5cb29197bdc0c970d53e64026aaa3a8))
* **graphs:** stream graph export with progress and cancel ([b11e64e](https://github.com/ehrhart/rdf-workbench/commit/b11e64ec9a5a464865e06e1e20ac35c4a7ce1d81))
* **resource:** add dereferenceable resource URL routes ([9ad4e9d](https://github.com/ehrhart/rdf-workbench/commit/9ad4e9d8c09d4fdc1797d6d23bc43fd41b97b35e))
* **saved-queries:** add admin management with reorder ([1b389b2](https://github.com/ehrhart/rdf-workbench/commit/1b389b2e570a45b75d8c9ad8c771f56df393dea8))
* **sparql:** add copy link button for current query ([d152a71](https://github.com/ehrhart/rdf-workbench/commit/d152a7155c898ed0bd69f6034ecae79d6ce43f52))
* **sparql:** add format and syntax-check actions to the query editor ([7ca4427](https://github.com/ehrhart/rdf-workbench/commit/7ca4427c8554a2fe5302212761eefc1aa2b81441))
* **sparql:** defer authorization to triplestore with anonymous console ([741dd8c](https://github.com/ehrhart/rdf-workbench/commit/741dd8c68c4dc724e0ee5824ac286166e6e558bd))
* **sparql:** render DESCRIBE/CONSTRUCT graphs as a triples table ([e575e4d](https://github.com/ehrhart/rdf-workbench/commit/e575e4d1df302d9476363c4fd1237294d6551e81))
* **sparql:** run and display CONSTRUCT/DESCRIBE graph results ([1b4a425](https://github.com/ehrhart/rdf-workbench/commit/1b4a425595d174eff58c22df7ddd99b71bcb9ecf))


### Bug Fixes

* **adapter:** enforce timeout and size limit on URL imports ([d6d0dae](https://github.com/ehrhart/rdf-workbench/commit/d6d0daecf1cc44731a5e5ea6ddd263c5a38fa390))
* **adapter:** reap idle sessions on the configured cleanup interval ([552baf8](https://github.com/ehrhart/rdf-workbench/commit/552baf891e99f3deb80464734d242c858233980e))
* **adapter:** scope bulk-load jobs and files per user ([eecdf56](https://github.com/ehrhart/rdf-workbench/commit/eecdf56a938ca989df4bc67716b6a1fb19a21b27))
* align resource autocomplete input with buttons ([f505f3b](https://github.com/ehrhart/rdf-workbench/commit/f505f3b1b99fdaf4ce7bc02b3f027044859ea617))
* **auth:** enforce minimum password length server-side ([e3a3506](https://github.com/ehrhart/rdf-workbench/commit/e3a3506f1729cbe2aad707b2cc47e73cc165ee0f))
* **auth:** renew Virtuoso session on activity ([4f11521](https://github.com/ehrhart/rdf-workbench/commit/4f1152155e30e2fb0ec84997f91b94f38e3d86e5))
* **auth:** treat all authenticated Virtuoso users as admins ([8795105](https://github.com/ehrhart/rdf-workbench/commit/8795105871e0b981ade37cb2bc627d75034752c1))
* **config:** drop dead server-configuration surface, keep cfgItemValue helper ([b84b95e](https://github.com/ehrhart/rdf-workbench/commit/b84b95e23ae372c6df7d531bbeb947ef0397e739))
* **dashboard:** apply height constraint to scroll-area viewport so saved queries scroll ([67beae8](https://github.com/ehrhart/rdf-workbench/commit/67beae8cbadb57eb8195103d8ae18b182caeb906))
* **dashboard:** make saved queries list scrollable ([dd0f3cc](https://github.com/ehrhart/rdf-workbench/commit/dd0f3cc27f6a4f3e2a0a20b4a941010767a4dedf))
* **dashboard:** show recent queries from local history instead of hardcoded zero ([208191e](https://github.com/ehrhart/rdf-workbench/commit/208191ecbbc9c2622f10eef011d693eda8054080))
* **frontend:** remove empty public dir copy from Dockerfile ([9f3cc3f](https://github.com/ehrhart/rdf-workbench/commit/9f3cc3fa98f3bef8cfdee0c3c6c838812b83a89e))
* **import:** clean stale staged uploads on import page load ([27a89de](https://github.com/ehrhart/rdf-workbench/commit/27a89de76119e6feb70b7d283fc09e06024b6250))
* **import:** scope staged uploads per user to avoid filename collisions ([300e00e](https://github.com/ehrhart/rdf-workbench/commit/300e00e66fc7d32b27e8c2fbb43de8120a502672))
* **logout:** hard navigate to clear router cache after session end ([641df6d](https://github.com/ehrhart/rdf-workbench/commit/641df6dc6466fb17e032f2d28bef204887563195))
* **logout:** honor redirect param and send users to login ([ecaf8cf](https://github.com/ehrhart/rdf-workbench/commit/ecaf8cff5d89ed5734895d7468f673a7d38f36b1))
* **logout:** redirect to homepage on logout ([2887806](https://github.com/ehrhart/rdf-workbench/commit/288780689f71b003cdf274f63e507b0e1dc1610f))
* **logout:** redirect with next/navigation to resolve relative URL against external host ([20ae088](https://github.com/ehrhart/rdf-workbench/commit/20ae08845b7d3d2580a811e252f727dfa2faa5bf))
* **logout:** use relative redirect to avoid internal host ([2c1fbce](https://github.com/ehrhart/rdf-workbench/commit/2c1fbce0a02b6eaf6457f538cd3651da939a3129))
* **monitor:** abort Virtuoso queries by cancelling their request ([51b5435](https://github.com/ehrhart/rdf-workbench/commit/51b54359f8279a3bb5a7609cd135374726a5c4aa))
* **nav:** group documentation links under a Help item ([4ca87d0](https://github.com/ehrhart/rdf-workbench/commit/4ca87d01f08940769e7943533a864d0167d2b490))
* **nav:** remove dead /help link, keep external doc links ([8caeef7](https://github.com/ehrhart/rdf-workbench/commit/8caeef7470999eb4a89379a2babfca15342f4a3a))
* **sidebar:** keep nav and user items consistent when collapsed ([6a53863](https://github.com/ehrhart/rdf-workbench/commit/6a53863f4286d8ef7f2627f3d4d398dc148d0660))
* **sparql:** distinguish query timeout from user abort ([fdd6558](https://github.com/ehrhart/rdf-workbench/commit/fdd65582805f433d1e9804a05ad9f51288dfbdfb))
* **sparql:** honor format query param on public endpoint ([209f6bf](https://github.com/ehrhart/rdf-workbench/commit/209f6bfc8251f980e5d8d014f9eb44babb0c3ce7))
* **sparql:** keep editor alive across tabs and surface autocomplete failures ([45ca05b](https://github.com/ehrhart/rdf-workbench/commit/45ca05bbdeb44b1313f453782909ed4a34db1a4f))
* **sparql:** serialize downloads from fetched results instead of re-running ([70551f9](https://github.com/ehrhart/rdf-workbench/commit/70551f9f11a15eba31ab4ef73dbf3bdbce715ef9))
* **sparql:** show only result views compatible with the result type ([d70ab93](https://github.com/ehrhart/rdf-workbench/commit/d70ab93c8c8799e2ca33e58ffdff7c3f324155ad))
