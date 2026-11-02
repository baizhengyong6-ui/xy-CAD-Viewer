import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const localPath = resolve(root, 'harmony/signing/local.json')
const profilePath = resolve(root, 'harmony/build-profile.json5')

if (!existsSync(localPath)) {
  console.log('No harmony/signing/local.json. Leave signing to DevEco automatic signing, or copy local.example.json.')
  process.exit(0)
}

const local = JSON.parse(readFileSync(localPath, 'utf8'))
const profile = JSON.parse(readFileSync(profilePath, 'utf8'))
const required = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword', 'certpath', 'profile']
for (const key of required) {
  if (!local[key]) {
    console.error(`harmony/signing/local.json is missing ${key}`)
    process.exit(1)
  }
}

profile.app.signingConfigs = [
  {
    name: 'default',
    type: 'HarmonyOS',
    material: {
      certpath: local.certpath,
      keyAlias: local.keyAlias,
      keyPassword: local.keyPassword,
      profile: local.profile,
      signAlg: local.signAlg || 'SHA256withECDSA',
      storeFile: local.storeFile,
      storePassword: local.storePassword,
    },
  },
]
for (const product of profile.app.products) {
  product.signingConfig = 'default'
}
writeFileSync(profilePath, `${JSON.stringify(profile, null, 2)}\n`)
console.log('Wrote HarmonyOS signingConfig "default" into harmony/build-profile.json5')
