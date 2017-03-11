var _ = require('lodash');

module.exports = function(Payments) {
  Payments.observe('before save', function(ctx, next) {

    var instance = ctx.instance || ctx.data;

    var now = new Date();
    instance.created = now;
    next();

  });
  Payments.observe('after save', function(ctx, next) {

    if (!ctx.isNewInstance) {
      return next();
    }
    var instance = ctx.instance || ctx.data;
    var Members = Payments.app.models.Members;
    Members.update({
      id: instance.m_id
    }, {
      last_payment: instance.created,
      m_type: instance.type
    }, function(err, info) {
      if (err) {
        return next(err);
      }
      return next(null, instance);
    });

  });
};
