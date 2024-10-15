import fs from 'node:fs'
import util from 'node:util'

const ignoreDetails = ['Apache-2.0', 'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause'];

(async () => {
    const licensesRaw = await util.promisify(fs.readFile)('licenses.json').then(b => b.toString())
    const licenses = JSON.parse(licensesRaw)
    const packages = Object.keys(licenses)
    const licensesGrouped = {}
    packages.forEach(pkg => {
        const license = licenses[pkg].licenses
        if(!licensesGrouped[license]) {
            licensesGrouped[license] = []
        }
        licensesGrouped[license].push(pkg)
    })
    Object.keys(licensesGrouped).forEach(licenseName => {
        console.log(licenseName, '(' + licensesGrouped[licenseName].length + ')')
        if(!ignoreDetails.includes(licenseName)) {
            licensesGrouped[licenseName].forEach((pkg, i) => {
                console.log('  ' + (i + 1) + '. ' + pkg)
            })
        }
    })

})().then(() => {
    // noop
})
