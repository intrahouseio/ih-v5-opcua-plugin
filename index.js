/**
 * opcua index.js
 */
const util = require('util');

// const plugin = require('ih-plugin-api')();
const app = require('./app');

(async () => {  
  let plugin;
  try {
    const opt = getOptFromArgs();
    const pluginapi = opt && opt.pluginapi ? opt.pluginapi : 'ih-plugin-api';
    plugin = require(pluginapi+'/index.js')();
    
    plugin.log('Plugin opcua client has started.', 0);

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

function getOptFromArgs() {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]); //
  } catch (e) {
    opt = {};
  }
  return opt;
}
