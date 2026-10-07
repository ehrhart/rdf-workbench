# Changelog

## [1.4.0](https://github.com/ehrhart/rdf-workbench/compare/v1.3.0...v1.4.0) (2026-10-07)


### Features

* **admin:** add dataset profile card to AI settings ([0298bfd](https://github.com/ehrhart/rdf-workbench/commit/0298bfdd35286f5d2afd73c39fe9abce5fcaf67e))
* **ask:** add conversation share store and API ([f35293f](https://github.com/ehrhart/rdf-workbench/commit/f35293ffd7ff222f4f2b239b8b59a7e9bfde1847))
* **ask:** add natural-language ask assistant with chat UI and admin AI settings ([#11](https://github.com/ehrhart/rdf-workbench/issues/11)) ([dc867e2](https://github.com/ehrhart/rdf-workbench/commit/dc867e2a646fefabbf325b47ed61316deae378bb))
* **ask:** add share dialog to started conversations ([d23c2a2](https://github.com/ehrhart/rdf-workbench/commit/d23c2a2fb480e2489acc9ce07e8749bc4e1a0181))
* **ask:** render shared chats read-only at /share ([2bd8146](https://github.com/ehrhart/rdf-workbench/commit/2bd8146789e5b25b5014bab75235534f554fb8c3))
* **ask:** share from a popover with labeled icon buttons ([1c0e5ad](https://github.com/ehrhart/rdf-workbench/commit/1c0e5ada4815efa522a03341b14e42fe5b3be78a))
* **ask:** staleness dot and outline on the share button ([45c7505](https://github.com/ehrhart/rdf-workbench/commit/45c7505834462a50d8452d5a7aece2f938b92af4))
* **ask:** support Virtuoso full-text with bif:contains ([47753b8](https://github.com/ehrhart/rdf-workbench/commit/47753b8bd260203dcbcceafad4e99a74d1037424))
* **auth:** let admins change user roles ([42de5ab](https://github.com/ehrhart/rdf-workbench/commit/42de5ab2e1873f5dc814d532078a9619cb6ce93c))
* **auth:** offer a temporary password when creating users ([2654ee0](https://github.com/ehrhart/rdf-workbench/commit/2654ee0aaac5748008d23772bc34ebfd5a80e34e))
* **dereference:** seed paths from DEREFERENCE_PATHS ([aa36995](https://github.com/ehrhart/rdf-workbench/commit/aa3699543aa02fc268ce2e20b5240d4b2d3864df))
* **resource-manager:** add copy buttons for source and type URIs ([b61e843](https://github.com/ehrhart/rdf-workbench/commit/b61e8433cf9aa6cba523dc806c0ff3698ba861f1))


### Bug Fixes

* **ask:** allow engine-resolved predicates in AI queries ([be1453d](https://github.com/ehrhart/rdf-workbench/commit/be1453d6f67ed3ac7e264e44a540c489a744e3cd))
* **ask:** don't open the update tooltip when the share popover opens ([64d3279](https://github.com/ehrhart/rdf-workbench/commit/64d32798f445cb261ddcf6f18293ac4ef81aab0e))
* **ask:** inject today's date into the system prompt ([6a4a7e6](https://github.com/ehrhart/rdf-workbench/commit/6a4a7e63db2e84aa88d7cd593f86c615cb16d9d7))
* **ask:** recolor the staleness dot ([0408239](https://github.com/ehrhart/rdf-workbench/commit/0408239dee15e2eeab90b4e0db410fcae8928cf9))
* **ask:** restyle the composer send button ([af3d40f](https://github.com/ehrhart/rdf-workbench/commit/af3d40f140f8fe605984c764d4340809d8196c0a))
* **frontend:** track and document .env.example ([4320c64](https://github.com/ehrhart/rdf-workbench/commit/4320c64f9a00687f4ffe4915c2fc7a7368da081c))
* **resource-manager:** let Enter and Space reach links inside cells ([4097306](https://github.com/ehrhart/rdf-workbench/commit/4097306dc7561488104c7f844e579fbc71c8257c))
* **resource-manager:** show full literal values in triples table ([61d21c7](https://github.com/ehrhart/rdf-workbench/commit/61d21c7303a361785c43d3ba51fe0e6723f0720a))
* **runtime:** add typed totalTriples to EndpointOverview ([4f287ff](https://github.com/ehrhart/rdf-workbench/commit/4f287ffa7db2ed5c2af400714e2c67cad08f81c9))
* **sparql:** inline copy button on cell hover ([abad717](https://github.com/ehrhart/rdf-workbench/commit/abad71719cfd2918d0e072a58b65493a2eb22ea6))

## [1.3.0](https://github.com/ehrhart/rdf-workbench/compare/v1.2.0...v1.3.0) (2026-10-02)


### Features

* **frontend:** add ALLOW_ANONYMOUS_READ flag for public read pages ([72d5150](https://github.com/ehrhart/rdf-workbench/commit/72d51507cb86dbcec5ce9043d6acd7febb8f1bae))
* **frontend:** replace Copy Link with Copy snippet dropdown ([13cb867](https://github.com/ehrhart/rdf-workbench/commit/13cb867c9a54210aa0f98fbc6cb91a6d96ef6879))
* **frontend:** show update notice next to sidebar version ([6ceeb51](https://github.com/ehrhart/rdf-workbench/commit/6ceeb51b3fa79fb8a3f26dc39a3a92f164bade5c))


### Bug Fixes

* **auth:** require a session to stage chunked uploads ([d1f7c8c](https://github.com/ehrhart/rdf-workbench/commit/d1f7c8cbc64887142304c8f6a219c72137598a2e))
* **frontend:** size dropdown menus to their content ([a01904f](https://github.com/ehrhart/rdf-workbench/commit/a01904f9c8f32e414a6e8a59ce303998a8203fc1))

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
