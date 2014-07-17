var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;

var constants = require('./constants');
var send = require('./socket').send;

var Service = function(msg) {
    if (!(this instanceof Service)) {
        return new Service(msg);
    }

    var self = this;
    self.ident = msg.ident;
    self.host = msg.host;
    self.name = msg.name;
    self.unique = msg.unique;
    self.ips = msg.ips;
    self.details = msg.details || {};
};

Service.prototype.__proto__ = EventEmitter.prototype;

var Browser = function(name) {
    if (!(this instanceof Browser)) {
        return new Browser(name);
    }

    var self = this;

    // services we know are online
    // we don't re-emit that they are online if we know about them
    self._idents = {};

    self._name = name;
    self._socket = dgram.createSocket('udp4');
};

Browser.prototype.__proto__ = EventEmitter.prototype;

Browser.prototype.start = function() {
    var self = this;

    var socket = self._socket;
    var name = self._name;

    // mark service as offline and remove from list
    function offline(msg) {
        var service = self._idents[msg.ident];
        if (!service) {
            return;
        }
        delete self._idents[msg.ident];
        service.emit('down', msg);
    }

    socket.on('message', function(msg) {
        msg = JSON.parse(msg.toString());

        // skip things we don't care about
        if (msg.name !== name) {
            return;
        }

        switch (msg.type) {
        case 'answer':
            var instance = self._idents[msg.ident];
            if (!instance) {
                instance = Service(msg);
            }

            function ttl_check() {
                // death count needs to be per instance
                if (++instance._death_count > 1) {
                    return offline(msg);
                }

                // try to query the service one more time to confirm offline
                self._query();
                instance._ttl_timeout = setTimeout(ttl_check, 2250);
            }

            // if we don't hear from the service within 2 seconds
            // assume it is down
            clearTimeout(instance._ttl_timeout);
            instance._ttl_timeout = setTimeout(ttl_check, 2000);

            // reset death count since we are alive
            instance._death_count = 0;

            // already had the instance
            if (self._idents[msg.ident]) {
                return;
            }

            self._idents[msg.ident] = instance;
            self.emit('up', instance);
            break;
        case 'shutdown':
            var instance = self._idents[msg.ident];
            if (instance) {
                clearTimeout(instance._ttl_timeout);
            }

            offline(msg);
            break;
        case 'default':
            self.emit('error', new Error('unknown message type: ' + msg.type));
            break;
        }
    });

    socket.bind(constants.mcast_port, function() {
        socket.addMembership(constants.mcast_ip4);
    });

    return self;
};

Browser.prototype._query = function() {
    var self = this;
    var socket = self._socket;
    var name = self._name;

    var msg = {
        type: 'query',
        name: name
    };

    send(socket, msg, function(err) {
        if (err) {
            self.emit('error', err);
        }
    });
};

Browser.prototype.stop = function() {
    var self = this

    // TODO mark all services as down?

    clearTimeout(self._ttl_timeout);

    self._socket.close();
    return self;
};

module.exports = Browser;
