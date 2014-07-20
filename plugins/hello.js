var fs = require('fs'),
    pem = require('pem'),
    _ = require('underscore');

module.exports = { pluginName: "hello_world", pluginVersion: "0.0.1", pluginConnect: function(App) {
  App.on('connection', function(handler) {
    handler.messenger["hello:who_am_i"] = function(type, data, next) {
      next(null, _.extend({ id: handler.id, auth: handler.authState }, handler.hostInfo));
    };

  });
}};
