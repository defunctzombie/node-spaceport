var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;

var constants = require('./constants');
var send = require('./socket').send;

var Browser = function(name) {
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

    var death_count = 0;

    socket.on('message', function(msg) {
        msg = JSON.parse(msg.toString());

        // skip things we don't care about
        if (msg.name !== name) {
            return;
        }

        // run when the service goes offline
        function offline() {
            delete self._idents[msg.ident];
            self.emit('down', msg);
        }

        function ttl_check() {
            if (++death_count > 1) {
                return offline();
            }

            // try to query the service one more time to confirm offline
            self._query();
            instance._ttl_timeout = setTimeout(ttl_check, 2250);
        }

        switch (msg.type) {
        case 'answer':
            var instance = self._idents[msg.ident];
            if (!instance) {
                instance = msg;
            }

            // if we don't hear from the service within 2 seconds
            // assume it is down
            clearTimeout(instance._ttl_timeout);
            instance._ttl_timeout = setTimeout(ttl_check);

            // reset death count since we are alive
            death_count = 0;

            // already had the instance
            if (self._idents[msg.ident]) {
                return;
            }

            self._idents[msg.ident] = instance;
            self.emit('up', msg);
            break;
        case 'shutdown':
            var instance = self._idents[msg.ident];
            if (instance) {
                clearTimeout(instance._ttl_timeout);
            }

            offline();
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
