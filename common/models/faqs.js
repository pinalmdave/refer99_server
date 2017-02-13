var _ = require('lodash');

module.exports = function(Faqs) {
  Faqs.observe('before save', function(ctx, next) {

    var instance = ctx.instance || ctx.data;
     if (!ctx.isNewInstance) {
      return next();
    }
    var now = new Date();
    instance.created = now;
    return next();

  });
};