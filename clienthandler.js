var MultiplexStream = require('multiplex-stream'),
    events = require('events'),
    util = require('util');

var lfd_nr = 1;

var ClientHandler = function(cleartextStream) {
    var self = this;
    this.cleartextStream = cleartextStream;
    this.id = lfd_nr++; // TODO: make up more complicated id
    this.authState = '';
    this.hostInfo = {}; this.clientInfo = {};
    if (cleartextStream.authorized) {
      this.cert = cleartextStream.getPeerCertificate();
      this.authState = (this.cert.subject.OU === app.config.adminOU) ? 'admin' : 'host';
      this.hostInfo.cn = this.cert.subject.CN;
      this.hostInfo.ou = this.cert.subject.OU;
      this.hostInfo.email = this.cert.subject.EMAIL;
    }
    this.hostInfo.address = cleartextStream.remoteAddress;
    this.hostInfo.connectionTimestamp = +new Date();
    this.sequenceCallback = {};
    this.messenger = {};
    this.multiplex = new MultiplexStream(app.multiplex_options, function(downstreamConnection) {
        self.onMultiplexConnection(downstreamConnection);
    });
    cleartextStream.pipe(this.multiplex).pipe(cleartextStream);
    cleartextStream.on('close', function() {
      var index = app.connections.indexOf(this);
      if (index > -1) app.connections.splice(index, 1);
      app.emit('disconnect', this.id);
      
      app.broadcastMessage(app.filterAuthState('admin'),
        'event:on_hosts_changed', '');
      
    }.bind(this));
}


// geht nicht!!!!!
//ClientHandler.prototype = new events.EventEmitter();

//so gehts - http://stackoverflow.com/a/8898528/562836
util.inherits(ClientHandler, events.EventEmitter);


ClientHandler.prototype.onControlConnection =
  require('./jsonCtrlMessage').onControlConnection;


ClientHandler.prototype.onMultiplexConnection = function(connection) {
  // a multiplexed stream has connected from upstream.
  // The assigned id will be accessible as downstreamConnection.id
  if (connection.id == '"ctrl') {
    this.controlConnection = connection;
    this.onControlConnection(connection);
    this.once('msg:client_hello', (function(info) {
      this.clientInfo = info;
      app.broadcastMessage(app.filterAuthState('admin'),
        'event:on_hosts_changed', '');
    }).bind(this));
    return;
  }
  var m;
  if (this.authState == 'admin' && (m = connection.id.match(/^:([0-9]+):(.*)$/))) {
    var conn = app.getConnectionById(m[1]);
    if (!conn) {
      this.sendMessage('on_forward_error', 'host not found');
      return;
    }
    var ended = false;
    var downstream = conn.multiplex.connect({
      // optionally specify an id for the stream. By default
      // a v1 UUID will be assigned as the id for anonymous streams
      id: ':'+this.id+''+(++lfd_nr)+':'+m[2]
    }, function() {
      connection.pipe(downstream).pipe(connection);
    }.bind(this)).on('error', function(error) {
      this.sendMessage('on_forward_error', ''+error);
    }.bind(this)).on('end', function() {
      console.log("host end");
      if (!ended) connection.end("Host closed connection");
      ended = true;
    });
    connection.on('end', function() {
      console.log("admin end");
      if (!ended) downstream.end();
      ended = true;
    });
    return;
  }
  console.log("emitting multiplexconnect");
  this.emit('multiplexconnect', connection.id, connection);
}

ClientHandler.prototype.sendMessage = function(mtype, data, callback) {
  var seqnum = null;
  if (callback) {
    seqnum = lfd_nr++;
    this.sequenceCallback[seqnum] = callback;
  }
  this.controlConnection.write(JSON.stringify([seqnum, null, mtype, data])+"\n");
}

module.exports = ClientHandler;
