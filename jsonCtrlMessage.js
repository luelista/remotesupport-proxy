
exports.onControlConnection = function(connection) {

  connection.setEncoding();
  emitLines(connection, "\n");
  connection.on('line', function(line) {
    var data = JSON.parse(line);
    var res = null, called = false;
    this.emit('ctrlmessage', data[2], data[3]);
    this.emit('msg:' + data[2], data[3]);
    if(data[1] && this.sequenceCallback[data[1]]) {
      res = this.sequenceCallback[data[1]](data[3][0], data[3][1]);
      delete this.sequenceCallback[data[1]];
      return;
    }
    if (this.messenger[data[2]]) {
      try {
        this.messenger[data[2]](data[2], data[3], function(err, results) {
          if(data[0])
            this.controlConnection.write(JSON.stringify([null, data[0], "response", [err,results]])+"\n");
        }.bind(this));
      } catch(e) {
        this.controlConnection.write(JSON.stringify([null, data[0], "error", [{exception:e.toString()},null]])+"\n");
      }
      called = true;
    }
    if(data[0] && !called) {
      this.controlConnection.write(JSON.stringify([null, data[0], "error", ['method not found',null]])+"\n");
    }
  }.bind(this));

}

/**
 * By TooTallNate, originally posted at https://gist.github.com/1785026
 * A quick little thingy that takes a Stream instance and makes
 * it emit 'line' events when a newline is encountered.
 * Modified by Max Weller to accept custom line feed characters (e.g. \r\n)
 *
 *   Usage:
 *   ‾‾‾‾‾
 *  var emitLines = require('./emitLines');
 *  emitLines(process.stdin, "\n")
 *  process.stdin.resume()
 *  process.stdin.setEncoding('utf8')
 *  process.stdin.on('line', function (line) {
 *    console.log(line event:', line)
 *  })
 *
 */

function emitLines (stream, lineFeedChar) {
  var backlog = ''
  stream.on('data', function (data) {
    //console.log("data in "+data.length+" bytes");
    backlog += data
    var n = backlog.indexOf(lineFeedChar)
    // got a \n? emit one or more 'line' events
    while (~n) {
      stream.emit('line', backlog.substring(0, n))
      backlog = backlog.substring(n + 1)
      n = backlog.indexOf(lineFeedChar)
    }
  })
  stream.on('end', function () {
    if (backlog) {
      stream.emit('line', backlog)
    }
  })
}

exports.emitLines = emitLines;
