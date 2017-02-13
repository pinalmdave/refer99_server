module.exports = function(Campaigns) {
  Campaigns.observe('before save', function(ctx, next) {

    var instance = ctx.instance || ctx.data;

    var now = new Date();
    instance.created = now;
    next();

  });
};