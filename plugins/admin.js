var fs = require('fs'),
    pem = require('pem'),
    _ = require('underscore');

module.exports = { pluginName: "admin", pluginVersion: "0.0.1", pluginConnect: function(app) {
  app.on('connection', function(handler) {
    if (handler.authState != 'admin') return;
    
    app.on('connection', function(newhandler) {
      handler.sendMessage('event:on_connect', newhandler.id);
    });
    app.on('disconnect', function(id) {
      handler.sendMessage('event:on_disconnect', id);
    });
    
    handler.messenger["admin:get_hosts"] = function(type, data, next) {
      App.db.Certificate.all().success(function(result) {
        var hosts = [];
        for (var i in results) {
          hosts.push(results[i]);
        }
        next(null, hosts);
      }).error(function(err) {
        next(err, null);
      });
    };
    
    handler.messenger["admin:get_connections"] = function(type, data, next) {
      var hosts = [];
      for (var i in app.connections) {
        var host = app.connections[i];
        hosts.push(
          _.extend(host.clientInfo, host.hostInfo, {
            id: host.id,  self: host==handler,
            pendingCSR: host.pendingCSR?true:false,
            auth: host.authState
          }));
      }
      next(null, hosts);
    };

  });
}};

var extend = function(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function(source) {
        for (var prop in source) {
            obj[prop] = source[prop];
        }
    });
    return obj;
};
