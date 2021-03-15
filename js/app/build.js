var Notifications = new Fliplet.Registry.get('notification-inbox:1.0:app:core');

// Wait for sync hooks to register
Fliplet().then(function() {
  var options = {};

  Fliplet.Notifications.Scopes.get().then(function(scope) {
    var data = { scope: scope };

    Fliplet.Hooks.run('beforeNotificationsInit', data, options).then(
      function() {
        var instance = new Notifications(data);

        instance.init(options).then(function(counts) {
          Fliplet.Widget.register('AppNotifications', function() {
            return instance;
          });

          Fliplet.Hooks.run('afterNotificationsInit', instance, counts);
        });
      }
    );
  });
});
