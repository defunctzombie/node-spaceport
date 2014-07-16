var assert = require('assert');
var os = require('os');

var spaceport = require('..');

var k_hostname = require('os').hostname();

test('updown', function(done) {
    var service = spaceport.service('test', { port: 1234 }).start();
    var browser = spaceport.browser('test').start();

    var ident;

    browser.on('up', function(info) {
        assert.equal(info.details.port, 1234);
        assert.equal(info.host, k_hostname);

        ident = info.ident;

        info.once('down', function(info) {
            assert.equal(ident, info.ident);
            browser.stop();
            done();
        });

        service.stop();
    });
});

/// when ip 0.0.0.0 is specified, the service is listening on all ips
/// the list of ips should be equal to the number of interfaces
test('IP ALL', function(done) {
    var service = spaceport.service('test', {
        port: 1234,
        ip: '0.0.0.0'
    }).start();
    var browser = spaceport.browser('test').start();

    var ident;

    browser.on('up', function(info) {
        assert.equal(info.host, k_hostname);
        assert.equal(info.details.port, 1234);
        assert.equal(info.ips.length, Object.keys(os.networkInterfaces()).length);

        ident = info.ident;

        info.once('down', function(info) {
            browser.stop();
            assert.equal(ident, info.ident);
            done();
        });

        service.stop();
    });

});

/// when a single IP is provided for the service, that ip should be the only one
/// in the list of ips
test('IP SINGLE', function(done) {
    var service = spaceport.service('test', {
        port: 1234,
        ip: '1.2.3.4'
    }).start();
    var browser = spaceport.browser('test').start();

    var ident;

    browser.on('up', function(info) {
        assert.equal(info.details.port, 1234);
        assert.equal(info.host, k_hostname);
        assert.equal(info.ips.length, 1);
        assert.deepEqual(info.ips[0], { address: '1.2.3.4', family: 'IPv4' });

        ident = info.ident;
        info.once('down', function(info) {
            browser.stop();
            assert.equal(ident, info.ident);
            done();
        });

        service.stop();
    });

});

// detect when the service goes offline with no shutdown message
test('service crash', function(done) {
    var service = spaceport.service('test', { port: 1234 }).start();
    var browser = spaceport.browser('test').start();

    var ident;

    browser.on('up', function(info) {
        ident = info.ident;
        info.on('down', function(info) {
            browser.stop();
            assert.equal(ident, info.ident);
            done();
        });

        service.kill();
    });

});
