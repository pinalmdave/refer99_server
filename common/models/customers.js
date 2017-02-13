var _ = require('lodash');

module.exports = function(Customers) {
  Customers.observe('before save', function(ctx, next) {
    var currentUser = Customers.app.currentUser;
    if (!currentUser) {
      return next("UnAuthorized User");
    }
    if (!ctx.isNewInstance) {
      return next();
    }
    var instance = ctx.instance || ctx.data;
    if (instance.cust_contact && instance.cust_email) {
      var condition = {
        and: [{
          m_id: currentUser.id
        }, {
          cust_contact: instance.cust_contact
        }, {
          cust_email: instance.cust_email
        }]
      };
    } else {
      var condition = {
        cust_contact: instance.cust_contact,
        m_id: currentUser.id
      };
    }
    var Members = Customers.app.models.Members;
    Customers.findOne({
      where: condition
    }, function(err, obj_cust) {
      if (err) {
        return cb(err);
      } else if (_.isEmpty(obj_cust)) {
        return next();
      } else {
        return next("Customer already exist in list!");
      }

    });
  });
};