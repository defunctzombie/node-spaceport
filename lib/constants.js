var os = require('os');

module.exports.hostname = os.hostname();

module.exports.mcast_port = 5454;
module.exports.mcast_ip4 = '224.0.0.251';
module.exports.mcast_ip6 = 'ff02::fb';
