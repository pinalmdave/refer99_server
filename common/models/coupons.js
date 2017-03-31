var voucher_codes = require('voucher-code-generator');
var async = require('async');
var _ = require('lodash');
var moment = require('moment-timezone');
var moment_time = require('moment');
var emoji = require('node-emoji');
var nodemailer = require('nodemailer');
var handlebars = require('handlebars');
var fs = require('fs')
  // var client = require('twilio')('AC871ec7d4595e86fc80563a76671c6349', '6845b64800e3dc910db20c2c66aff215');
var twilio = require('twilio');
var client = new twilio.RestClient('AC871ec7d4595e86fc80563a76671c6349', '6845b64800e3dc910db20c2c66aff215');
module.exports = function(Coupons) {

  Coupons.observe('before save', function(ctx, next) {

    var instance = ctx.instance || ctx.data;
    if (ctx.isNewInstance) {
      instance.created = moment.tz("GMT0").format();
    }
    return next();

  });
  Coupons.observe('after save', function(ctx, next) {
    var instance = ctx.instance || ctx.data;
    if (ctx.isNewInstance) {
      var Payment = Coupons.app.models.Payments;
      var Plan = Coupons.app.models.Plans;
      Coupons.check_max_coupons(instance.m_id, function(err, result) {
        // result now equals 'done' 
        if (err) {
          // console.log('err', err);
          return next();
        } else {
          console.log('result', result);
          if (result.can_execute) {
            return next();
          } else {
            var Notifications = Coupons.app.models.Notifications;
            var Members = Coupons.app.models.Members;
            Notifications.create({
              m_id: instance.m_id,
              /* user reward */
              n_data: {
                c_created: instance.created,
                message: "max coupon exceeds"
              }
            }, function(err, obj_notification) {
              if (err) {
                return next(err);
              }
              Members.findById(instance.m_id, function(err, obj_member) {
                if (err) {
                  return next(err);
                }
                // console.log('obj_member',obj_member);
                var mon = moment_time().format('MMMM');
                var title = "refer99";
                var alert = "Max coupon limit exceeds for the month of " + mon;
                var payload = {
                  'type': 'max_coupon',
                  m_id_to: obj_notification.m_id,
                  n_id: obj_notification.id
                };

                Notifications.send_apns(obj_member, title, alert, payload, function(err) {
                  if (err) {
                    return next(err);
                  }
                  return next();
                });
              });
            });
          }
        }
      });
    } else {
      return next();
    }

  });
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
        data.m_id = obj_camp.m_id;
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
        data.m_id = obj_camp.m_id;
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
              cp_id: obj_camp.id,
              cp_name: obj_camp.cp_name
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

  var readHTMLFile = function(path, callback) {
    fs.readFile(path, { encoding: 'utf-8' }, function(err, html) {
      if (err) {
        throw err;
        callback(err);
      } else {
        callback(null, html);
      }
    });
  };
  var send_sms = function(mobile_no, msg, cb) {
    var Campaign = Coupons.app.models.Campaigns;
    if (!mobile_no) {
      return cb({
        message: "Invalid mobile number!"
      }, null);
    }
    if (!msg) {
      return cb({
        message: "Invalid message!"
      }, null);
    }
    var message = msg;
    client.messages.create({
      to: mobile_no, // Any number Twilio can deliver to
      from: '+14259709912', // A number you bought from Twilio and can use for outbound communication
      body: message // body of the SMS message
    }, function(err, responseData) { //this function is executed when a response is received from Twilio

      if (err) { // "err" is an error received during the request, if any
        console.log('err', err);
        return cb(err);
      } else {
        return cb(null, responseData);
      }
    });
  };
  var send_email = function(subject, email, emailObj, cb) {
    var Campaign = Coupons.app.models.Campaigns;
    if (!subject) {
      return cb({
        message: "Invalid email subject!"
      }, null);
    }
    if (!email) {
      return cb({
        message: "Invalid email address!"
      }, null);
    }
    if (!emailObj) {
      return cb({
        message: "Invalid message!"
      }, null);
    }
    // var message = msg;
    readHTMLFile(__dirname + "/../mail/" + emailObj.shareType + ".html", function(err, html) {
      if (err) {
        return cb(err, null);
      }
      var template = handlebars.compile(html);
      var replacements = emailObj;
      var htmlToSend = template(replacements);
      var smtpTransport = nodemailer.createTransport('SMTP', {
        service: 'gmail',
        auth: {
          user: 'contact@viral99.com',
          pass: 'contact@viral99'
        }
      });
      var mailOptions = {
        to: email,
        from: 'contact@viral99.com',
        subject: subject,
        html: htmlToSend
      };
      smtpTransport.sendMail(mailOptions, function(err, response) {
        if (err) {
          console.log('err', err);
          return cb(err, null);
        } else {
          // console.log('response', response);
          return cb(null, {
            "message": "success"
          });
        }
      });
    });
  };
  Coupons.process_coupon_generate = function(cp_id, referrer_id, email, contact, cb) {
    var Campaign = Coupons.app.models.Campaigns;
    // console.log(cp_id, referrer_id, email, contact);
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
        var objFind = {};
        data.cp_id = obj_camp.id;
        data.m_id = obj_camp.m_id;
        objFind.cp_id = obj_camp.id;
        if (obj_camp.cp_share) {
          data.status = "not_activated";
        } else {
          data.status = "activated";
        }
        data.c_code = voucher_codes.generate({
          length: 4,
          prefix: "R99"
        });
        if (referrer_id) {
          data.referrer_id = referrer_id;
        }
        if (email && contact) {
          data.email = email;
          data.contact = contact;
          objFind["$or"] = [{ email: email }, { contact: contact }];
        } else if (email) {
          data.email = email;
          objFind.email = email;
        } else if (contact) {
          data.contact = contact;
          objFind.contact = contact;
        }
        data.refer_id = voucher_codes.generate({
          length: 4,
          prefix: "RFR"
        });
        Coupons.findOrCreate({
          where: objFind
        }, data, function(err, coupon, created) {
          if (err) {
            return cb(err, null);
          } else if (!created) {
            return cb({ "message": "User already avail this offer coupon." }, null);
          }
          var Notifications = Coupons.app.models.Notifications;
          var Members = Coupons.app.models.Members;

          async.parallel([
              function(callback) {
                //send notification to shopkeeper
                Notifications.create({
                  m_id: obj_camp.m_id,
                  /* user reward */
                  n_data: {
                    c_id: coupon.id,
                    cp_id: obj_camp.id,
                    cp_name: obj_camp.cp_name,
                    status: coupon.status
                  }
                }, function(err, obj_notification) {
                  if (err) {
                    return callback(err, null);
                  }
                  Members.findById(obj_notification.m_id, function(err, obj_member) {
                    if (err) {
                      return callback(err, null);
                    }
                    // console.log('obj_member',obj_member);
                    var title = obj_camp.cp_name;
                    var alert = "Coupon generated with code: " + coupon.c_code;
                    var payload = {
                      'type': 'coupon',
                      m_id_to: obj_notification.m_id,
                      n_id: obj_notification.id
                    };

                    Notifications.send_apns(obj_member, title, alert, payload, function(err) {
                      if (err) {
                        return callback(err, null);
                      }
                      callback(null, 'Notifications');
                    });
                  });
                });
              },
              function(callback) {
                //activate referrer coupon and send message or email
                if (obj_camp.cp_share && referrer_id) {
                  Coupons.findOne({
                    where: {
                      refer_id: referrer_id
                    }
                  }, function(err, obj_coupon) {
                    if (err) {
                      return callback(err, null);
                    } else if (_.isEmpty(obj_coupon)) {
                      return callback(null, null);
                    } else if (obj_coupon.status != "not_activated") {
                      return callback(null, null);
                    }
                    Coupons.update({
                      refer_id: referrer_id
                    }, {
                      status: "activated"
                    }, function(err, info) {
                      if (err) {
                        return callback(err, null);
                      } else {
                        var email_obj = {};
                        email_obj.shareType = "coupon";
                        var message = "Congratulations! Your coupon is activated now.\n";
                        message += (obj_camp.business_name) + " : " + (obj_camp.cp_offer) + "\n";
                        message += "Coupon code : " + obj_coupon.c_code + "\n";
                        message += "Status : activated \n";
                        message += "Addl discount : " + (obj_camp.add_discount ? obj_camp.add_discount_value : "None") + "\n";
                        message += "Validity : " + (moment_time(moment_time(obj_camp.start_date).add(1,"days")).format('LL')) + " To " + (moment_time(moment_time(obj_camp.end_date).add(1,"days")).format('LL')) + "\n";
                        email_obj.message = "Congratulations! Your coupon code is activated now."
                        if (obj_camp.redeemable_at == "online") {
                          // message += obj_camp.web_address;
                          email_obj.address = obj_camp.web_address;
                          email_obj.address_opt = "";
                        } else {
                          email_obj.address = obj_camp.business_address + " " + (obj_camp.city ? obj_camp.city : "") + " " + (obj_camp.state ? obj_camp.state : "") + " " + (obj_camp.zip_code ? obj_camp.zip_code : "");
                          email_obj.address_opt = obj_camp.business_address_opt?obj_camp.business_address_opt:"";
                          // message += email_obj.address;
                        }
                        email_obj.business_name = obj_camp.business_name;
                        email_obj.offer = obj_camp.cp_offer;
                        email_obj.terms = obj_camp.cp_terms;
                        email_obj.c_code = obj_coupon.c_code;
                        email_obj.status = "activated";
                        email_obj.add_discount = "None";
                        email_obj.validTill = (moment_time(moment_time(obj_camp.start_date).add(1,"days")).format('LL')) + " To " + (moment_time(moment_time(obj_camp.end_date).add(1,"days")).format('LL'));

                        // message += " to redeem it.";
                        var subject = "Exclusive offer from " + (obj_camp.business_name) + ", " + obj_camp.cp_offer;
                        if (obj_coupon.email && obj_coupon.contact) {
                          send_sms(obj_coupon.contact, message, function(err, res) {
                            send_email(subject, obj_coupon.email, email_obj, function(err, res) {
                              callback(null, 'referrer');
                            });
                          });
                        } else if (obj_coupon.email) {
                          send_email(subject, obj_coupon.email, email_obj, function(err, res) {
                            callback(null, 'referrer');
                          });
                        } else if (obj_coupon.contact) {
                          send_sms(obj_coupon.contact, message, function(err, res) {
                            callback(null, 'referrer');
                          });
                        } else {
                          callback(null, 'referrer');
                        }
                      }
                    });
                  });
                } else {
                  callback(null, 'referrer');
                }
              },
              function(callback) {
                //send message or email to customer
                var email_obj = {};
                var link = "http://refer99.com/admin/#/app/process/" + coupon.id + "/coupon_process";
                email_obj.link = link;
                var message = (obj_camp.business_name) + " : " + (obj_camp.cp_offer) + "\n";
                message += "Coupon code : " + coupon.c_code + "\n";
                message += "Status : " + coupon.status + "\n";
                message += "Addl discount : " + (obj_camp.add_discount ? obj_camp.add_discount_value : "None") + "\n";
                message += "Validity : " + (moment_time(moment_time(obj_camp.start_date).add(1,"days")).format('LL')) + " To " + (moment_time(moment_time(obj_camp.end_date).add(1,"days")).format('LL')) + "\n";
                if (obj_camp.cp_share) {
                  message += "Please share the link with your friend or family to activate this coupon.\n";
                  message += link;
                  email_obj.shareType = "coupon_with_share";
                  email_obj.shareMsg = "Activate your coupon by sharing link with your friend or family."
                } else {
                  // message += "Your coupon code is " + coupon.c_code + ".Coupon is Activated and ready to be used.";
                  email_obj.shareType = "coupon";
                }
                if (obj_camp.redeemable_at == "online") {
                  // message += obj_camp.web_address;
                  email_obj.address = obj_camp.web_address;
                  email_obj.address_opt = "";
                } else {
                  email_obj.address = obj_camp.business_address + " " + (obj_camp.city ? obj_camp.city : "") + " " + (obj_camp.state ? obj_camp.state : "") + " " + (obj_camp.zip_code ? obj_camp.zip_code : "");
                  email_obj.address_opt = obj_camp.business_address_opt?obj_camp.business_address_opt:"";
                  // message += email_obj.address;
                }
                // message += " to redeem it.";
                if (obj_camp.add_discount) {
                  message += " share the link with friend or family and get additional discount of " + obj_camp.add_discount_value + ".\n";
                  message += link;
                  email_obj.shareType = "coupon_with_share";
                  email_obj.add_discount = obj_camp.add_discount_value;
                  email_obj.shareMsg = "Want more discounts? Share your coupon link with friend or family and get " + obj_camp.add_discount_value + " additional discount."
                } else {
                  email_obj.add_discount = "None";
                }
                email_obj.business_name = obj_camp.business_name;
                email_obj.offer = obj_camp.cp_offer;
                email_obj.terms = obj_camp.cp_terms;
                email_obj.c_code = coupon.c_code;
                email_obj.status = coupon.status;
                email_obj.validTill = (moment_time(moment_time(obj_camp.start_date).add(1,"days")).format('LL')) + " To " + (moment_time(moment_time(obj_camp.end_date).add(1,"days")).format('LL'));
                email_obj.message = "Please check your coupon details.";
                var subject = "Exclusive offer from " + (obj_camp.business_name) + ", " + obj_camp.cp_offer;
                if (coupon.email && coupon.contact) {
                  send_sms(coupon.contact, message, function(err, res) {
                    send_email(subject, coupon.email, email_obj, function(err, res) {
                      callback(null, 'send coupon');
                    });
                  });
                } else if (coupon.email) {
                  send_email(subject, coupon.email, email_obj, function(err, res) {
                    callback(null, 'send coupon');
                  });
                } else if (coupon.contact) {
                  send_sms(coupon.contact, message, function(err, res) {
                    callback(null, 'send coupon');
                  });
                } else {
                  callback(null, 'send coupon');
                }
              },
              function(callback) {
                //add additional_discount to customer and send messsage and email
                if (obj_camp.add_discount && referrer_id) {
                  Coupons.findOne({
                    where: {
                      refer_id: referrer_id
                    }
                  }, function(err, obj_coupon) {
                    if (err) {
                      return callback(err, null);
                    } else if (_.isEmpty(obj_coupon)) {
                      return callback(null, null);
                    } else if (obj_coupon.add_discount) {
                      return callback(null, null);
                    }
                    Coupons.update({
                      refer_id: referrer_id
                    }, {
                      add_discount: true
                    }, function(err, info) {
                      if (err) {
                        return callback(err, null);
                      } else {
                        var email_obj = {};
                        email_obj.shareType = "coupon";
                        var message = "Congratulations! You just got additional " + obj_camp.add_discount_value + " discount by sharing coupon with your friend.\n"
                        message += (obj_camp.business_name) + " : " + (obj_camp.cp_offer) + "\n";
                        message += "Coupon code : " + obj_coupon.c_code + "\n";
                        message += "Status : activated \n";
                        message += "Addl discount : " + (obj_camp.add_discount ? obj_camp.add_discount_value : "None") + "\n";
                        message += "Validity : " + (moment_time(moment_time(obj_camp.start_date).add(1,"days")).format('LL')) + " To " + (moment_time(moment_time(obj_camp.end_date).add(1,"days")).format('LL')) + "\n";
                        email_obj.message = "Congratulation, you received " + obj_camp.add_discount_value + " additional discount by sharing your coupon with your friend(s). Please find details as below.";
                        if (obj_camp.redeemable_at == "online") {
                          // message += obj_camp.web_address;
                          email_obj.address = obj_camp.web_address;
                          email_obj.address_opt = "";
                        } else {
                          email_obj.address = obj_camp.business_address + " " + (obj_camp.city ? obj_camp.city : "") + " " + (obj_camp.state ? obj_camp.state : "") + " " + (obj_camp.zip_code ? obj_camp.zip_code : "");
                          email_obj.address_opt = obj_camp.business_address_opt?obj_camp.business_address_opt:"";
                          // message += email_obj.address;
                        }
                        email_obj.business_name = obj_camp.business_name;
                        email_obj.offer = obj_camp.cp_offer;
                        email_obj.terms = obj_camp.cp_terms;
                        email_obj.c_code = obj_coupon.c_code;
                        email_obj.status = "activated";
                        email_obj.add_discount = obj_camp.add_discount_value;
                        email_obj.validTill = (moment_time(moment_time(obj_camp.start_date).add(1,"days")).format('LL')) + " To " + (moment_time(moment_time(obj_camp.end_date).add(1,"days")).format('LL'));
                        // message += " to get it.";
                        var subject = "Exclusive offer from " + (obj_camp.business_name) + ", " + obj_camp.cp_offer;
                        if (obj_coupon.email && obj_coupon.contact) {
                          send_sms(obj_coupon.contact, message, function(err, res) {
                            send_email(subject, obj_coupon.email, email_obj, function(err, res) {
                              callback(null, 'additional');
                            });
                          });
                        } else if (obj_coupon.email) {
                          send_email(subject, obj_coupon.email, email_obj, function(err, res) {
                            callback(null, 'additional');
                          });
                        } else if (obj_coupon.contact) {
                          send_sms(obj_coupon.contact, message, function(err, res) {
                            callback(null, 'additional');
                          });
                        } else {
                          callback(null, 'additional');
                        }
                      }
                    });
                  });
                } else {
                  callback(null, 'additional');
                }
              }
            ],
            // optional callback
            function(err, results) {
              // the results array will equal ['one','two'] even though
              // the second function had a shorter timeout.
              if (err) {
                console.log(err);
                return cb(err);
              } else {
                console.log('results', results);
                return cb(null, coupon);
              }
            });
        });
      }
    });
  };

  Coupons.remoteMethod(
    'process_coupon_generate', {
      http: {
        path: '/process_coupon_generate',
        verb: 'get'
      },
      accepts: [{
        arg: 'cp_id',
        type: 'string'
      }, {
        arg: 'referrer_id',
        type: 'string'
      }, {
        arg: 'email',
        type: 'string'
      }, {
        arg: 'contact',
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
    client.messages.create({
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
        user: 'contact@viral99.com',
        pass: 'contact@viral99'
      }
    });
    var mailOptions = {
      to: email,
      from: 'contact@viral99.com',
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
              message: "Offer not found or expired or not started!"
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
              obj_coupon.status = "redeemed";
              obj_coupon.campaign = obj_camp;
              return cb(null, obj_coupon);
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
          message: "Offer not found or expired or not started!"
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
  Coupons.check_max_coupons = function(m_id, cb) {
    var Payment = Coupons.app.models.Payments;
    var Plan = Coupons.app.models.Plans;
    async.waterfall([
      function(callback) {
        Payment.findOne({
          where: {
            m_id: m_id
          },
          order: "created desc"
        }, function(err, payment) {
          if (err) {
            return callback(err);
          }
          if (_.isEmpty(Payment)) {
            return callback({ message: "Payment not found" }, null);
          }
          callback(null, payment);
        });
      },
      function(payment, callback) {
        // arg1 now equals 'one' and arg2 now equals 'two'
        Plan.findOne({
          where: {
            p_name: payment.type
          }
        }, function(err, plan) {
          if (err) {
            return callback(err);
          }
          if (_.isEmpty(plan)) {
            return callback({ message: "plan not found" }, null);
          }
          plan.payment = payment;
          callback(null, plan);
        });
      },
      function(plan, callback) {
        // arg1 now equals 'three'
        var mon_diff = moment_time().diff(moment_time(plan.payment.created), "months");
        // console.log('mon_diff',mon_diff);
        var g_month = moment_time(plan.payment.created).add(mon_diff, 'M');
        // console.log('g_month',g_month);
        var l_month = moment_time(g_month).add(1, 'M');
        // console.log('l_month',l_month);
        Coupons.count({ m_id: m_id, $and: [{ created: { $gt: new Date(g_month) } }, { created: { $lt: new Date(l_month) } }] }, function(err, count) {
          if (err) {
            return callback(err);
          }
          if (count > plan.coupons_count) {
            var data = {
              plan_coupons_count: plan.coupons_count,
              coupons_generated: count,
              can_execute: false
            };
          } else {
            var data = {
              plan_coupons_count: plan.coupons_count,
              coupons_generated: count,
              can_execute: true
            };
          }
          callback(null, data);
        });
      }
    ], function(err, result) {
      // result now equals 'done' 
      if (err) {
        // console.log('err', err);
        return cb(err);
      } else {
        return cb(null, result);
      }
    });
  };

};
