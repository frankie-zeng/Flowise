import axios from 'axios'
import crypto from 'crypto'
import { Application, Request, Response } from 'express'
import { StatusCodes } from 'http-status-codes'
import { setTokenOrCookies } from '../../enterprise/middleware/passport'
import logger from '../../utils/logger'
import { casdoorAuthorizeUrl, casdoorProfileEmail, getCasdoorConfig, isAuthBypassEnabled, publicAuthConfig } from './config'
import { provisionExternalUser } from './provisionUser'

const STATE_COOKIE = 'casdoor_oauth_state'

const secureCookie = (): boolean => {
    return process.env.NODE_ENV === 'production' || (process.env.APP_URL || '').startsWith('https://')
}

const loginUser = (req: Request, res: Response, user: any, redirect: boolean) => {
    const establish = () => {
        req.login(user, { session: true }, (error) => {
            if (error) {
                if (redirect) {
                    return res.redirect(`/signin?error=${encodeURIComponent(JSON.stringify({ message: 'Login failed' }))}`)
                }
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Login failed' })
            }
            return setTokenOrCookies(res, user, true, req, redirect, true)
        })
    }
    if (req.session) {
        req.session.regenerate((error) => {
            if (error) return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Session regeneration failed' })
            establish()
        })
        return
    }
    establish()
}

const redirectError = (res: Response, message: string) => {
    res.redirect(`/signin?error=${encodeURIComponent(JSON.stringify({ message }))}`)
}

export const initializeCasdoorAuth = (app: Application): void => {
    app.get('/api/v1/auth/config', (_req, res) => {
        res.json(publicAuthConfig())
    })

    app.post('/api/v1/auth/bypass', async (req, res) => {
        if (!isAuthBypassEnabled()) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: 'Not found' })
        }
        try {
            const user = await provisionExternalUser({
                email: 'dev@localhost.local',
                name: 'Local Dev',
                ssoProvider: 'auth-bypass',
                ssoSubjectId: 'local-dev'
            })
            return loginUser(req, res, user, false)
        } catch (error) {
            logger.error(`[auth-bypass] ${(error as Error).message}`)
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: (error as Error).message || 'Auth bypass failed' })
        }
    })

    const config = getCasdoorConfig()
    if (!config) return

    app.get('/api/v1/casdoor/login', (_req, res) => {
        const state = crypto.randomBytes(16).toString('hex')
        res.cookie(STATE_COOKIE, state, {
            httpOnly: true,
            sameSite: 'lax',
            secure: secureCookie(),
            maxAge: 10 * 60 * 1000
        })
        res.redirect(casdoorAuthorizeUrl(config, state))
    })

    app.get('/api/v1/casdoor/callback', async (req, res) => {
        try {
            const code = String(req.query.code || '')
            const state = String(req.query.state || '')
            if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) {
                return redirectError(res, 'Casdoor login was rejected')
            }
            res.clearCookie(STATE_COOKIE)

            const tokenResponse = await axios.post(
                `${config.endpoint}/api/login/oauth/access_token`,
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    code,
                    redirect_uri: config.redirectUri
                }).toString(),
                { headers: { 'content-type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
            )
            const accessToken = tokenResponse.data?.access_token
            if (!accessToken) return redirectError(res, 'Casdoor did not return an access token')

            const profileResponse = await axios.get(`${config.endpoint}/api/userinfo`, {
                headers: { authorization: `Bearer ${accessToken}` },
                timeout: 15000
            })
            const profile = profileResponse.data || {}
            const email = casdoorProfileEmail(profile)
            const subject = String(profile.sub || profile.id || '')
            if (!email || !subject) return redirectError(res, 'Casdoor profile is missing an email and subject')

            const name = String(profile.name || profile.displayName || profile.preferred_username || email).slice(0, 100)
            const user = await provisionExternalUser({
                email,
                name,
                ssoProvider: 'casdoor',
                ssoSubjectId: subject
            })
            user.ssoToken = accessToken
            if (tokenResponse.data?.refresh_token) user.ssoRefreshToken = tokenResponse.data.refresh_token
            user.ssoProvider = 'casdoor'
            return loginUser(req, res, user, true)
        } catch (error) {
            logger.error(`[casdoor] ${(error as Error).message}`)
            return redirectError(res, 'Casdoor login failed')
        }
    })

    logger.info('[casdoor] OIDC login enabled')
}
