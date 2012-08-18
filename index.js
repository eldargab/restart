var watchTree = require('watch').watchTree
var debug = require('debug')('restart')

module.exports = function (start, build, watch) {
    if (!start) throw new Error('Start command not specified')
    if (!Array.isArray(start)) throw new Error('Start CLI command should be an Array')
    if (build && !Array.isArray(build)) throw new Error('Build CLI command should be an Array')
    if (watch && !Array.isArray(watch)) throw new Error('Watch list should be an Array')

    var server
    var killing = false
    var building = false
    var rebuild = false

    function restart () {
        debug('Restart requested')

        if (building) {
            debug('Building in progress, rebuild required')
            rebuild = true
            return
        }

        if (killing) return

        if (!server || server.exitCode != null) return startup()

        killing = true

        server.on('exit', function () {
            killing = false
            startup()
        })

        server.kill()
    }

    function startup () {
        if (!build) return launch()

        building = true
        rebuild = false

        debug('Building (%s)', build.join(' '))

        sh(build, function (code) {
            debug('Build completed')
            building = false
            if (rebuild) return startup()
            if (code == 0) launch()
        })
    }

    function launch () {
        debug('Launching (%s)', start.join(' '))
        server = sh(start)
    }

    watch && watch.forEach(function (itm) {
        watchTree(itm, {ignoreDotFiles: true}, function (f, curr, prev) {
            if (typeof f == 'object' && curr === null && prev === null) {
                // Finished walking the file tree
                return
            }
            restart()
        })
    })

    restart()
}

function sh (cmd, cb) {
    var child = require('child_process').spawn(cmd[0], cmd.slice(1))
    child.stderr.on('data', function (data) {
        process.stderr.write(data)
    })
    child.stdout.on('data', function (data) {
        process.stdout.write(data)
    })
    if (cb) child.on('exit', cb)
    return child
}