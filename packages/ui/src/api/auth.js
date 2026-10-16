import client from './client'

// auth
const resolveLogin = (body) => client.post(`/auth/resolve`, body)
const login = (body) => client.post(`/auth/login`, body)

// permissions
const getAllPermissions = (type) => client.get(`/auth/permissions/${type}`)
const ssoSuccess = (token) => client.get(`/auth/sso-success?token=${token}`)
const getAuthConfig = () => client.get('/auth/config')
const authBypass = () => client.post('/auth/bypass')

export default {
    resolveLogin,
    login,
    getAllPermissions,
    ssoSuccess,
    getAuthConfig,
    authBypass
}
