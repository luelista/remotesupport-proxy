var fs = require('fs'),
    pem = require('pem'),
    _ = require('underscore');

module.exports = { pluginName: "read_certs", pluginVersion: "0.0.1", pluginConnect: function(App) {

  var caKey = App.configDir+"/ca/rs-ca.key";
  var caCert = App.configDir+"/ca/rs-ca.crt";

  var serviceKey = fs.readFileSync(caKey),
      serviceCertificate = fs.readFileSync(caCert);



  App.on('connection', function(handler) {
    handler.messenger["read_certs:read_ca_cert"] = function(type, data, next) {
      //fs.readFile(App.configDir+"/ca/rs-ca.crt", function(err, results) {
      next(null, { caCert: serviceCertificate.toString() });
      //});
    };
    handler.messenger["read_certs:read_my_cert"] = function(type, data, next) {
      if (handler.pendingCSR && handler.pendingCSR.certificate)
        next(err, { cert: handler.pendingCSR.certificate.toString() });
      else
        next("no signed certificate", null);
      //});
    };

    handler.messenger["read_certs:put_csr"] = function(type, data, next) {
      if (data && data.pem) {
         pem.readCertificateInfo(data.pem, function(err1, info) {
          pem.getModulus(data.pem, function(err2, modinfo) {
            if (err1||err2) { next(""+(err1||err2), null); return; }
            console.log("modulus:",modinfo.modulus);
            storeCSR(_.extend(data, info, modinfo), next);
          });
        });
      } else if (data && data.commonName && data.ou && data.ou != App.config.adminOU) {
        storeCSR({ commonName: data.commonName, organizationUnit: data.ou, modulus: "", pem: "" }, next);
      } else {
        next("missing parameters", null);
      }
    };

    function storeCSR(info, next) {
      //App.db.CSR.build(

      handler.pendingCSR = {
        commonName: info.commonName,
        ou: info.organizationUnit,
        modulus: info.modulus,
        pem: info.pem,
        remoteEndpoint: handler.hostInfo.address
      };

      App.broadcastMessage(App.filterAuthState('admin'),
        'read_certs:on_new_csr', {id: handler.id});

      next(null, { id: handler.id });
    }
    
    // Methods below this point - admin only
    if (handler.authState != 'admin') return;
    
    handler.messenger["read_certs:csr_action"] = function(type, data, next) {
      var target = null;
      for(var i in app.connections) {
        if (app.connections[i].id === data.id && app.connections[i].pendingCSR)
          target = app.connections[i];
      }
      if (target == null) {
        next('no csr found', null); return;
      }
      switch (data.action) {
      case "get":
        next(null, target.pendingCSR);
        break;
      case "reject":
        target.pendingCSR = null;
        target.sendMessage('read_certs:on_csr_accepted', false);
        next(null, true);
        break;
      case "accept":
        App.db.Certificate.create({
          commonName: target.pendingCSR.commonName,
          ou: target.pendingCSR.ou
        }).success(function(user) {
          var certreq = {
            csr: target.pendingCSR.pem,
            serviceKey: serviceKey,
            serviceCertificate: serviceCertificate,
            days: 3650,
            serial: 100000+user.id
          };
          if (!certreq.csr) {
            certreq.ou = target.pendingCSR.ou; certreq.commonName = target.pendingCSR.commonName;
            certreq.country = "DE"; certreq.organization = "Teamwiki.de Remote Support";
          }
          pem.createCertificate(certreq, function(err, certinfo) {
            if (err) { next(""+(err), null); return; }
            pem.getFingerprint(certinfo.certificate, function(err, fingerprint) {
              var out = { certificate: certinfo.certificate,
                          privateKey : certinfo.clientKey };
              user.fingerprint = fingerprint.fingerprint;
              user.save().complete(function(err) {
                target.pendingCSR = null;
                target.sendMessage('read_certs:on_csr_accepted', out);
                next(err, !!err);
              });
            });
          });
        }).error(function(err) {
          next(err, false);
        });
        break;
      }
    };



  });
}};
