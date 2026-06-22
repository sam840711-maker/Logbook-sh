/* SH Pilot Logbook — single version source.
   Bump THIS one line each release. The page footer, the service-worker cache
   key, and the PDF header tag all read from here, so there is only one place
   to change. Loaded in the page via <script src="version.js"> (sets
   window.APP_VERSION) and in the service worker via importScripts('version.js')
   (sets self.APP_VERSION). */
var APP_VERSION = 'v0.5aj';
