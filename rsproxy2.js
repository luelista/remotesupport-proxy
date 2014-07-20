var net = require('net'),
    tls = require('tls'),
    fs = require('fs'),
    App = require('./rsproxy_app'),
    ClientHandler = require('./clienthandler');

function getUserHome() {
  return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

var app = new App(process.env.RS_DIR || getUserHome() + "/.config/rs");
global.app = app;

if (process.argv.length == 3) {
  var arg = process.argv[2]
  switch(arg) {
    case "start":
      require('daemon')();
      break;
    case "status":
    case "stop":
      if (fs.existsSync(app.configDir+'/server.pid')) {
        console.log("pidfile not found\n"); process.exit(1);
      }
      var pid = fs.readFileSync(app.configDir+'/server.pid')
      try {
        process.kill(pid, arg == "stop" ? 'SIGKILL' : 0);
        console.log(arg == "stop" ? "server stopped" : "server running");
        process.exit(0);
      } catch(e) {
        console.log("server not running");
        process.exit(2);
      }
      break;
  }
}

fs.writeFileSync(app.configDir+'/server.pid', process.pid);

app.loadPlugins();

app.tls_options = {
    key: fs.readFileSync(app.configDir+'/rs-server.key'),
    cert: fs.readFileSync(app.configDir+'/rs-server.crt'),

    // This is necessary only if using the client certificate authentication.
    requestCert: true,

    // This is necessary only if the client uses the self-signed certificate.
    ca: [ fs.readFileSync(app.configDir+'/ca/rs-ca.crt') ]
};

app.multiplex_options = {
    // The connectTimeout optionally specifies how long to
    // wait in milliseconds for the downstream multiplex to
    // accept connections. It defaults to 3000 milliseconds
    connectTimeout: 5000
};

if (!app.config.server_port) {
  throw new Error("Mandatory configuration parameter 'server_port' missing.");
}

// run server
tls.createServer(app.tls_options, function (cleartextStream) {
    console.log('Connection...');
    var handler = new ClientHandler(cleartextStream);
    app.connections.push(handler);
    app.emit('connection', handler);
}).listen(app.config.server_port)
.on('clientError', function(err, pair) {
  console.log("clientError", err);
});

app.runPlugins();

console.log("Listening on port "+app.config.server_port+" ...");
