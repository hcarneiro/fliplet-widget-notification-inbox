Fliplet.Registry.set('notification-inbox:1.0:core', function (element, data) {

  var BATCH_SIZE = 20;

  var $container = $(element);
  var $notifications = $container.find('.notifications');

  var notifications = [];
  var newNotifications = [];
  var $loadMore;
  var appNotifications;

  function isUnread(n) {
    return !n.readStatus;
  }

  function getUnreadCountFromUI() {
    return Math.max(0, parseInt($('.unread-count').text(), 10) || 0);
  }

  function debouncedCheckForUpdates() {
    return _.debounce(function () {
      if (!appNotifications) {
        return Promise.reject('Notifications add-on is not configured');
      }

      return appNotifications.checkForUpdates(Date.now());
    }, 200, {
      leading: true
    });
  }

  function addNotification(notification, options) {
    options = options || {};

    if (!notification.isFirstBatch) {
      debouncedCheckForUpdates();

      if (!options.forceRender) {
        newNotifications.push(notification);
        if ($('.notifications-new').length) {
          return;
        }

        $notifications.prepend(Fliplet.Widget.Templates['templates.newNotifications']());
        return;
      }
    }

    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notification']());
    var html = tpl(notification);
    var index = -1;

    notifications.push(notification);
    notifications = _.orderBy(notifications, ['createdAt'], ['desc']);
    index = _.findIndex(notifications, { id: notification.id });

    if (notifications.length === 1) {
      // No notifications on the page
      $notifications.html(html);
    } else if (index === 0) {
      // Notification goes to the beginning
      $notifications.prepend(html);
    } else if (index === notifications.length - 1) {
      // Notification goes to the end
      $notifications.append(html);
    } else {
      // Notification goes to the middle acc. index
      $notifications.find('.notification').eq(index).before(html);
    }

    if (options.addLoadMore && !$loadMore) {
      $loadMore = $(Fliplet.Widget.Templates['templates.loadMore']());
      $notifications.after($loadMore);
    }
  }

  function updateNotification(notification) {
    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notification']());
    var html = tpl(notification);
    var index = _.findIndex(notifications, { id: notification.id });

    if (index < 0) {
      addNotification(notification);
      return;
    }

    notifications[index] = notification;
    $('[data-notification-id="' + notification.id + '"]').replaceWith(html);
  }

  function deleteNotification(notification, options) {
    options = options || {};

    if (notification.isFirstBatch) {
      // A deleted notification as part of the first batch will be ignored as it hasn't been cached to the notifications array nor rendered yet
      return;
    }

    _.remove(notifications, function(n) {
      return n.id === notification.id;
    });
    $('[data-notification-id="' + notification.id + '"]').remove();

    if (!notifications.length) {
      noNotificationsFound();
    }

    debouncedCheckForUpdates();
  }

  function updateUnreadCount(count) {
    if (!count) {
      $container.removeClass('notifications-has-unread');
      $container.find('.notifications-toolbar').html(Fliplet.Widget.Templates['templates.toolbar.empty']());
      return;
    }

    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.toolbar']());
    var html = tpl({
      count: count
    });

    $container.addClass('notifications-has-unread');
    $container.find('.notifications-toolbar').html(html);
  }

  function processNotification(notification, options) {
    options = options || {};

    if (notification.isDeleted) {
      deleteNotification(notification);
    } else if (notification.isUpdate) {
      updateNotification(notification);
    } else {
      addNotification(notification, {
        addLoadMore: true,
        forceRender: options.forceRender
      });
    }
  }

  function markAsRead(ids) {
    var arr = [];
    var affected;
    var unreadCount;

    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    ids = _.uniq(_.compact(ids));

    _.forEach(notifications, function (n) {
      if (ids.indexOf(n.id) < 0) {
        return;
      }

      arr.push(n);
    });

    if (!appNotifications) {
      return Promise.reject('Notifications add-on is not configured');
    }

    return appNotifications.markAsRead(arr)
      .then(function (results) {
        var selector = _.map(ids, function (id) {
          return '[data-notification-id="' + id + '"]'
        }).join(',');

        // Update rendered notifications
        $notifications.find(selector).removeClass('notification-unread').addClass('notification-read').find('.notification-badge').remove();

        // Update unread count
        updateUnreadCount(results.unreadCount);
      });
  }

  function markAllUIAsRead() {
    // Update rendered notifications
    $notifications.find('.notification-unread').removeClass('notification-unread').addClass('notification-read').find('.notification-badge').remove();

    // Update unread count
    updateUnreadCount(0);
  }

  function markAllAsRead() {
    if (!appNotifications) {
      return Promise.reject('Notifications add-on is not configured');
    }

    return appNotifications.markAllAsRead()
      .then(markAllUIAsRead)
      .catch(function (err) {
        console.warn(err);
        markAllUIAsRead();
      });
  }

  function addNewNotifications() {
    while (newNotifications.length) {
      notification = newNotifications.shift();
      addNotification(notification, {
        forceRender: true
      });
    }
    $('.notifications-new').remove();
  }

  function loadMore(target) {
    if (!appNotifications) {
      return Promise.reject('Notifications add-on is not configured');
    }

    if (appNotifications.isPolling()) {
      return Promise.resolve();
    }

    var $target = $(target).addClass('loading');

    return appNotifications.poll({
      limit: BATCH_SIZE,
      where: {
        createdAt: {
          $lt: _.min(_.map(notifications, 'createdAt'))
        }
      },
      publishToStream: false
    }).then(function (results) {
      $(target).removeClass('loading');
      if (!results || !results.entries) {
        return;
      }

      Fliplet.Analytics.trackEvent({
        category: 'notification_inbox',
        action: 'load_more',
        value: results.entries.length
      });

      if (!results.entries.length) {
        $loadMore.remove();
        $loadMore = null;
        return;
      }

      results.entries.forEach(function (notification) {
        processNotification(notification, {
          forceRender: true
        });
      });
    }).catch(function (err) {
      $(target).removeClass('loading');
      Fliplet.UI.Toast.error(err, {
        message: 'Error loading notifications'
      });
    });
  }

  function parseNotificationAction(id) {
    var notification = _.find(notifications, { id: id });
    if (!notification || !_.has(notification, 'data.navigate')) {
      return;
    }

    var navigate = notification.data.navigate;
    Fliplet.Navigate.to(navigate).catch(function (err) {
      console.warn('Error processing notification action', err);
    });
  }

  function noNotificationsFound() {
    $('.notifications').html(Fliplet.Widget.Templates['templates.noNotifications']());
    updateUnreadCount(0);
  }

  function attachObservers() {
    Fliplet.Hooks.on('notificationFirstResponse', function (err, notifications) {
      if (err) {
        $('.notifications').html(Fliplet.Widget.Templates['templates.notificationsError']());
        Fliplet.UI.Toast.error(err, {
          message: 'Error loading notifications'
        });
        return;
      }

      if (!_.filter(notifications, { deletedAt: null }).length) {
        noNotificationsFound();
      }
    });
    Fliplet.Hooks.on('notificationStream', processNotification);

    Fliplet.Hooks.on('notificationCountsUpdated', function (data) {
      updateUnreadCount(data.unreadCount);
    });

    $container
      .on('click', '.notification[data-notification-id]', function () {
        var id = $(this).data('notificationId');
        Fliplet.Analytics.trackEvent({
          category: 'notification_inbox',
          action: 'notification_open'
        });
        markAsRead(id).then(function () {
          parseNotificationAction(id);
        }).catch(function (err) {
          console.warn(err);
          parseNotificationAction(id);
        });
      })
      .on('click', '[data-read-all]', function (e) {
        e.preventDefault();
        Fliplet.Analytics.trackEvent({
          category: 'notification_inbox',
          action: 'notification_read_all'
        });
        markAllAsRead();
      })
      .on('click', '[data-load-more]', function (e) {
        e.preventDefault();
        loadMore(this);
      })
      .on('click', '.notifications-new', function (e) {
        e.preventDefault();
        addNewNotifications();
      })
      .on('click', '[data-settings]', function () {
        Fliplet.Analytics.trackEvent({
          category: 'notification_inbox',
          action: 'push_notification_info'
        });

        Fliplet.User.getSubscriptionId().then(function (id) {
          var actions = [];

          if (!id) {
            actions.push({
              label: 'Subscribe',
              action: function () {
                Fliplet.Analytics.trackEvent({
                  category: 'notification_inbox',
                  action: 'push_notification_subscribe'
                });

                var pushWidget = Fliplet.Widget.get('PushNotifications');

                if (!pushWidget) {
                  return;
                }

                pushWidget.ask().then(function (subscriptionId) {
                  Fliplet.UI.Toast({
                    type: 'regular',
                    title: 'Subscribed to push notifications',
                    message: 'Subscription ID: ' + subscriptionId,
                    actions: [{ label: 'OK' }]
                  });
                }).catch(function (error) {
                  Fliplet.UI.Toast.error(error, {
                    message: 'Error subscribing to push notifications'
                  });
                });
              }
            });
          }

          Fliplet.UI.Toast({
            type: 'regular',
            title: 'Push notifications',
            message: id ? 'Subscription ID: ' + id : 'Subscribe to receive push notifications',
            actions: actions
          });
        })
      });
  }

  function init() {
    moment.updateLocale('en', {
      calendar : {
        sameElse: 'MMMM Do YYYY'
      }
    });

    appNotifications = Fliplet.Widget.get('Notifications');
    if (appNotifications) {
      // Initializa Notifications app component
      appNotifications.init({
        clearNewCountOnUpdate: true,
        startCheckingUpdates: true
      });
    }
  }

  attachObservers();

  return {
    init: init
  };
});