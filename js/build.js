// Include your namespaced libraries
var NotificationInbox = new Fliplet.Registry.get('notification-inbox:1.0:core');

// This function will run for each instance found in the page
Fliplet.Widget.instance('notification-inbox-1-0-0', function(data) {
  // The HTML element for each instance. You can use $(element) to use jQuery functions on it
  var element = this;

  // Sample implementation to initialize the widget
  var inbox = new NotificationInbox(element, data);

  Fliplet().then(function() {
    if (data.mode === 'demo' && Fliplet.App.isPreview(true)) {
      // Initialize inbox as demo
      inbox.init({
        mode: 'demo'
      });

      return;
    }

    Fliplet.Cache.get({
      // No need to update the appNotificationsSeenAt more than once every 60 seconds
      expire: 60,
      key: 'appNotificationsSeenAt'
    }, function onFetchData() {
      return Fliplet.Session.set({
        appNotificationsSeenAt: Math.floor(Date.now() / 1000) // current timestamp in seconds
      }, {
        required: true
      });
    });
  });

  Fliplet.Hooks.on('beforeNotificationsInit', function(appComponentData, options) {
    if (data.mode === 'demo' && Fliplet.App.isPreview(true)) {
      return;
    }

    options.clearNewCountOnUpdate = true;
    options.startCheckingUpdates = true;

    // Initialize Notification Inbox component
    inbox.init();
  });
});

Fliplet.Analytics.trackEvent({
  category: 'notification_inbox',
  action: 'inbox_visit',
  nonInteraction: true
});
