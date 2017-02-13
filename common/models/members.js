'use strict';
var async = require('async');
var nodemailer = require('nodemailer');
// var smtpTransport = require('nodemailer-smtp-transport');
var crypto = require('crypto');
module.exports = function(Members) {
  Members.on('dataSourceAttached', function() {
    console.log('Members', 'on.dataSourceAttached()');
    //delete Members.validations.email; //delete MyModel.app.models.User.validations.email;
    delete Members.validations.username; //delete MyModel.app.models.User.validations.username;
  });
  Members.sign_universal = function(username, email, password, cb) {

    if (!email || email == '') {
      return cb("invalid request.");
    }

    if (!password || password == '') {
      password = "fb";
    }
    var member_data = {
      "username": username,
      "email": email,
      "password": password,
      "created": new Date()
    };

    Members.findOrCreate({
      where: {
        email: email
      }
    }, member_data, function(err, instance, created) {
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

  Members.remoteMethod(
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
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );


  Members.send_reset_password_link = function(email, cb) {

    if (!email || email == '') {
      return cb({
        "message": "invalid request"
      }, null);
    }

    var member_data = {
      "email": email
    };

    async.waterfall([
      function(done) {
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          done(err, token);
        });
      },
      function(token, done) {
        Members.findOne({
          where: {
            email: email
          }
        }, function(err, user) {
          // console.log('email', email);
          // console.log('user', user);
          if (!user) {
            return cb({
              "message": "user not found"
            }, null);
          }
          var data = {};
          data.resetPasswordToken = token;
          data.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          user.updateAttributes(data, function(err, obj) {
            if (err) {
              return cb(err, null);
            }
            done(err, token, user);
          });
        });
      },
      function(token, user, done) {
        var smtpTransport = nodemailer.createTransport('SMTP', {
          service: 'gmail',
          auth: {
            user: 'osvinandroid@gmail.com',
            pass: 'osvin@40'
          }
        });
        var mailOptions = {
          to: email,
          from: 'osvinandroid@gmail.com',
          subject: 'Password Reset',
          text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
            'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
            'http://refer99.com/admin/#/reset/' + token + '\n\n' +
            'If you did not request this, please ignore this email and your password will remain unchanged.\n'
        };
        smtpTransport.sendMail(mailOptions, function(err, response) {
          if (err) {
            // console.log('err', err);
            return cb(err, null);
          } else {
            // console.log('response', response);
            return cb(null, {
              "message": "success"
            });
          }
        });
      }
    ], function(err) {
      if (err) {
        console.log('err', err);
        return cb(err);
      } else {
        return cb();
      }
    });
  }

  Members.remoteMethod(
    'send_reset_password_link', {
      http: {
        path: '/send_reset_password_link',
        verb: 'get'
      },
      accepts: [{
        arg: 'email',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );


  Members.get_user_campaigns = function(cb) {

    var currentUser = Members.app.currentUser;
    if (!currentUser) {
      return cb("UnAuthorized User");
    }
    Members.findOne({
      where: {
        id: currentUser.id
      },
      include: [{
        relation: "campaigns",
        scope: {
          include: "coupons"
        }
      }]
    }, function(err, obj_member) {
      if (err) {
        return cb(err);
      }
      return cb(null, obj_member);
    });
  };

  Members.remoteMethod(
    'get_user_campaigns', {
      http: {
        path: '/get_user_campaigns',
        verb: 'get'
      },
      accepts: [],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

  Members.reset_password = function(password, confirm, resetPasswordToken, cb) {
    if (password == "" || confirm == "") {
      return cb({
          message: 'Please enter password'
        },
        null);
    }
    if (password != confirm) {
      console.log('password not matched')
      return cb({
          message: 'password not matched'
        },
        null);
    }
    async.waterfall([
        function(done) {
          Members.findOne({
              where: {
                resetPasswordToken: resetPasswordToken,
                resetPasswordExpires: {
                  gt: Date.now()
                }
              }
            },
            function(err, user) {
              if (err) {
                return cb(err);
              }
              if (!user) {
                return cb({
                    message: 'Password reset token is invalid or has expired.'
                  },
                  null);
              }
              var data = {};
              // console.log('body', req.body);
              data.password = password;
              data.resetPasswordToken = "";
              data.resetPasswordExpires = "";

              user.updateAttributes(data, function(err, obj) {
                if (err) {
                  return cb(err);
                }
                done(err, user);
              });
            });
        },
        function(user, done) {
          // console.log('user', user);
          var smtpTransport = nodemailer.createTransport('SMTP', {
            service: 'Gmail',
            auth: {
              user: 'osvinandroid@gmail.com',
              pass: 'osvin@40'
            }
          });
          var mailOptions = {
            to: user.email,
            from: 'osvinandroid@gmail.com',
            subject: 'Your password has been changed',
            text: 'Hello,\n\n' +
              'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
          };
          smtpTransport.sendMail(mailOptions, function(err, response) {
            if (err) {
              // console.log('err', err);
              return cb(err);
            } else {
              return cb(null, {
                message: "Success! Your password has been changed."
              });
              // console.log('response', response);
            }
            // done(err);
          });
        }
      ],
      function(err) {
        // console.log('err', err);
        return cb(err);
        // res.redirect('/');
      });
  };

  Members.remoteMethod(
    'reset_password', {
      http: {
        path: '/reset_password',
        verb: 'post'
      },
      accepts: [{
        arg: 'password',
        type: 'string'
      }, {
        arg: 'confirm',
        type: 'string'
      }, {
        arg: 'resetPasswordToken',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );
  Members.get_user_customers = function(cb) {

    var currentUser = Members.app.currentUser;
    if (!currentUser) {
      return cb("UnAuthorized User");
    }
    Members.findOne({
      where: {
        id: currentUser.id
      },
      include: ["customers", "campaigns"]
    }, function(err, obj_member) {
      if (err) {
        return cb(err);
      }
      return cb(null, obj_member);
    });
  };

  Members.remoteMethod(
    'get_user_customers', {
      http: {
        path: '/get_user_customers',
        verb: 'get'
      },
      accepts: [],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );
  Members.change_password = function(old_password, new_password, cb) {
    var currentUser = Members.app.currentUser;

    if (!currentUser) {
      return cb("UnAuthorized User");
    }

    if (!old_password || !new_password) {
      return cb("Invalid password");
    }

    Members.findById(currentUser.id, function(err, obj_member) {
      if (err) {
        return cb(err);
      }
      obj_member.hasPassword(old_password, function(err, isMatch) {
        if (isMatch) {
          // Note that you’ll want to change the secret to something a lot more secure!
          // [TODO] hook into your favorite SMS API and send your user their code!
          obj_member.updateAttribute('password', new_password, function(err, obj_member_new) {
            if (err) {
              return cb(err);
            }
            return cb(null, obj_member_new);
          });
        } else {
          var err = new Error('Sorry, but that password do not match!');
          err.statusCode = 401;
          return cb(err);
        }
      });

    });
  }

  Members.remoteMethod(
    'change_password', {
      http: {
        path: '/change_password',
        verb: 'post'
      },
      accepts: [{
        arg: 'old_password',
        type: 'string'
      }, {
        arg: 'new_password',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );
};