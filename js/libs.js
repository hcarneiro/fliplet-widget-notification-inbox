Fliplet.Registry.set('notification-inbox:1.0:core', function (element, data) {

  var BATCH_SIZE = 20;

  var $container = $(element);
  var $notifications = $container.find('.notifications');

  var notifications = [];
  var $loadMore = $([]);
  var appNotifications;
  var isLastNotificationLoaded = false;

  function isUnread(n) {
    return !n.readStatus;
  }

  function getUnreadCountFromUI() {
    return Math.max(0, parseInt($('.unread-count').text(), 10) || 0);
  }

  function checkForUpdates() {
    if (!appNotifications) {
      return Promise.reject('Notifications add-on is not configured');
    }

    return appNotifications.checkForUpdates({
      forcePolling: true
    });
  }

  function getNotificationRender(notification) {
    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notification']());

    notification.hasLink = _.has(notification, 'data.navigate');
    return tpl(notification);
  }

  function addNotification(notification, options) {
    options = options || {};

    var html = getNotificationRender(notification);
    var index = -1;

    notifications.push(notification);
    notifications = _.orderBy(notifications, ['orderAt'], ['desc']);
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

    if (options.addLoadMore && !$loadMore.length && !isLastNotificationLoaded) {
      $loadMore = $(Fliplet.Widget.Templates['templates.loadMore']());
      $notifications.after($loadMore);
    }

    Fliplet.Studio.emit('get-selected-widget');
  }

  function updateNotification(notification) {
    var html = getNotificationRender(notification);
    var index = _.findIndex(notifications, { id: notification.id });

    if (index < 0) {
      addNotification(notification);
      return;
    }

    notifications[index] = notification;
    $('[data-notification-id="' + notification.id + '"]').replaceWith(html);
    Fliplet.Studio.emit('get-selected-widget');
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
    Fliplet.Studio.emit('get-selected-widget');

    if (!notifications.length) {
      noNotificationsFound();
    }
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

  function processNotification(notification) {
    if (notification.isLastNotification) {
      isLastNotificationLoaded = true;
      $loadMore.remove();
      $loadMore = $([]);
    }

    if (notification.status === 'draft') {
      return;
    }

    if (notification.isDeleted) {
      deleteNotification(notification);
    } else if (notification.isUpdate) {
      updateNotification(notification);
    } else {
      addNotification(notification, {
        addLoadMore: true
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
        Fliplet.UI.Toast.error(err, {
          message: 'Error marking notifications as read'
        });
      });
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
        isLastNotificationLoaded = true;
        $loadMore.remove();
        $loadMore = $([]);
        return;
      }

      results.entries.forEach(function (notification) {
        processNotification(notification);
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
    Fliplet.Studio.emit('get-selected-widget');
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
        if (Fliplet.Env.get('preview')) {
          initDemo();
          return;
        }

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
      .on('click', '[data-settings]', function () {
        Fliplet.Analytics.trackEvent({
          category: 'notification_inbox',
          action: 'notification_settings'
        });

        if (_.hasIn(Fliplet, 'Notifications.Settings.open')) {
          return Fliplet.Notifications.Settings.open();
        }

        Fliplet.App.About.open();
      })
      .on('click', '[data-refresh]', function () {
        var $target = $(this);

        $target.addClass('fa-spin');
        return checkForUpdates().then(function () {
          $target.removeClass('fa-spin');
        }).catch(function (error) {
          $target.removeClass('fa-spin');
          Fliplet.UI.Toast.error(error, {
            message: 'Notification refresh failed'
          });
        });
      });
  }

  function initDemo() {
    var options = {
      notifications: [{
        data: {
          title: 'Reminder',
          message: 'You need to submit your full year review by tomorrow 2PM. Please speak to your manager if you have any questions.'
        },
        orderAt: moment().subtract(1, 'days').add(2, 'hours').valueOf()
      }, {
        data: {
          title: 'Automated message',
          message: 'It has been 14 days since you last emailed your pipeline contacts.'
        },
        orderAt: moment().subtract(8, 'days').valueOf()
      }, {
        data: {
          title: 'Excellence in Marketing',
          message: 'We have been awarded the prestigious "Excellent in Marketing" award by the National Marketing Association.'
        },
        orderAt: moment().subtract(1, 'month').valueOf()
      }]
    };

    Fliplet.Hooks.run('beforeShowDemoNotifications', options).then(function () {
      $container.addClass('demo');
      _.forEach(options.notifications, function (notification, i) {
        notification.id = i + 1;

        if (i === 0) {
          notification.isLastNotification = true;
        }

        processNotification(notification);
      });
    });
  }

  function init(options) {
    options = options || {};

    Fliplet.Studio.emit('get-selected-widget');

    moment.updateLocale('en', {
      calendar : {
        sameElse: 'MMMM Do YYYY'
      }
    });

    if (options.mode === 'demo') {
      initDemo();
      return;
    }

    // Prompt user to enable notification or subscribe for push notification in the background
    var pushWidget = Fliplet.Widget.get('PushNotifications');

    if (pushWidget) {
      pushWidget.ask();
    }
  }

  Fliplet.Hooks.on('afterNotificationsInit', function (instance) {
    appNotifications = instance;
  });

  attachObservers();

  return {
    init: init
  };
});
