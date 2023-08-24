// Include your namespaced libraries
var NotificationInbox = new Fliplet.Registry.get('fliplet-viewer-notification-inbox:1.0:core');

// This function will run for each instance found in the page
Fliplet.Widget.instance('fliplet-viewer-notification-inbox-1-0-0', function(data) {
  // The HTML element for each instance. You can use $(element) to use jQuery functions on it
  var element = this;

  // Sample implementation to initialize the widget
  var inbox = new NotificationInbox(element, data);

  Fliplet.Widget.register('FvNotificationInbox', function() {
    return inbox;
  });

  Fliplet().then(function() {
    $(element).translate();

    // Initialize Notification Inbox component
    inbox.init();
  });
});

Fliplet.Analytics.trackEvent({
  category: 'fv_notification_inbox',
  action: 'fv_inbox_visit',
  nonInteraction: true
});
