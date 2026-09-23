/**
 * Small values shared between the extension host and the webview so the
 * same default doesn't need to be kept in sync by hand in multiple files.
 * (The `coworkerMeet.*` settings defaults in package.json are the source of
 * truth for what a fresh install actually uses; these are the fallbacks
 * used when a value wasn't provided at all, e.g. the webview before it
 * receives its `init` message.)
 */
export const DEFAULT_ROOM_NAME = 'coworker-standup';
export const DEFAULT_COWORKER_IDENTITY = 'anika-coworker';
