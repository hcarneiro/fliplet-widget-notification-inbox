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

  function deleteNotification(notification) {
    _.remove(notifications, function(n) {
      return n.id === notification.id;
    });
    $('[data-notification-id="' + notification.id + '"]').remove();

    if (!notification.readStatus) {
      updateUnreadCount(getUnreadCountFromUI() - 1);
    }
  }

  function removeUnreadCountToolbar() {
    $container.find('.notifications-toolbar').html('&nbsp;');
  }

  function updateUnreadCount(count) {
    if (!count) {
      removeUnreadCountToolbar();
      return;
    }

    $container[count ? 'addClass' : 'removeClass']('notifications-has-unread');
    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notifications.toolbar']());
    var html = tpl({
      count: count
    });

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

  function markAllAsRead() {
    return appNotifications.markAllAsRead()
      .then(function () {
        // Update rendered notifications
        $notifications.find('.notification-unread').removeClass('notification-unread').addClass('notification-read').find('.notification-badge').remove();

        // Update unread count
        updateUnreadCount(0);
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
    if (appNotifications.isPolling()) {
      return;
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
      var actions = [];
      var message = Fliplet.parseError(err);
      if (message) {
        actions.push({
          label: 'Detail',
          action: function () {
            Fliplet.UI.Toast({
              message: message
            });
          }
        });
      }
      Fliplet.UI.Toast({
        message: 'Error loading notifications',
        actions: actions
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
        var message = Fliplet.parseError(err);
        var actions = [];
        $('.notifications').html(Fliplet.Widget.Templates['templates.notificationsError']());

        if (message) {
          actions.push({
            label: 'Detail',
            action: function () {
              Fliplet.UI.Toast({
                message: message
              });
            }
          });
        }

        Fliplet.UI.Toast({
          message: 'Error loading notifications',
          actions: actions
        });
        return;
      }

      if (!notifications.length) {
        noNotificationsFound();
      }
    });
    Fliplet.Hooks.on('notificationStream', processNotification);

    Fliplet.Hooks.on('notificationCountsUpdated', function (data) {
      updateUnreadCount(data.unreadCount);
    });

    $container
      .on('click', '.notification.notification-unread[data-notification-id]', function () {
        var id = $(this).data('notificationId');
        markAsRead(id);
        parseNotificationAction(id);
      })
      .on('click', '[data-read-all]', function (e) {
        e.preventDefault();
        markAllAsRead();
      })
      .on('click', '[data-load-more]', function (e) {
        e.preventDefault();
        loadMore(this);
      })
      .on('click', '.notifications-new', function (e) {
        e.preventDefault();
        addNewNotifications();
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