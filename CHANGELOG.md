# Changelog

## [1.5.0](https://github.com/ehrhart/rdf-workbench/compare/v1.4.0...v1.5.0) (2026-10-28)


### Features

* **appearance:** runtime theme and branding customization ([ae2263a](https://github.com/ehrhart/rdf-workbench/commit/ae2263a7eafbe5a93e30508dd6ad7b403126cf5c))
* **ask:** run AI summary and profile generation as background jobs ([5e0d036](https://github.com/ehrhart/rdf-workbench/commit/5e0d0366490aa9155079fb7d8c4c5a056b9ec7b6))
* **frontend:** accept short names in the SPARQL format parameter ([dfca02e](https://github.com/ehrhart/rdf-workbench/commit/dfca02e3e0b07d0123db907870139bb67a21d693))
* **frontend:** add anonymous SPARQL access toggle ([769ff75](https://github.com/ehrhart/rdf-workbench/commit/769ff7587cf5f8215ef29f9b7317e1461c36c8dc))
* **frontend:** add change-password to the header account dropdown ([ce4197a](https://github.com/ehrhart/rdf-workbench/commit/ce4197a1b69f4ba9ba5e35ebb96acb45bb6ac913))
* **frontend:** add settings store and editable access flags ([26bae8d](https://github.com/ehrhart/rdf-workbench/commit/26bae8d87927de58c541860689d8fece0d97be78))
* **frontend:** link the change-password brand to the overview page ([7ab9150](https://github.com/ehrhart/rdf-workbench/commit/7ab915087050b2eda9be97b7f8c153b6bce47fb3))
* **frontend:** make CORS on the public SPARQL endpoints configurable ([a7203f0](https://github.com/ehrhart/rdf-workbench/commit/a7203f032823647a3fca6df6fcaa288a3b5979c7))
* **frontend:** move AI tuning knobs into the settings store ([e6d09cd](https://github.com/ehrhart/rdf-workbench/commit/e6d09cdec63083503449e25a4adb3c5caee81e05))
* **frontend:** offer change-password on the own row in user admin ([6324491](https://github.com/ehrhart/rdf-workbench/commit/632449103bbd33cd9b3c1bd9b3d7dca799d40876))
* **frontend:** reuse monitored queries in the SPARQL console ([60d6173](https://github.com/ehrhart/rdf-workbench/commit/60d617349fe6fd6fa402da6b0eecd4d023d99fda))
* **frontend:** rework namespaces pages ([9c13e59](https://github.com/ehrhart/rdf-workbench/commit/9c13e59c0ae1dfbc43bf6efb61b4b5489812e31f))
* **frontend:** rework radius scale and add sidebar style setting ([b1f8a7a](https://github.com/ehrhart/rdf-workbench/commit/b1f8a7afb16426703dac4965825de1eaf8f1e264))
* **frontend:** serve RDF serializations for dereferenceable resource URLs ([43e5af3](https://github.com/ehrhart/rdf-workbench/commit/43e5af36be27ef23645daa53e67061303b92017f))
* **frontend:** serve the SPARQL protocol from /sparql ([4a69531](https://github.com/ehrhart/rdf-workbench/commit/4a69531e35a465c43f0b23d77b920d2d1cecee2f))
* **frontend:** show the custom logo on shared chat pages ([3fee6d8](https://github.com/ehrhart/rdf-workbench/commit/3fee6d833a9e202bdaa7dec27af1235d25cd82c9))
* **frontend:** show user initials avatar in the header account button ([971d5e9](https://github.com/ehrhart/rdf-workbench/commit/971d5e913639b0f52ff51751b51ccdb9d09e5862))
* **frontend:** treat output= as an alias of format= ([bcf1aff](https://github.com/ehrhart/rdf-workbench/commit/bcf1aff602adf961fb0f525e990ab5c29b22afec))
* **monitor:** admin-only monitor subtree and badge ([c70cd78](https://github.com/ehrhart/rdf-workbench/commit/c70cd78a39f06c2742596c7c9ecfe00bf4d55053))
* **monitor:** one shared query registry for all providers ([a01b396](https://github.com/ehrhart/rdf-workbench/commit/a01b3964b365e2112be55b090d0ac61b7c105572))
* **monitor:** registry-backed query monitor across providers ([35861b4](https://github.com/ehrhart/rdf-workbench/commit/35861b4da907a6c9ca154333870a313140f33be0))
* **monitor:** show every SPARQL query in the query monitor ([#13](https://github.com/ehrhart/rdf-workbench/issues/13)) ([5559d1f](https://github.com/ehrhart/rdf-workbench/commit/5559d1f021cda3192bff66579a25d4bba8a3f20d))
* **prefixes:** render IRIs and datatypes with user-defined prefixes in tables ([407fc90](https://github.com/ehrhart/rdf-workbench/commit/407fc90ca8331bdce4eb407d1206afb5759653a4))
* **provider:** add generic triplestore provider ([0f259bb](https://github.com/ehrhart/rdf-workbench/commit/0f259bb8f6ea6ba40d3e77ea51c6e54af13eac34))
* **routing:** move the dashboard to /overview ([8800b05](https://github.com/ehrhart/rdf-workbench/commit/8800b0577b07ec41e211f356974e3ac2d225b231))
* **sparql:** serve the console page for format=text/html ([33807b4](https://github.com/ehrhart/rdf-workbench/commit/33807b4903296b0b9091860ad0c8115b1194a388))


### Bug Fixes

* **adapter:** escape values in bulk load commands ([2ed74e6](https://github.com/ehrhart/rdf-workbench/commit/2ed74e67ef25d795fd082d42daecbd5b262aa189))
* **adapter:** keep error details out of API responses ([465b1d6](https://github.com/ehrhart/rdf-workbench/commit/465b1d66fff63f129bb587e8c19378d2d479874c))
* **adapter:** name uploads server-side and contain shared paths ([00ae2af](https://github.com/ehrhart/rdf-workbench/commit/00ae2af3bec2400b65cdb10ee4a7b12561cf41e8))
* **adapter:** reject malformed graph IRIs on deletion ([5759fb4](https://github.com/ehrhart/rdf-workbench/commit/5759fb47fcfd091b5316f684f71f28afe1e4ca7d))
* **adapter:** restrict remote imports to http(s) URLs ([3b0f424](https://github.com/ehrhart/rdf-workbench/commit/3b0f4249f912faeece9f525f46a739788e9bab6f))
* **adapter:** run the container as a non-root user ([fcc5ff7](https://github.com/ehrhart/rdf-workbench/commit/fcc5ff780d7e523da54e7c279f92b3fe2ede8f19))
* **adapter:** stream remote downloads to disk ([49981c5](https://github.com/ehrhart/rdf-workbench/commit/49981c548125d621fd43165c528cd4fd885ca0fe))
* **app:** add baseline response headers and hide the framework banner ([9bb34e6](https://github.com/ehrhart/rdf-workbench/commit/9bb34e6cc9fb02a35a394788b2119180ff537241))
* **ask:** rate-limit anonymous assistant requests ([5626c71](https://github.com/ehrhart/rdf-workbench/commit/5626c7182ae57c7efe0ddbc7b4b4069d05c1d33f))
* **auth:** ask for the current password on self-service changes ([20c52f3](https://github.com/ehrhart/rdf-workbench/commit/20c52f3770e174aa365e5da374c93eea0ee0b208))
* **auth:** block admin password self-reset that revoked own session ([173c7d9](https://github.com/ehrhart/rdf-workbench/commit/173c7d94eaf955e3c2e34e6c7bc3cc4e3c80c092))
* **auth:** flag the seeded admin for a password change ([02195e1](https://github.com/ehrhart/rdf-workbench/commit/02195e17c934b79a4363f0dbace3a6af6f4238d5))
* **auth:** mark the session cookie secure for https deployments ([0f9a1d3](https://github.com/ehrhart/rdf-workbench/commit/0f9a1d3761995d0b595b40ae44ac28eebd469dbb))
* **auth:** throttle sign-in and time-equalize unknown users ([033c4d5](https://github.com/ehrhart/rdf-workbench/commit/033c4d5383f3de1e1b867687ecb15ef7ee911110))
* **csv:** neutralize formula characters in exported cells ([7f5276d](https://github.com/ehrhart/rdf-workbench/commit/7f5276d247c9392aae877ee05c87f92664cd9ba8))
* **dashboard:** skip running-queries polling when signed out ([3b0a56c](https://github.com/ehrhart/rdf-workbench/commit/3b0a56c541ab2d9657fc75a1f28eacb44a23e97b))
* **deploy:** bind the oxigraph port to localhost ([fb241f0](https://github.com/ehrhart/rdf-workbench/commit/fb241f0f80d06d3ce419b23cee5b308d19d488bc))
* **dereference:** validate paths against the URL parser instead of a slug regex ([6231b36](https://github.com/ehrhart/rdf-workbench/commit/6231b36d9df4c8c75c76c2bcb373e58f915b1292))
* **docker:** pass the anonymous access flags through Compose ([261a5dc](https://github.com/ehrhart/rdf-workbench/commit/261a5dc582ad439ad2c72955686a6d81d00d4bb6))
* **docker:** skip lefthook install when building outside a git repository ([03bfdda](https://github.com/ehrhart/rdf-workbench/commit/03bfdda64d3d64ce5a9eaa4d593689750216d1ce))
* **frontend:** adapt sidebar footer text, logo, and avatar to custom sidebar colors ([b16b0c6](https://github.com/ehrhart/rdf-workbench/commit/b16b0c686fb7834defa0995aa319bc5cf0ddaddb))
* **frontend:** autofocus the first field of the change-password form ([39cc470](https://github.com/ehrhart/rdf-workbench/commit/39cc470cd27b3e10ec960c1058ba4e5e88903224))
* **frontend:** dereference bare resource paths ([c88be33](https://github.com/ehrhart/rdf-workbench/commit/c88be331aa0fcc5aee977409b8be472dd46ba668))
* **frontend:** drop hardcoded headings from loading skeletons ([1ebea86](https://github.com/ehrhart/rdf-workbench/commit/1ebea86132b406457369c9c37f2b947d1437f99c))
* **frontend:** drop the minimum-length note from change-password ([ea9adff](https://github.com/ehrhart/rdf-workbench/commit/ea9adffde43613f726a63886f408414ab03e8ef4))
* **frontend:** gate SPARQL endpoints behind the anonymous-read flag ([79c016e](https://github.com/ehrhart/rdf-workbench/commit/79c016e339489c56220f5d4bc595283f16b1c1ed))
* **frontend:** keep the bootstrap admin off the forced password change ([8de91a2](https://github.com/ehrhart/rdf-workbench/commit/8de91a2dec4295447657a2529c0fca3ffab78fa3))
* **frontend:** make appearance defaults round-trip and preview match the app ([70d00d7](https://github.com/ehrhart/rdf-workbench/commit/70d00d7b59e4e3accc84d32989f83c17e3d375d9))
* **frontend:** make the ask chat input radius follow the appearance theme ([c07b5e4](https://github.com/ehrhart/rdf-workbench/commit/c07b5e48da0706457bf19ae5fb856e078bb5297b))
* **frontend:** remove the spacing frame around the sidebar ([b8975a9](https://github.com/ehrhart/rdf-workbench/commit/b8975a9e2c1db7b436a269d081efc8b19ffff26b))
* **frontend:** rewrite UI text ([e8ae440](https://github.com/ehrhart/rdf-workbench/commit/e8ae440e95079840d2d782c99c1c64fa219d4525))
* **frontend:** show Thinking as soon as a message is sent ([51faa74](https://github.com/ehrhart/rdf-workbench/commit/51faa745a54ae75abfb2aecee1714c5d60ef4bd0))
* **frontend:** swap native role selects for the shared Select ([b9e18e5](https://github.com/ehrhart/rdf-workbench/commit/b9e18e5a640174124f570811534f3ac5af6695eb))
* **graphs:** require a session for graph deletion ([0fcd1af](https://github.com/ehrhart/rdf-workbench/commit/0fcd1afc1e0ebe9c2a7bd5f21cfce930cdc0017b))
* **import:** encode job ids in adapter request paths ([a7a1083](https://github.com/ehrhart/rdf-workbench/commit/a7a1083546b37f8350308538f6090258a4628f2b))
* **import:** require the admin role for the import surface ([5247bcd](https://github.com/ehrhart/rdf-workbench/commit/5247bcde18c231b58e3732d700c3a5c6b2793b9f))
* **import:** run upload cleanup on the server after uploads ([06a9e89](https://github.com/ehrhart/rdf-workbench/commit/06a9e89f0d2301326c859b158d55d63b8c268a0c))
* **import:** sanitize the staged file name on forward ([f0d2d78](https://github.com/ehrhart/rdf-workbench/commit/f0d2d7855764691066dbe96e8ef5769aad43dd22))
* **import:** time out adapter requests ([3a1caee](https://github.com/ehrhart/rdf-workbench/commit/3a1caee9470b93d13f208d6e71c9f19cc20f7f90))
* **isql:** require the admin role for the console and API ([5c47efc](https://github.com/ehrhart/rdf-workbench/commit/5c47efc5fd692d1780220fb4cf56e99fbf9bd1f8))
* **logout:** send the bare logout fallback to /overview ([6850fcc](https://github.com/ehrhart/rdf-workbench/commit/6850fcc995dd7330f4a1ff95836fb084094829b5))
* **monitor:** allowlist system stat ids in the server action ([d3e81b8](https://github.com/ehrhart/rdf-workbench/commit/d3e81b89a03c933d674e7791a045713f48100dae))
* **monitor:** cancel the aborted query on qlever itself ([1deb3ff](https://github.com/ehrhart/rdf-workbench/commit/1deb3ff9d18ef3c1a78faf51a13fc2d48368e01c))
* **monitor:** share the query registry across route bundles ([8a0b6d1](https://github.com/ehrhart/rdf-workbench/commit/8a0b6d1c9da93c71ea1b7d9a6af3807068394398))
* **oxigraph:** validate import URLs and graphs as IRIs ([864622a](https://github.com/ehrhart/rdf-workbench/commit/864622a8d79226a2a92cd850eb3090c3be0ad773))
* **redirect:** reject backslashes in internal redirect targets ([6ae6b51](https://github.com/ehrhart/rdf-workbench/commit/6ae6b5109401609d9c57b5100547ebae6791524a))
* **resource:** only link http, https, and mailto URIs ([54de7b7](https://github.com/ehrhart/rdf-workbench/commit/54de7b758e0d194e15b981e85ed1bcda3927f5a5))
* **resource:** validate URIs before building resource queries ([db1d7e0](https://github.com/ehrhart/rdf-workbench/commit/db1d7e05915c47dccfaf60a40d73661e2f18ab89))
* **saved-queries:** show owner names to admins and owners only ([bd2932d](https://github.com/ehrhart/rdf-workbench/commit/bd2932d2803eceaf2950b827c43f5732e1b7ece1))
* **sparql:** generate query registry ids server-side ([4db5468](https://github.com/ehrhart/rdf-workbench/commit/4db54689e856162e5331d7d80ba62cee0ac33d35))
* **sparql:** require a session for updates on the public endpoint ([d50c22c](https://github.com/ehrhart/rdf-workbench/commit/d50c22cdb74d08160349a0808f6397930d11cb62))
* **uploads:** resolve staged files inside the uploads directory ([e783c4e](https://github.com/ehrhart/rdf-workbench/commit/e783c4e1f601fb1af5d53b0a679ededc42769b3c))
* **virtuoso:** escape the search term in resource search ([fd951ba](https://github.com/ehrhart/rdf-workbench/commit/fd951ba428c69f2ea072fe227cf2e099eae92727))
* **virtuoso:** escape values in fulltext rule commands ([00ffcef](https://github.com/ehrhart/rdf-workbench/commit/00ffcef8630b649fa5f4836fe1ae27f7b5c53720))

## [1.4.0](https://github.com/ehrhart/rdf-workbench/compare/v1.3.0...v1.4.0) (2026-10-12)


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
* **dereference:** let the access rule match multi-segment resource paths ([53d6133](https://github.com/ehrhart/rdf-workbench/commit/53d61334bcca40aadeaf98a60704648482fa63bb))
* **dereference:** serve resource routes with multi-segment ids ([fcde2da](https://github.com/ehrhart/rdf-workbench/commit/fcde2da56ffcc9b699c9e4bde8619bf709570fb4))
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
