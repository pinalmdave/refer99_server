'use strict';
var async = require('async');
var nodemailer = require('nodemailer');
// var smtpTransport = require('nodemailer-smtp-transport');
var crypto = require('crypto');
module.exports = function(Agents) {
  Agents.on('dataSourceAttached', function() {
    console.log('Agents', 'on.dataSourceAttached()');
    //delete Agents.validations.email; //delete MyModel.app.models.User.validations.email;
    delete Agents.validations.username; //delete MyModel.app.models.User.validations.username;
  });
  Agents.sign_universal = function(username, email, password,origin, cb) {

    if (!email || email == '') {
      return cb("invalid request.");
    }

    if (!password || password == '') {
      password = "fb";
    }
    var agent_data = {
      "username": username,
      "email": email,
      "password": password,
      "created": new Date()
    };

    Agents.findOrCreate({
      where: {
        email: email
      }
    }, agent_data, function(err, instance, created) {
      if (err) {
        return cb(err);
      }
      // instance.created = created;
      if (created) {
        // return cb(null, instance);
        return cb(null, instance);

      } else {
        return cb({
          "message": "user already exist"
        });
      }


    });
  }

  Agents.remoteMethod(
    'sign_universal', {
      http: {
        path: '/sign_universal',
        verb: 'get'
      },
      accepts: [{
        arg: 'username',
        type: 'string'
      }, {
        arg: 'email',
        type: 'string'
      }, {
        arg: 'password',
        type: 'string'
      },{
        arg: 'origin',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

};