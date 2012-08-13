var assert = require('assert');
var spaceport = require('..');

var k_hostname = require('os').hostname();

test('updown', function(done) {
    var service = spaceport.service('test', { port: 1234 }).start();
    var browser = spaceport.browser('test').start();

    var ident;

    browser.on('up', function(info) {
        assert.equal(info.port, 1234);
        assert.equal(info.host, k_hostname);

        ident = info.ident;
        service.stop();
    });

    browser.on('down', function(info) {
        browser.stop();
        assert.equal(ident, info.ident);
        done();
    });
});

