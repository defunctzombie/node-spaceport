var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var os = require('os');

var constants = require('./constants');
var send = require('./socket').send;

var Service = function(name, opt) {
    if (!(this instanceof Service)) {
        return new Service(name, opt);
    }

    var self = this;

    self._socket = dgram.createSocket('udp4');

    // unique id for this service
    self._ident = ident();

    self._running = false;

    self._unique = false;

    self._name = name;
    self._ip = opt.ip;

    self._details = opt || {};

    // when we get a response this will be set
    self._active = undefined;

    // ips the service is listening on
    self._ips = [];

    // if ip is '0.0.0.0' then all interfaces are listening
    if (self._ip === '0.0.0.0') {
        var interfaces = os.networkInterfaces();
        Object.keys(interfaces).forEach(function(name) {
            var interface = interfaces[name];
            interface.forEach(function(details) {
                // skip ipv6 for now
                if (details.family === 'IPv6') {
                    return;
                }

                // TODO ipv6

                self._ips.push({
                    address: details.address,
                    family: details.family
                });
            });
        });
    }
    else if (opt.ip) {
        self._ips.push({
            address: opt.ip,
            family: 'IPv4'
        });
    }
};

// start broadcasting the service
Service.prototype.start = function() {
    var self = this;
    var socket = self._socket;

    self._running = true;

    function answer() {
        // respond!
        var answer = {
            type: 'answer',
            name: self._name,
            port: self._port,
            host: constants.hostname,
            unique: self._unique,
            ident: self._ident,
            ips: self._ips,
            details: self._details
        };

        send(socket, answer, function(err) {
            if (err) {
                self.emit('error', err);
            }
        });
    }

    self._ttl_timeout = setInterval(answer, 2000);

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

                answer();
                break;
            case 'answer':

                // no need to continue querying
                clearTimeout(self._query_timeout);

                // can only have one instance, ours has lost!
                if (self._unique || msg.unique) {
                    self._active = false;
                    return self.emit('error', new Error('service already running: ' + self._name));
                }

                self._active = true;
                break;
            default:
                // unknown message type
                break;
        }
    });

    socket.bind(constants.mcast_port, function() {
        socket.addMembership(constants.mcast_ip4);
    });

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

        // no action if not running
        if (!self._running) {
            return;
        }

        query_count++;

        send(socket, msg, function(err) {
            if (err) {
                self.emit('error', err);
            }

            if (query_count >= 3) {
                // we never got a response, assume nothing else is running
                if (self._active === undefined) {
                    self._active = true;

                    // service is up
                    var msg = {
                        type: 'answer',
                        name: self._name,
                        host: constants.hostname,
                        unique: self._unique,
                        ident: self._ident,
                        ips: self._ips,
                        details: self._details
                    };

                    send(self._socket, msg, function(err) {
                        if (err) {
                            self.emit('error', err);
                        }
                    });
                }
                return;
            }

            // wait 250ms more and re-query if no response
            self._query_timeout = setTimeout(query, 250);
        });
    }

    self._query_timeout = setTimeout(query, query_wait);

    return self;
};

// stop broadcasting the service
Service.prototype.stop = function() {
    var self = this;

    self._running = false;

    clearInterval(self._query_timeout);
    clearInterval(self._ttl_timeout);

    // send shutdown packet
    var msg = {
        type: 'shutdown',
        name: self._name,
        ident: self._ident,
        // TODO instead of sending the details again, the browser could
        // cache them based on service ident
        // sending details does have the advantage of being able to provide
        // info about why the service went offline?
        details: self._details
    };

    send(self._socket, msg, function(err) {
        if (err) {
            self.emit('error', err);
        }

        self._socket.close();
    });

    return self;
};

// terminate the service without a shutdown message
// not typically used, simulates a service crash
Service.prototype.kill = function() {
    var self = this;

    self._running = false;

    clearInterval(self._query_timeout);
    clearInterval(self._ttl_timeout);

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

module.exports = Service;

