var fs = require('fs'),
    pem = require('pem'),
    _ = require('underscore');

module.exports = { pluginName: "tunnel_broker", pluginVersion: "0.0.1", pluginConnect: function(App) {
  var tunIdCounter = 1;
  var tunInfo = {};

  App.on('connection', function(handler) {
    handler.messenger["tunnel_broker:connect"] = function(type, data, next) {
      tunIdCounter++;
      tunInfo[tunIdCounter] = data;
      var conn = App.getConnectionById(data.targetId);
      if (!conn) {
        handler.sendMessage('on_forward_error', 'host not found');
        return;
      }
      conn.sendMessage('tunnel:set_tunnel_params', _.extend(data, { tunnelId: tunIdCounter }), function(err, info) {
        console.log("set_tunnel_params returned")
        next(null, { tunnelId: tunIdCounter });
      });
    };

    console.log("registering multiplexconnect for "+handler.id)

    handler.on('multiplexconnect', function(id, upstream) {
      console.log("receiving multiplexconnect for "+id + " and "+handler.id)
      if (id.length > 2 && id.substr(0,2) == "T:") {
        var tunId = parseInt(id.substr(2), 10);
        var info = tunInfo[tunId];

        var targetHost = App.getConnectionById(info.targetId);
        if (!targetHost) {
          handler.sendMessage('on_forward_error', 'host not found');
          return;
        }
        console.log(id);
        var ended = false;
        var downstream = targetHost.multiplex.connect({
          // optionally specify an id for the stream. By default
          // a v1 UUID will be assigned as the id for anonymous streams
          id: 'T:'+tunId
        }, function() {
          upstream.pipe(downstream).pipe(upstream);
        }.bind(this)).on('error', function(error) {
          this.sendMessage('on_forward_error', ''+error);
        }.bind(this)).on('end', function() {
          console.log("host end");
          if (!ended) upstream.end("Host closed connection");
          ended = true;
        });
        upstream.on('end', function() {
          console.log("admin end");
          if (!ended) downstream.end();
          ended = true;
        });

      }
    });

  });
}};
