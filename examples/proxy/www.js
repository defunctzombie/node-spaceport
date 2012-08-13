var http = require('http');
var spaceport = require('spaceport');
var log = require('book');

var server = http.createServer(function(req, res) {
    res.setHeader('Content-Type', 'text/plain');
    res.end('hello from pid: ' + process.pid + '\n');
});

server.listen(function() {
    var port = server.address().port;
    var service = spaceport.service('www', {
        port: port
    }).start();

    server.on('close', function() {
        service.stop();
    });

    log.info('www running on port: %s', port);
});

