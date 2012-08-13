var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

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

            var instance = self._idents[msg.ident];
            if (!instance) {
                instance = msg;
            }

            // if we don't hear from the service within 2 seconds we will assume it is down
            clearTimeout(instance._ttl_timeout);
            instance._ttl_timeout = setTimeout(function() {
                delete self._idents[msg.ident];
                self.emit('down', msg);
            }, 2250);

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

            delete self._idents[msg.ident];

            self.emit('down', msg);
            break;
        }
    });

    socket.bind(constants.mcast_port);
    socket.addMembership(constants.mcast_ip4);

    var msg = {
        type: 'query',
        name: name
    };

    send(socket, msg, function(err) {
        if (err) {
            self.emit('error', err);
        }
    });

    return self;
};

Browser.prototype.stop = function() {
    var self = this

    // TODO mark all services as down?

    clearTimeout(self._ttl_timeout);

    self._socket.close();
    return self;
};

module.exports = Browser;
