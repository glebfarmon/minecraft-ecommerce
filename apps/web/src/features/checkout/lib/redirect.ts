/** A full navigation to the payment page. Its own module because jsdom's `window.location` cannot be stubbed in tests. */
export const redirectTo = (url: string) => {
  window.location.assign(url)
}
