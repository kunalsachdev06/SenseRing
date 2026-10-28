'use strict';
const bridge = require('./scripts/bridge-server.js');
if (require.main === module) bridge.startBridge();
module.exports = bridge;
