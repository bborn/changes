/** Cloud settings are authoritative because they represent the shared library session. */
export function mergeRestoredSettings(localSettings = {}, cloudSettings = {}) {
  return { ...localSettings, ...cloudSettings };
}

/** Return the tune object as well as its slug so custom tunes need no state round trip. */
export function chooseInitialTune(tunes, savedSlug) {
  return tunes.find((tune) => tune.slug === savedSlug) || tunes[0] || null;
}

export function isPracticeSpace(event, typing = false) {
  return (
    (event.code === "Space" || event.key === " ") &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.isComposing &&
    !typing
  );
}
