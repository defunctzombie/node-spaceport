var spaceport = require('..');

test('service', function() {
    var service = spaceport.service('test', { port: 1234 });
    service.start();
    service.stop();
});

test('browser', function() {
    var browser = spaceport.browser('test');
    browser.start();
    browser.stop();
});

