var _ = require('lodash');
module.exports = function(Campaigns) {
  Campaigns.observe('before save', function(ctx, next) {
    var instance = ctx.instance || ctx.data;
    var currentUser = Campaigns.app.currentUser;
    if (!currentUser) {
      return next("UnAuthorized User");
    }
    if (ctx.isNewInstance) {
      var now = new Date();
      instance.created = now;
      var Members = Campaigns.app.models.Members;
      Campaigns.findOne({
        where: {
          m_id: currentUser.id
        }
      }, function(err, obj_camp) {
        if (err) {
          return next(err);
        }
        if (_.isEmpty(obj_camp)) {
          Members.update({
            id: currentUser.id
          }, {
            camp_trial: true
          }, function(err, info) {
            if (err) {
              return next(err);
            }
            return next();
          });
        } else {
          return next();
        }
      });
    } else {
      return next();
    }

  });
  Campaigns.get_campaign = function(cp_id, cb) {
    Campaigns.findOne({
      where: {
          id: cp_id
      },
      include: "members"
    }, function(err, obj_camp) {
      if (err) {
        return cb(err);
      } else if (!obj_camp) {
        return cb({
          message: "Offer not found or expired or not started!"
        }, null);
      } else {
        var Coupons = Campaigns.app.models.Coupons;
        Coupons.check_max_coupons(obj_camp.m_id, function(err, result) {
          // result now equals 'done' 
          if (err) {
            // console.log('err', err);
            return cb(err);
          } else {
            if (result.can_execute) {
              return cb(null, obj_camp);
            } else {
              return cb({
                message: "Max coupons reached!"
              }, null);
            }
          }
        });
      }
    });
  };

  Campaigns.remoteMethod(
    'get_campaign', {
      http: {
        path: '/get_campaign',
        verb: 'get'
      },
      accepts: [{
        arg: 'cp_id',
        type: 'string'
      }],
      returns: {
        root: true,
        type: 'object'
      }
    }
  );
};
