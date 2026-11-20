import { router, type Href } from 'expo-router';

export function goBackOrReplace(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Returns to the home page: back to the one already open underneath, or opens it if there is none. */
export function goHome() {
  router.dismissTo('/');
}
