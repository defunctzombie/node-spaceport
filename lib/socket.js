var constants = require('./constants');

module.exports.send = function(socket, msg, cb) {
    var buf = Buffer(JSON.stringify(msg));
    socket.send(buf, 0, buf.length, constants.mcast_port, constants.mcast_ip4, cb);
}

