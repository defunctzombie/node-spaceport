var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var constants = require('./constants');
var send = require('./socket').send;

var Service = function(name, opt) {
    var self = this;

    // the socket
    self._socket = dgram.createSocket('udp4');

    // unique id for this service
    self._ident = ident();

    self._unique = false;

    self._name = name;
    self._port = opt.port;

    // when we get a response this will be set
    self._active = undefined;
};

// start broadcasting the service
Service.prototype.start = function() {
    var self = this;
    var socket = self._socket;

    function answer() {
        // respond!
        var answer = {
            type: 'answer',
            name: self._name,
            port: self._port,
            host: constants.hostname,
            unique: self._unique,
            ident: self._ident,
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
            defualt:
                // unknown message type
                break;
        }
    });

    socket.bind(constants.mcast_port);
    socket.addMembership(constants.mcast_ip4);

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
                        port: self._port,
                        host: constants.hostname,
                        unique: self._unique,
                        ident: self._ident,
                    };

                    send(self._socket, msg, function(err) {
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

    clearInterval(self._ttl_timeout);

    // send shutdown packet
    var msg = {
        type: 'shutdown',
        name: self._name,
        ident: self._ident,
    };

    send(self._socket, msg, function(err) {
        if (err) {
            self.emit('error', err);
        }

        self._socket.close();
    });

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

