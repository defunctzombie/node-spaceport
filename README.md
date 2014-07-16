# Spaceport [![Build Status](https://secure.travis-ci.org/defunctzombie/node-spaceport.png?branch=master)](http://travis-ci.org/defunctzombie/node-spaceport)

Spaceport is a decentralized service registry for nodejs. There is no central server to maintain or register with. Processes communicate peer-to-peer over multicast (similar to zeroconf/mdns).

Spaceport works great when you have any processes that need to talk to one another but you don't want to predefine their locations or ports.

** This module only works with node 0.10+ **

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

// to stop the service and announce it should not longer be available
service.stop();
```

To listen to a particular service.
```javascript
// create a browser to tell us when this service comes online
var browser = spaceport.browser('service name').start();

// service is available
browser.on('up', function(service) {

    // unique identifier for the service
    service.ident

    // hostname of the service box (obtained with os.hostname)
    service.host

    // custom information for the service
    // these details are passed in when the service is created
    // { port: 1234 } above is the details
    service.details

    // the service is offline will trigger a down event
    service.once('down', function() {
    });
});
```

# api

see the wiki for additional details: https://github.com/defunctzombie/node-spaceport/wiki

