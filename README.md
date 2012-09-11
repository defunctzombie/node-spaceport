# Spaceport [![Build Status](https://secure.travis-ci.org/shtylman/node-spaceport.png?branch=master)](http://travis-ci.org/shtylman/node-spaceport)

Spaceport is a decentralized service registry for nodejs. There is no central server to maintain or register with. Processes communicate peer-to-peer over multicast (similar to zeroconf/mdns).

Spaceport works great when you have any processes that need to talk to one another but you don't want to predefine their locations or ports.

# install

```
npm install spaceport
```

# use

To create a new service and announce its presence.

```javascript
// port can be specified programmically if assigned by the system
var service = spaceport.service('service name', { port: 1234 });

// the service will now announce it is available and capable of responding to requests
service.start();

// create a browser to tell us when this service comes online
var browser = spaceport.browser('service name').start();

// service is available
browser.on('up', function(info) {

    // hostname of the service box (obtained with os.hostname)
    info.host

    // port the service is listening on
    info.port
});

// service is no longer up
browser.on('down', function() {
});

// to stop the service and announce it should not longer be available
service.stop();
```

# api

see the wiki for additional details: https://github.com/shtylman/node-spaceport/wiki

