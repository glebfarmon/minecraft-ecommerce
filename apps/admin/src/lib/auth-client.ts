import {emailOTPClient, twoFactorClient} from 'better-auth/client/plugins'
import {createAuthClient} from 'better-auth/react'

/** Same-origin: the admin host routes /api/* to the API (Traefik; dev rewrites). */
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [emailOTPClient(), twoFactorClient()]
})
