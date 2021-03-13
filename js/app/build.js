var Notifications = new Fliplet.Registry.get('notification-inbox:1.0:app:core');

// Wait for sync hooks to register
Fliplet().then(function() {
  var options = {};

  Fliplet.Notifications.Scopes.get().then(function(scope) {
    var data = { scope: scope };

    Fliplet.Hooks.run('beforeNotificationsInit', data, options).then(function() {
      var notifications = new Notifications(data);

      notifications.init(options);

      Fliplet.Hooks.run('afterNotificationsInit', notifications);
    });
  });
});
