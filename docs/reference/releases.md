# Changelog

Release notes for nextExplorer. GitHub remains the source of truth: https://github.com/vikramsoni2/nextExplorer/releases

Releases are listed newest to oldest.

## v2.0.7 (2025-12-23)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.7)

### What's Changed

#### New Features
- added option to choose color-scheme in editor
  ![Editor Theme Selection](/images/editor-theme-1.png)

#### Bugfixes
- OIDC error redirects to login screen
- teminal menu style fix
- loading indicator style fix

- context menu hide unrelated options based on readonly/shared path

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.6...v2.0.7


## v2.0.6 (2025-12-20)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.6)

### What's Changed

- added demo url
- added OIDC_AUTO_CREATE_USERS option
- share option in context menu
- home button in mobile view

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.5...v2.0.6

## v2.0.5 (2025-12-19)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.5)

### What's Changed

- Updated login page layout, language selection now on top right
- Added option to resize columns and sort by column header on detail view
- Added keyboard shortcuts and confirm on close on default text editor.
- Various UI fixes

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.4...v2.0.5

## v2.0.4 (2025-12-18)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.4)

### What's Changed

- admin username/password in env ( skips setup ) AUTH_USER_EMAIL and AUTH_USER_PASSWORD
- fix dark mode for iOS and the scrolling in mobile.
- added system color scheme ( auto mode )
- various UI fixes
- fix thumbnail orientation


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.3...v2.0.4

## v2.0.3 (2025-12-17)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.3)

### What's Changed

- terminal menu color in light mode
- add volumes features for users (USER_VOLUMES)
- removed  unnecessary chown on /app
- dockerfile and healthcheck fixes now uses nodejs without curl dependencies
- ellipsis fix and file thumbnail overflow fix
- updated breadcrumb
- show message for folder when empty
- folder views more responsive UI fixes
- added swedish language support
- refactor i18n
- date validation added for share dialog
- fixing guest session overriding user session
- added documentation for user volumes feature
- added ghcr.io image

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.2...v2.0.3

## v2.0.2 (2025-12-09)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.2)

### What's Changed

- open with editor option for any file
- download on context menu
- docker health check
- fix for file rename mouse select
- responsive ellipsis on detail view
- added avatar url from token + user claims
- SKIP_HOME env var takes user to first volume

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.1...v2.0.2

## v2.0.1 (2025-12-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.1)

### What's Changed
* fix download failing from share
* fix downloading dotfiles
* shared files now show thumbnails
* retouched Ui of share view


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v2.0.0...v2.0.1

## v2.0.0 (2025-12-03)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v2.0.0)

### What's Changed

#### File Sharing System

  - Added complete file sharing functionality with share links
  - New "Shared by Me" view to manage outgoing shares
  - New "Shared with Me" view to access incoming shares
  - Share dialog with permissions management
  - Guest session support for anonymous access
  - Share link creation and management with expiration options
  - Access control for shared resources

 #### Personal Directories

  - Added user personal directory feature
  - Individual user storage spaces with proper isolation


#### Architecture & Refactoring

  - Reorganized backend codebase into src/ folder structure
  - Improved code organization and modularity
  - Enhanced middleware architecture
  - New services: sharesService.js, guestSessionService.js, accessManager.js
  - Refactored authentication middleware with better access control

 #### UI/UX Improvements

  - Redesigned authentication screen with better UI
  - Updated home view with new icon styling
  - Enhanced directory icon rendering
  - Improved folder view toolbar with share actions
  - Fixed image preview loading flicker
  - Added toolbar separator for better visual organization
  - Responsive design improvements
  - Better breadcrumb navigation with share context

 #### Internationalization

  - Refactored translation system
  - Updated all language files (EN, DE, ES, FR, HI, PL, ZH)
  - Improved translation structure and consistency

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.2.4...v2.0.0

## v1.2.4 (2025-11-26)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.2.4)

