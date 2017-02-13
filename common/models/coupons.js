var voucher_codes = require('voucher-code-generator');
var _ = require('lodash');
var moment = require('moment');
var emoji = require('node-emoji');
var nodemailer = require('nodemailer');
var client = require('twilio')('AC871ec7d4595e86fc80563a76671c6349', '6845b64800e3dc910db20c2c66aff215');
module.exports = function(Coupons) {
  Coupons.create_coupon = function(cp_id, cb) {
    var currentUser = Coupons.app.currentUser;
    if (!currentUser) {
      return cb("UnAuthorized User");
    }
    var Campaign = Coupons.app.models.Campaigns;
    // console.log(Coupons.app.models);
    Campaign.findOne({
      where: {
        id: cp_id
      }
    }, function(err, obj_camp) {
      if (err) {
        return cb(err);
      } else if (!obj_camp) {
        return cb({
          message: "Campaign not found!"
        }, null);
      } else {
        var data = {};
        data.cp_id = obj_camp.id;
        data.c_code = voucher_codes.generate({
          length: 4,
          prefix: "R99"
        });
        Coupons.create(data, function(err, coupon) {
          if (err) {
            return cb(err, null);
          }
          return cb(null, coupon);
        });
      }
    });
  };

  Coupons.remoteMethod(
    'create_coupon', {
      http: {
        path: '/create_coupon',
        verb: 'get'
      },
      accepts: [{
        arg: 'cp_id',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

  Coupons.create_active_coupon = function(cp_id, cb) {
    var Campaign = Coupons.app.models.Campaigns;
    // console.log(Coupons.app.models);
    Campaign.findOne({
      where: {
        id: cp_id
      }
    }, function(err, obj_camp) {
      if (err) {
        return cb(err);
      } else if (!obj_camp) {
        return cb({
          message: "Campaign not found!"
        }, null);
      } else {
        var data = {};
        data.cp_id = obj_camp.id;
        data.status = "activated";
        data.c_code = voucher_codes.generate({
          length: 4,
          prefix: "R99"
        });
        Coupons.create(data, function(err, coupon) {
          if (err) {
            return cb(err, null);
          }
          var Notifications = Coupons.app.models.Notifications;
          var Members = Coupons.app.models.Members;
          Notifications.create({
            m_id: obj_camp.m_id,
            /* user reward */
            n_data: {
              c_id: coupon.id,
              cp_id:obj_camp.id,
              cp_name:obj_camp.cp_name
            }
          }, function(err, obj_notification) {
            if (err) {
              return cb(err);
            }
            Members.findById(obj_notification.m_id, function(err, obj_member) {
              if (err) {
                return cb(err);
              }
              // console.log('obj_member',obj_member);
              var title = "refer99";
              var alert = "Coupon activated with code: " + coupon.c_code;
              var payload = {
                'type': 'coupon',
                m_id_to: obj_notification.m_id,
                n_id: obj_notification.id
              };

              Notifications.send_apns(obj_member, title, alert, payload, function(err) {
                if (err) {
                  return cb(err);
                }
                return cb(null, coupon);
              });
            });
          });
        });
      }
    });
  };

  Coupons.remoteMethod(
    'create_active_coupon', {
      http: {
        path: '/create_active_coupon',
        verb: 'get'
      },
      accepts: [{
        arg: 'cp_id',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

  Coupons.send_coupon_as_sms = function(mobile_no, c_code, cb) {
    var Campaign = Coupons.app.models.Campaigns;
    if (!mobile_no) {
      return cb({
        message: "Invalid mobile number!"
      }, null);
    }
    if (!c_code) {
      return cb({
        message: "Invalid coupon code!"
      }, null);
    }
    var message = "Hi, Your refer99 coupon code is: " + c_code;
    client.sendMessage({
      to: mobile_no, // Any number Twilio can deliver to
      from: '+14259709912', // A number you bought from Twilio and can use for outbound communication
      body: message // body of the SMS message

    }, function(err, responseData) { //this function is executed when a response is received from Twilio

      if (err) { // "err" is an error received during the request, if any
        return cb(err);
      } else {
        return cb(null, responseData);
      }
    });
  };

  Coupons.remoteMethod(
    'send_coupon_as_sms', {
      http: {
        path: '/send_coupon_as_sms',
        verb: 'get'
      },
      accepts: [{
        arg: 'mobile_no',
        type: 'string'
      }, {
        arg: 'c_code',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );
  Coupons.send_coupon_as_email = function(email, c_code, cb) {
    var Campaign = Coupons.app.models.Campaigns;
    if (!email) {
      return cb({
        message: "Invalid email address!"
      }, null);
    }
    if (!c_code) {
      return cb({
        message: "Invalid coupon code!"
      }, null);
    }
    var message = "Hi, Your refer99 coupon code is: " + c_code;
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
      subject: 'refer99 Coupon Code',
      text: message
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
  };

  Coupons.remoteMethod(
    'send_coupon_as_email', {
      http: {
        path: '/send_coupon_as_email',
        verb: 'get'
      },
      accepts: [{
        arg: 'email',
        type: 'string'
      }, {
        arg: 'c_code',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );
  Coupons.validate_coupon = function(c_code, cb) {
    var currentUser = Coupons.app.currentUser;
    if (!currentUser) {
      return cb("UnAuthorized User");
    }
    var Campaign = Coupons.app.models.Campaigns;
    Coupons.findOne({
      where: {
        c_code: c_code
      }
    }, function(err, obj_coupon) {
      if (err) {
        return cb(err);
      } else if (!obj_coupon) {
        return cb({
          message: "Coupon not found!"
        }, null);
      } else if (obj_coupon.status == "not_activated") {
        return cb({
          message: "Coupon not activated!"
        }, null);
      } else if (obj_coupon.status == "redeemed") {
        return cb({
          message: "Coupon already redeemed!"
        }, null);
      } else {
        Campaign.findOne({
          where: {
            and: [{
              id: obj_coupon.cp_id
            }, {
              end_date: {
                gte: new Date()
              }
            }, {
              start_date: {
                lte: new Date()
              }
            }]
          }
        }, function(err, obj_camp) {
          if (err) {
            return cb(err);
          } else if (!obj_camp) {
            return cb({
              message: "Campaign not found or expired or not started!"
            }, null);
          } else if (obj_camp.m_id.toString() != currentUser.id) {
            return cb({
              message: "User not authorised to validate this coupon!"
            }, null);
          } else {
            // return cb(null, obj_coupon);
            Coupons.update({
              id: obj_coupon.id
            }, {
              status: "redeemed"
            }, function(err, info) {
              if (err) {
                return cb(err, null);
              }
              return cb(null, info);
            });
          }
        });
      }
    });
  };

  Coupons.remoteMethod(
    'validate_coupon', {
      http: {
        path: '/validate_coupon',
        verb: 'get'
      },
      accepts: [{
        arg: 'c_code',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

  Coupons.generate_camp_coupon = function(cp_id, contact, email, cb) {
    if (contact) {
      var condition = {
        cust_contact: contact
      };
    } else if (email) {
      var condition = {
        cust_email: email
      };
    } else {
      return cb({
        message: "contact or email not found!"
      }, null);
    }
    var Campaign = Coupons.app.models.Campaigns;
    // console.log(Coupons.app.models);
    Campaign.findOne({
      where: {
        and: [{
          id: cp_id
        }, {
          end_date: {
            gte: new Date()
          }
        }, {
          start_date: {
            lte: new Date()
          }
        }]
      }
    }, function(err, obj_camp) {
      if (err) {
        return cb(err);
      } else if (!obj_camp) {
        return cb({
          message: "Campaign not found or expired or not started!"
        }, null);
      } else {
        condition.m_id = obj_camp.m_id;
        var Customers = Coupons.app.models.Customers;
        Customers.findOne({
          where: condition
        }, function(err, obj_cust) {
          if (err) {
            return cb(err);
          } else if (_.isEmpty(obj_cust)) {
            return cb({
              message: "Customer not found!"
            }, null);
          } else {
            var data = {};
            data.cp_id = obj_camp.id;
            data.c_code = voucher_codes.generate({
              length: 4,
              prefix: "VDL"
            });
            // console.log('obj_cust.customers',obj_cust);
            data.cust_id = obj_cust.id;
            Coupons.findOrCreate({
              where: {
                cp_id: data.cp_id,
                cust_id: obj_cust.id
              }
            }, data, function(err, coupon) {
              if (err) {
                return cb(err, null);
              }
              return cb(null, coupon);
            });
          }

        });
      }
    });
  };

  Coupons.remoteMethod(
    'generate_camp_coupon', {
      http: {
        path: '/generate_camp_coupon',
        verb: 'post'
      },
      accepts: [{
        arg: 'cp_id',
        type: 'string'
      }, {
        arg: 'contact',
        type: 'string'
      }, {
        arg: 'email',
        type: 'string'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

  Coupons.getusercoupons = function(filter, cb) {

    /*var Campaign = Coupons.app.models.Campaigns;*/
    // console.log(Coupons.app.models);
    Coupons.find({
      include: "customers"
    }, function(err, obj_camp) {
      if (err) {
        return cb(err, null);
      }
      return cb(null, obj_camp);

    });

  };

  Coupons.remoteMethod(
    'getusercoupons', {
      http: {
        path: '/getusercoupons',
        verb: 'get'
      },
      accepts: [{
        arg: 'filter',
        type: 'object'
      }],
      returns: {
        arg: 'result',
        type: 'object'
      }
    }
  );

};