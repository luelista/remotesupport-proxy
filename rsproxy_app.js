var fs = require('fs'),
    events = require('events'),
    util = require('util');
var Netmask = require('netmask').Netmask;

function App(configDir) {
    this.configDir = configDir;
    this.connections = [];
    this.plugins = [];
    this.db = require('./database')(this);
    
    try {
      this.config = JSON.parse(fs.readFileSync(this.configDir+'/config.json').toString().replace(/^\s*\/\/.*$/gm,""));
    } catch(e) { throw new Error("Unable to read config from "+this.configDir+'/config.json'+": ",e); }
    if(this.config.adminNetmask) this.config.adminNetmask = new Netmask(this.config.adminNetmask);
    
}
util.inherits(App, events.EventEmitter);

App.prototype.runPlugins = function(){
  for(var i in this.plugins) {
    this.plugins[i].pluginConnect(this);
  }
}
App.prototype.loadPlugins = function() {
  fs.readdirSync("./plugins").forEach(function(file) {
    if (file.match(/\.js$/)) this.plugins.push(require("./plugins/" + file));
  }.bind(this));
}
App.prototype.broadcastMessage = function(filter, mtype, mdata) {
  for(var i in this.connections) {
    var conn = this.connections[i];
    if (filter(conn)) conn.sendMessage(mtype, mdata);
  }
}
App.prototype.filterAuthState = function(fvalue) {
  return (function(conn) {
    return conn.authState == fvalue;
  });
}
App.prototype.getConnectionById = function(id) {
  for(var i in this.connections) {
    if (this.connections[i].id == id) return this.connections[i];
  }
  return null;
}

module.exports = App;
