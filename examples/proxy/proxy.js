var http_proxy = require('http-proxy');
var spaceport = require('spaceport');
var log = require('book');

var browser = spaceport.browser('www').start();

// keyed so we can remove as they go away
var upstreams = [];

browser.on('up', function(info) {
    log.info('a www service is online, port %s', info.port);

    upstreams.push({
        host: info.host,
        port: info.port
    });
});

browser.on('down', function(info) {
    log.info('a www service is offline, port %s', info.port);

    // TODO find the given upstream by port and remove it
});

http_proxy.createServer(function (req, res, proxy) {

    var avail = upstreams;

    // get the first available upstream
    var upstream = upstreams.shift();

    // no upstreams, handle better
    if (!upstream) {
        return res.end();
    }

    // put at the end, naive round robin
    upstreams.push(upstream);

    var buffer = http_proxy.buffer(req);
    proxy.proxyRequest(req, res, {
        host: upstream.host,
        port: upstream.port,
        buffer: buffer
    });

}).listen(8000, function() {
    log.info('proxy listening on port: %d', 8000);
});

