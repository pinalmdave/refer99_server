module.exports = function(Plans) {
  Plans.observe('before save', function(ctx, next) {

    var instance = ctx.instance || ctx.data;
    if (ctx.isNewInstance) {
      var now = new Date();
      instance.created = now;
    }
    return next();

  });
};
