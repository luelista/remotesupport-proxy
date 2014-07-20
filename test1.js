var net = require('net'),
    nssocket = require('nssocket'),
    tls = require('tls'),
    fs = require('fs');



nssocket.createServer({
  'type' : 'tls',
  'cert' : fs.readFileSync('./server-cert.pem'),
  'key' : fs.readFileSync('./server-key.pem')
}, function (socket) {
  
  console.log('Connection...');
  
  socket.data(['rsvp', '*'], function() {
    console.log('on incoming Event...');
  });
  socket.data(['rsvp', 'test'], function() {
    console.log('on incoming TEST...');
  });
}).listen(4455);


var outbound = new nssocket.NsSocket({
  'type' : 'tls',
  'cert' : fs.readFileSync('./server-cert.pem'),
  'ca' : fs.readFileSync('./server-cert.pem'),
});
outbound.connect(4455, '127.0.0.1', function() {
  console.log('connected...');
  outbound.send(['rsvp', 'test']);
  outbound.send(['rsvp', 'test']);
  setTimeout(function() {
    console.log('Sending');
    outbound.send(['rsvp', 'test']);
  },1000);
});


