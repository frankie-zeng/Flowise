import { INodeCredential, INodeParams } from '../src/Interface'

class CaoApiCredential implements INodeCredential {
    label: string
    name: string
    version: number
    inputs: INodeParams[]

    constructor() {
        this.label = 'CAO Server'
        this.name = 'caoApi'
        this.version = 1.0
        this.inputs = [
            {
                label: 'Server URL',
                name: 'serverUrl',
                type: 'string',
                placeholder: 'http://127.0.0.1:9889',
                description: 'cao-server base URL. Leave empty to use CAO_SERVER_URL.'
            },
            {
                label: 'Bearer Token',
                name: 'bearerToken',
                type: 'password',
                optional: true,
                description: 'Sent as Authorization when cao-server auth is enabled. CAO_BEARER_TOKEN is the env fallback.'
            }
        ]
    }
}

module.exports = { credClass: CaoApiCredential }