### What's Changed
* i18n polish language support  #108
* Tailwind v4
* UI theme simplified
* drag rectangle to select items
* faster file listing, thumbnail generation in queue, concurrent thumbnail job configuration #117
* heif file thumbnail preview
* fix [downloading directory with Cyrillic characters #122
* manage iles and folder permissions from info panel #

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.2.3...v1.2.4

## v1.2.3 (2025-11-18)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.2.3)

### What's Changed

- thumbnail errors are fixed. now if the thumbnail cannot be generated, it sends the original file for preview
- centralized error handler on backend, and created a notification system which shows all errors on frontend as notification
- improved re-ordering of favourites using vuedraggable and sortable.js
- added integrated terminal available only to admins

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.2.2...v1.2.3

## v1.2.2 (2025-11-18)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.2.2)

### What's Changed
* Favourites when AUTH_ENABLED=false
* persist sessions across server restarts
* scrollbar on left menu
* disable +Create New button on Volume view

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.2.1...v1.2.2

## v1.2.1 (2025-11-16)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.2.1)

### What's Changed
* favorites can be customized now, user can choose name, color, style and reorder them too.

## BREAKING
all existing favorites will be assigned to the first user since the existing favorites were not user specific

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.2.0...v1.2.1

## v1.2.0 (2025-11-16)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.2.0)

### What's Changed
#### added OIDC_REQUIRE_EMAIL_VERIFIED flag
optional and by default set to 'false' if user wants to integrate OIDC with verified emails only they can set it to 'true'.

#### Skip setup if auth mode set to oidc
previously if its a fresh start with OIDC integration with only OIDC mode, it still used to ask to create an admin user. now it just shows the OIDC login button

#### faster download and cleaned up upload service
it was using js fetch which used to download the files in memory until completed and then used to download it to user's system. Now using native file download which instantly downloads the files.

#### EDITOR_EXTENSIONS env added
this env flag supports comma separated extensions names which you want to open with default built in editor.
keep in mind that the ONLYOFFICE_FILE_EXTENSIONS take priority over this list. so if you have html in EDITOR_EXTENSIONS and in ONLYOFFICE_FILE_EXTENSIONS both, it will open with OnlyOffice.

#### Added "New File" option in the create menu.
it was difficult to create new files if the folder is full and has no empty space to click on the background. adding this button makes it simpler

#### Various bugfixes
drive icon was not respecting app color scheme.
improvement and optimization on uploadService


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.9...v1.2.0

## v1.1.9a (2025-11-15)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.9a)

### What's Changed
* faster download and cleaned up upload service by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/93

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.9b...v1.1.9a

## v1.1.9b (2025-11-14)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.9b)

### What's Changed
* added OIDC_REQUIRE_EMAIL_VERIFIED flag by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/91
* skip setup if auth mode set to oidc by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/92


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.9...v1.1.9b

## v1.1.9 (2025-11-14)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.9)

### What's Changed
* docs updated
* improved search performance and bug fixes
* AUTH_MODE added
* version bump


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.8...v1.1.9

## v1.1.8 (2025-11-13)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.8)

### What's Changed

#### Refactored authentication
* username -> email. now users login by email. its done to simplify linking of OIDC with local accounts and create users with custom access in future
* existing users will get "example.local" suffix that can be changed from admin menu
* added option to edit existing users

#### Improved Search
* spotlight like search for looking up files and folders.
* it also searches inside text files and highlights matching texts

#### new UI
* some UI tweaks

#### Vitepress documentations
* docs are migrated to vittepress. Work in progress to update the docs

#### multi language support
* added i18n support for various language. new language requests can be created in github issues

#### AUTH_ENABLED=false to remove auth completely
* now users can remove the entire auth module by this docker flag.


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.7...v1.1.8

## v1.1.7 (2025-11-10)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.7)

### What's Changed
* The image preview now supports previous and next option

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.6...v1.1.7

## v1.1.6 (2025-11-10)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.6)

### What's Changed
* Refactoring API for better scalability and DX
* refactored plugin architecture
* fixed onlyoffice plugin issues
* small UI tweaks

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.5...v1.1.6

## v1.1.5 (2025-11-09)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.5)

### What's Changed
*  reverting multi image carousel in image preview because of bugs

## v1.1.4 (2025-11-08)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.4)

### What's Changed
* fixed openoffice initialization issue if /features fails without auth by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/69
* version bump and readme updated by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/70


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.3...v1.1.4

## v1.1.3 (2025-11-08)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.3)

### What's Changed

* added next prev option to image preview lightbox
* added ONLYOFFICE_LANG env for setting language on onlyoffice
* ONLYOFFICE_FILE_EXTENSIONS to specify custom list of file. Any extension mentioned here will take higher priority then default viewer/editor

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.2...v1.1.3

## v1.1.2 (2025-11-06)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.2)

### What's Changed
* drag and drop support
* leaner session and bugfixes
* Refactor: centralize file actions
* keyboard shortcuts
* onlyoffice integration

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.1...v1.1.2

## v1.1.1 (2025-11-05)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.1)

### What's Changed

- OpenID Compliant claims fetching using userinfo callback
- OIDC_USERINFO_URL parameter for custom userinfo endpoints
- Added detailed debug logging throughout the application for better traceability.
- Updated express-openid-connect dependency to version 2.19.2.
- Introduced userinfo URL override in oidcService for more flexible user info fetching.
- Configured Docker environment for debug logging.
- allow spaces in admin groups, if user provides comma separated values
- view mode picture added to show picture gallery
- info panel to display additional information about file/folder/images


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.1.0...v1.1.1

## v1.1.0 — local user management, logging and OIDC fixes (2025-11-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.1.0)

### What's Changed
* Added mkdocs hosted at explorer.nxz.ai
* used sqlite db for user persistance
* using express-openid-connect by auth0 for integration with OIDC providers.
* Centralized version management
* Admin can now create, delete and manage local users from UI
* about screen shows git commit hash
* local user can reset their passwords

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.0.7...v1.1.0

## v1.0.7 — enhancements and bug fixes (2025-11-01)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.7)

- added OIDC support for multi-user
- added user menu in the sidebar
- added tooltips to icons
- added public url for proxies, preparation for file sharing
- sidebar now resizable
- search in the current directory for files and content inside files as well using ripgrep
- added right-click context menu for file actions
- new file creation option in context menu
- responsive sidebar, breadcrumb and view mode options
- syntax highlighting for editor
- new folder option added to context menu as well

## v1.0.6 — Enhancements (2025-11-01)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.6)

### What's Changed

- added OIDC support for multi-user
- added user menu in the sidebar
- added tooltips to icons
- added public url for proxies, preparation for file sharing
- sidebar now resizable
- search in the current directory for files and content inside files as well using ripgrep
- added right-click context menu for file actions
- new file creation option in context menu
- responsive sidebar, breadcrumb and view mode options
- syntax highlighting for editor
- new folder option added to context menu as well

## v1.0.5 (2025-10-15)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.5)

### What's Changed
* settings screen which allows user to turn on or off the thumbnail generation
* option to disable/enable authentication
* support PGID and PUID just like linuxserver.io images
* added option to show the release version in the app.

## v1.0.4 (2025-10-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.4)

### What's Changed
* added docker hub overview
* simplified CI pipeline


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.0.3...v1.0.4

## v1.0.3 (2025-10-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.3)

### What's Changed
* add arm support by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/22


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.0.2...v1.0.3

## v1.0.2 (2025-10-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.2)

### What's Changed
* force favicon refresh by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/20


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.0.1...v1.0.2

## v1.0.1 (2025-10-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.1)

### What's Changed
* updated image name correctly by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/19


**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/compare/v1.0.0...v1.0.1

## v1.0.0 (2025-10-04)

[GitHub release](https://github.com/vikramsoni2/nextExplorer/releases/tag/v1.0.0)

### What's Changed
* Auth by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/1
* fixes by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/2
* file preview as plugin by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/3
* file icon fix by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/4
* favicons updated and better docker build setup by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/17
* docker build automation by @vikramsoni2 in https://github.com/vikramsoni2/nextExplorer/pull/18

### New Contributors
* @vikramsoni2 made their first contribution in https://github.com/vikramsoni2/nextExplorer/pull/1

**Full Changelog**: https://github.com/vikramsoni2/nextExplorer/commits/v1.0.0
