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
};
