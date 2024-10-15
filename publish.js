import child_process from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const args = process.argv.splice(2)
const folder = args[0]

console.log('preparing to publish folder `' + folder + '`')

const pkgJsonPath = path.join(folder, 'package.json')
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath).toString())
const pkgJsonVersion = pkgJson.version
const pkg = pkgJson.name

console.log('checking version for ' + pkg + ' (' + pkgJsonVersion + ')')
exec('npm view ' + pkg + ' version', [], (version, err) => {
    if(err.startsWith('npm ERR! code E404') || err.startsWith('npm error code E404') || err.startsWith('npm error 404')) {
        console.log('  > not existing yet')
    } else if(err.length) {
        console.error('npm view error:', err)
        return
    }
    if(pkgJsonVersion === version) {
        console.log('  > skipping, same version online')
    } else {
        console.log('  > current version: ' + (version || '-'))
        console.log('    publishing ...')
        exec('cd ' + folder + '&& npm publish', [], (result) => {
            console.log('   ', result)
        })
    }
})

function exec(command, args, callback) {
    const child = child_process.exec(command)

    let scriptOutput = ''
    let scriptOutputErr = ''
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', function(data) {
        scriptOutput += data.toString()
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', function(data) {
        scriptOutputErr += data.toString()
    })

    child.on('close', function(code) {
        callback(
            scriptOutput.trim(),
            scriptOutputErr.trim(),
            code,
        )
    })
}
