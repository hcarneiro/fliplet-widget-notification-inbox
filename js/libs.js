Fliplet.Registry.set('fliplet-viewer-notification-inbox:1.0:core', function(element) {
  var BATCH_SIZE = 20;
  var $container = $(element);
  var $notifications = $container.find('.notifications');
  var notifications = [];
  var $loadMore = $([]);
  var isLastNotificationLoaded = false;
  var notificationTags = {
    pricingLimitation: ['App limit'],
    organizationLimitation: ['Organization limit'],
    onboarding: ['Onboarding'],
    promotion: ['Promotion']
  };

  function getUserNotifications(options) {
    options = options || {};

    return Fliplet.API.request({
      method: 'GET',
      url: 'v1/user/notifications',
      data: {
        limit: options.limit || BATCH_SIZE,
        offset: options.offset || notifications.length,
        where: options.where ? JSON.stringify(options.where) : undefined
      }
    });
  }

  function markNotificationsAsRead(ids) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    return Fliplet.API.request({
      method: 'POST',
      url: 'v1/user/notifications/mark-as-read',
      data: {
        notificationIds: ids
      }
    })
      .then(function() {
        // Update local notifications
        notifications = _.map(notifications, function(notification) {
          if (!!notification.readAt) {
            return notification;
          }

          notification.readAt = new Date();

          return notification;
        });

        return notifications;
      });
  }

  function checkForUpdates() {
    var $target = $('[data-refresh]');

    $target.addClass('fa-spin');

    return getUserNotifications({
      limit: BATCH_SIZE,
      offset: notifications.length
    })
      .then(function(results) {
        $target.removeClass('fa-spin');

        if (!results || !results.notifications) {
          return;
        }

        Fliplet.Analytics.trackEvent({
          category: 'fv_notification_inbox',
          action: 'fv_check_updates',
          value: results.notifications.length
        });

        if (!results.notifications.length) {
          return;
        }

        results.notifications.forEach(function(notification) {
          processNotification(notification);
        });

        updateUnreadCount();
      })
      .catch(function(error) {
        $target.removeClass('fa-spin');

        Fliplet.UI.Toast.error(error, {
          message: T('widgets.notificationInbox.errors.refreshingFailed')
        });
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
    var index = _.findIndex(notifications, { id: notification.id });

    if (index > -1) {
      updateNotification(notification);

      return;
    }

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

  function deleteNotification(notification) {
    _.remove(notifications, function(n) {
      return n.id === notification.id;
    });

    $('[data-notification-id="' + notification.id + '"]').remove();

    Fliplet.Studio.emit('get-selected-widget');

    if (!notifications.length) {
      noNotificationsFound();
    }
  }

  function updateUnreadCount() {
    var unreadNotifications = _.filter(notifications, function(notification) {
      return !notification.deletedAt && !notification.readAt;
    });
    var count = unreadNotifications.length;

    if (!count || typeof count !== 'number') {
      $container.removeClass('notifications-has-unread');
      $container.find('.notifications-toolbar').html(Fliplet.Widget.Templates['templates.toolbar.empty']());

      return;
    }

    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.toolbar']());
    var html = tpl({
      count: Math.max(0, count)
    });

    $container.addClass('notifications-has-unread');
    $container.find('.notifications-toolbar').html(html);

    // Update app badge
    Fliplet.Navigator.Notifications.setAppBadge(count);
  }

  function calculatePercentage(data) {
    data = data || {};

    var currentValue = data.value || 0;
    var limit = data.threshold || 0;

    return Math.round((currentValue / limit) * 100);
  }

  function processNotification(notification) {
    if (notification.status === 'draft') {
      return;
    }

    var source = notification.data.source;

    if (source) {
      notification.data.tags = _.uniq(_.concat(source, notification.data.tags || []));
    }

    notification.data.tags = _.map(notification.data.tags, function(tag) {
      var type = 'info';
      var name = tag;

      if (tag === 'pricingLimitation') {
        var percentage = calculatePercentage(notification.data);

        name = notificationTags[source];
        type = percentage >= 100 ? 'danger' : 'warning';
      }

      return {
        name: name,
        type: type
      }
    });

    if (notification.deletedAt) {
      deleteNotification(notification);
    } else if (notification.updatedAt !== notification.createdAt) {
      updateNotification(notification);
    } else {
      addNotification(notification, {
        addLoadMore: true
      });
    }

    Fliplet.Studio.emit('get-selected-widget');
  }

  function removeUnreadMarkers(ids) {
    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    var selector = _.map(ids, function(id) {
      return '[data-notification-id="' + id + '"]';
    }).join(',');

    // Update rendered notifications
    $notifications.find(selector).removeClass('notification-unread').addClass('notification-read');

    updateUnreadCount();
  }

  function markAsRead(ids) {
    var arr = [];

    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    ids = _.uniq(_.compact(ids));

    _.forEach(notifications, function(n) {
      if (ids.indexOf(n.id) < 0) {
        return;
      }

      arr.push(n.id);
    });

    return markNotificationsAsRead(arr);
  }

  function markAllUIAsRead() {
    // Update rendered notifications
    $notifications
      .find('.notification-unread').removeClass('notification-unread').addClass('notification-read');

    updateUnreadCount();
  }

  function markAllAsRead() {
    var notificationIds = _.map(notifications, function(n) {
      return n.id;
    });

    return markAsRead(notificationIds)
      .then(markAllUIAsRead)
      .catch(function(err) {
        Fliplet.UI.Toast.error(err, {
          message: 'Error marking notifications as read'
        });
      });
  }

  function loadMore(target) {
    var $target = $(target).addClass('loading');

    getUserNotifications({
      offset: notifications.length
    })
      .then(function(results) {
        $target.removeClass('loading');

        if (!results || !results.notifications) {
          return;
        }

        Fliplet.Analytics.trackEvent({
          category: 'fv_notification_inbox',
          action: 'fv_load_more',
          value: results.notifications.length
        });

        if (!results.notifications.length) {
          isLastNotificationLoaded = true;
          $loadMore.remove();
          $loadMore = $([]);

          return;
        }

        results.notifications.forEach(function(notification) {
          processNotification(notification);
        });
      })
      .catch(function(err) {
        $target.removeClass('loading');
        Fliplet.UI.Toast.error(err, {
          message: 'Error loading notifications'
        });
      });
  }

  function parseNotificationAction(id) {
    var notification = _.find(notifications, { id: id });

    if (notification && _.has(notification, 'data.navigate')) {
      var navigate = notification.data.navigate;

      Fliplet.Navigate.to(navigate);

      return;
    }

    // Tell user to use Fliplet Studio to open this notification's URL
    Fliplet.UI.Toast({
      type: 'regular',
      position: 'top',
      title: 'Opening a notification',
      message: 'To open this notification\'s URL, please use Fliplet Studio and by clicking the bell icon in the top bar.'
    });
  }

  function noNotificationsFound() {
    $('.notifications').html(Fliplet.Widget.Templates['templates.noNotifications']());

    updateUnreadCount();

    Fliplet.Studio.emit('get-selected-widget');
  }

  function attachObservers() {
    $container
      .on('click', '.notification[data-notification-id]', function() {
        var id = $(this).data('notificationId');

        Fliplet.Analytics.trackEvent({
          category: 'fv_notification_inbox',
          action: 'fv_notification_open'
        });

        markAsRead(id)
          .then(function() {
            removeUnreadMarkers(id);
            parseNotificationAction(id);
          })
          .catch(function() {
            parseNotificationAction(id);
          });
      })
      .on('click', '[data-read-all]', function(e) {
        e.preventDefault();

        Fliplet.Analytics.trackEvent({
          category: 'fv_notification_inbox',
          action: 'fv_notification_read_all'
        });

        markAllAsRead();
      })
      .on('click', '[data-load-more]', function(e) {
        e.preventDefault();

        loadMore(this);
      })
      .on('click', '[data-settings]', function() {
        Fliplet.Analytics.trackEvent({
          category: 'fv_notification_inbox',
          action: 'fv_notification_settings'
        });

        if (_.hasIn(Fliplet, 'Notifications.Settings.open')) {
          return Fliplet.Notifications.Settings.open();
        }

        Fliplet.App.About.open();
      })
      .on('click', '[data-refresh]', function() {
        checkForUpdates();
      });
  }

  function init() {
    moment.updateLocale('en', {
      calendar: {
        sameElse: 'MMMM Do YYYY'
      }
    });

    // Prompt user to enable notification or subscribe for push notification in the background
    var pushWidget = Fliplet.Widget.get('PushNotifications');

    if (pushWidget) {
      pushWidget.ask();
    }

    // Initialize notifications
    getUserNotifications()
      .then(function(results) {
        var newNotifications = results && results.notifications || [];

        Fliplet.Analytics.trackEvent({
          category: 'fv_notification_inbox',
          action: 'fv_init',
          value: newNotifications.length
        });

        // Show "No notifications found" UI if there's no new or existing notifications
        if (!_.filter(newNotifications, function(notification) {
          return !notification.deletedAt && notification.status !== 'draft';
        }).length && !notifications.length) {
          noNotificationsFound();

          return;
        }

        newNotifications.forEach(function(notification) {
          processNotification(notification);
        });

        updateUnreadCount();
      })
      .catch(function(error) {
        $('.notifications').html(Fliplet.Widget.Templates['templates.notificationsError']());

        Fliplet.UI.Toast.error(error, {
          message: 'Error loading notifications'
        });
      });
  }

  attachObservers();

  return {
    init: init
  };
});
