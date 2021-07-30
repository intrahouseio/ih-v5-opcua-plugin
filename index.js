/**
 * s7plc index.js
 */
const util = require('util');

const plugin = require('ih-plugin-api')();
const app = require('./app');

(async () => {
  plugin.log('Plugin opcua client has started.', 0);

  try {
    // Получить параметры 
    plugin.params.data = await plugin.params.get();
    plugin.log('Received params data:'+util.inspect(plugin.params.data));

    // Получить каналы 
    plugin.channels.data = await plugin.channels.get();
    plugin.log('Received channels data: '+util.inspect(plugin.channels.data));

    app(plugin);
  } catch (err) {
    plugin.exit(8, `Error: ${util.inspect(err)}`);
  }
})();