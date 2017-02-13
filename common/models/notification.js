var moment = require('moment-timezone');
var loopback = require('loopback');
var apn = require('apn');
var ObjectId = require('mongodb').ObjectID;
var FCM = require('fcm-push');
module.exports = function(Notification) {

  var send_firebase_message = function(obj_member, title, alert, payload, cb) {

    var m_token_firebase = obj_member.m_token_firebase;
    if (!m_token_firebase || m_token_firebase.length < 1) {
      return cb(null);
    }

    var fcm = new FCM("AAAAoq2z3nQ:APA91bHwcDEkEdH9nSRvf0EiyyKI0X856i3N18ou801ejCmmcsYrexsdbRu2biWYr-6de2guhnpPD7b932dcDqs2b0J9yt9D0r_C932wQFiiGcfsuBtU1WLw5XcNCQ1oB3l0IOpe_VAUIHgdq2S92E6DaD0dwTSX-A")
    var message = {
      to: m_token_firebase, // required
      // priority: "high",
      //collapse_key: 'your_collapse_key',
      data: payload,
      notification: {
        title: title,
        body: alert
      }
    };

    fcm.send(message, function(err, response) {
      if (err) {
        console.log('android_noteerr', err);
        // cb(err);
      } else {
        // console.log('note', response);
      }
        cb(null);
    });

  }

  Notification.send_apns = function(obj_member, title, alert, payload, cb) {

    send_firebase_message(obj_member, title, alert, payload, function(err) {

      if (err) {
        //return cb(err);
      }
      // cb(null);
      // console.log('send_apns');
      // var m_device = "f1a45ede15c590bb9307b83defd2deb08a7a7b562cf2eb0d43b5450962029ecb";
      var m_device = obj_member.m_device;
      if (!m_device || m_device.length < 1) {
        return cb(null);
      }
      var fcm = new FCM("AAAAoq2z3nQ:APA91bHwcDEkEdH9nSRvf0EiyyKI0X856i3N18ou801ejCmmcsYrexsdbRu2biWYr-6de2guhnpPD7b932dcDqs2b0J9yt9D0r_C932wQFiiGcfsuBtU1WLw5XcNCQ1oB3l0IOpe_VAUIHgdq2S92E6DaD0dwTSX-A")
      var message = {
        to: m_device, // required
        priority: "high",
        //collapse_key: 'your_collapse_key',
        data: payload,
        notification: {
          title: title,
          body: alert,
          sound: "default"
        }
      };

      fcm.send(message, function(err, response) {
        if (err) {
          console.log('ios_noteerr', err);
          // cb(err);
        } else {
          // console.log('note', response);
        }
          cb(null);
      });



    });


  }

  Notification.observe('before save', function(ctx, next) {

    var instance = ctx.instance || ctx.data;

    instance.n_time_updated = moment.tz("GMT0").format();

    if (!ctx.isNewInstance) {
      return next();
    }

    instance.n_time_created = moment.tz("GMT0").format();

    return next();

  });


};