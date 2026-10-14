import JSDOMEnvironment from 'jest-environment-jsdom'

/**
 * jsdom has no fetch. Expose Node's, with relative URLs resolved against the jsdom origin (a
 * browser does that for `new Request('/api/…')`; Node's Request throws) and Node's AbortSignal
 * (Node's Request rejects jsdom's).
 */
export default class FetchJSDOMEnvironment extends JSDOMEnvironment {
  constructor(...args) {
    super(...args)
    const origin = this.dom.window.location.origin
    class RelativeRequest extends Request {
      constructor(input, init) {
        super(typeof input === 'string' ? new URL(input, origin).href : input, init)
      }
    }
    Object.assign(this.global, {
      fetch,
      Request: RelativeRequest,
      Response,
      Headers,
      AbortController,
      AbortSignal
    })
  }
}
