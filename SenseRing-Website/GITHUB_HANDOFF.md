# GitHub source handoff — 28 October 2026

This directory can be the root of its own repository. Start with README.md. The matching versions are firmware 2.2.5-touch, website 3.5.2, Windows companion 2.3.1 and Android 1.3.0. Current control code and app assets are unchanged; documentation and portable source packaging were refreshed.

Upload the extracted files, including dotfiles and the Gradle wrapper where present. Existing .git history, private signing material, local SDK configuration, toolchains, caches, runtime logs and generated builds are excluded. The source tree grants no new open-source license; see RIGHTS_AND_NOTICES.md.

The combined source handoff also contains cross-project wiring/protocol, troubleshooting, upload and package-validation documents. Current firmware has no battery telemetry or charging implementation; fixed UI battery display values are not measurements. See VALIDATION.md for recorded checks and limits.

SOURCE_MANIFEST_SHA256.json covers this source snapshot. Its hashes refer to the supplied files before Git newline conversion or subsequent edits.

Use GitHub Desktop or Git for the included portable companion ZIP. GitHub browser uploads have a 25 MiB per-file limit. Source: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
