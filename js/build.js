// Include your namespaced libraries
var NotificationInbox = new Fliplet.Registry.get('notification-inbox:1.0:core');

// This function will run for each instance found in the page
Fliplet.Widget.instance('notification-inbox-1-0-0', function (data) {
  // The HTML element for each instance. You can use $(element) to use jQuery functions on it
  var element = this;

  // Sample implementation to initialize the widget
  var inbox = new NotificationInbox(element, data);
  Fliplet.Hooks.on('beforeNotificationsInit', function () {
    // Initialize Notification Inbox component and stops Notifications app component initialization
    inbox.init();
    return Promise.reject();
  });
});
