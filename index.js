var os = require('os');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var dgram = require('dgram');

// hostname is not changing
var k_hostname = os.hostname();

var k_mcast_port = 5454;
var k_mcast_ip4 = '224.0.0.251';
var k_mcast_ip6 = 'ff02::fb';

// create a new service advertisement
// default is unique true
// opt: { port: ###, [unique: false] }
module.exports.service = function(name, opt) {
    return new Service(name, opt);
};

// create a new service browser
module.exports.browser = function(service_name) {
    return new Browser(service_name);
};

var Service = function(name, opt) {
    var self = this;

    // the socket
    self._socket = dgram.createSocket('udp4');

    // unique id for this service
    self._ident = ident();

    //this.unique = opt.unique;

    self._name = name;
    self._port = opt.port;

    // when we get a response this will be set
    self._active = undefined;
};

// start broadcasting the service
Service.prototype.start = function() {
    var self = this;
    var socket = self._socket;

    // check if service is already running
    socket.on('message', function(msg) {
        var msg = JSON.parse(msg.toString());

        // if our own message, skip it
        if (msg.ident === self._ident) {
            return;
        }

        // not for us
        if (msg.name !== self._name) {
            return;
        }

        switch (msg.type) {
            case 'query':

                // we are not yet active
                if (!self._active) {
                    return;
                }

                // respond!
                var answer = {
                    type: 'answer',
                    name: self._name,
                    port: self._port,
                    host: k_hostname,
                    unique: self._unique,
                };

                var buf = Buffer(JSON.stringify(answer));
                socket.send(buf, 0, buf.length, k_mcast_port, k_mcast_ip4, function(err) {
                    if (err) {
                        self.emit('error', err);
                    }
                });
                break;
            case 'answer':

                // no need to continue querying
                clearTimeout(self._query_timeout);

                // can only have one instance, ours has lost!
                if (self._unique) {
                    self._active = false;
                }

                // other side wishes to remain unique
                if (msg.unique) {
                    return self.emit('error', new Error('service already running: ' + self._name));
                }

                break;
            defualt:
                // unknown message type
                break;
        }
    });

    socket.bind(k_mcast_port);
    socket.addMembership(k_mcast_ip4);

    self._socket = socket;

    // use a timeout for checking if same name is already running
    // 0-250 ms random time to wait before first query
    var query_wait = Math.floor(Math.random() * 250);

    // see if service is already running
    var msg = {
        type: 'query',
        name: self._name,
        ident: self._ident,
    };

    var query_count = 0;

    function query() {
        query_count++;

        var buf = Buffer(JSON.stringify(msg));
        socket.send(buf, 0, buf.length, k_mcast_port, k_mcast_ip4, function(err) {
            if (err) {
                self.emit('error', err);
            }

            if (query_count >= 3) {
                // we never got a response, assume nothing else is running
                if (self._active === undefined) {
                    self._active = true;

                    // service is up
                    var buf = Buffer(JSON.stringify({
                        type: 'answer',
                        name: self._name,
                        port: self._port,
                        host: k_hostname,
                        unique: self._unique,
                    }));
                    socket.send(buf, 0, buf.length, k_mcast_port, k_mcast_ip4, function(err) {
                        if (err) {
                            self.emit('error', err);
                        }
                    });
                }
                return;
            }

            // wait 250ms more and requery if no response
            self._query_timeout = setTimeout(query, 250);
        });
    }

    setTimeout(query, query_wait);

    return self;
};

// stop broadcasting the service
Service.prototype.stop = function() {
    var self = this;

    // send shutdown packet
    var msg = {
        type: 'shutdown',
        name: self._name,
        ident: self._ident,
    };

    var buf = Buffer(JSON.stringify(msg));
    self._socket.send(buf, 0, buf.length, k_mcast_port, k_mcast_ip4, function(err) {
        if (err) {
            self.emit('error', err);
        }

        self._socket.close();
    });

    return self;
};

var Browser = function(name) {
    var self = this;

    self._name = name;
    self._socket = dgram.createSocket('udp4');
};

util.inherits(Browser, EventEmitter);

Browser.prototype.start = function() {
    var self = this;

    var socket = self._socket;
    var name = self._name;

    socket.on('message', function(msg) {
        var msg = JSON.parse(msg.toString());

        // skip things we don't care about
        if (msg.name !== name) {
            return;
        }

        switch (msg.type) {
        case 'answer':
            delete msg.type;
            delete msg.ident;

            self.emit('up', msg);
            break;
        case 'shutdown':
            self.emit('down');
            break;
        }
    });

    socket.bind(k_mcast_port);
    socket.addMembership(k_mcast_ip4);

    var msg = {
        type: 'query',
        name: name
    };

    var buf = Buffer(JSON.stringify(msg));
    socket.send(buf, 0, buf.length, k_mcast_port, k_mcast_ip4, function(err) {
        if (err) {
            self.emit('error', err);
        }
    });

    return self;
};

Browser.prototype.stop = function() {
    var self = this;
    self._socket.close();
    return self;
};

// make a unique ident for our queries
var chars = 'abcdefghiklmnopqrstuvwxyz';
var ident = function() {
    var length = 8;
    var string = '';
    for (var i=0; i<length; ++i) {
        string += chars[Math.floor(Math.random() * chars.length)];
    }
    return string;
};
