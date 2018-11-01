Fliplet.Registry.set('notification-inbox:1.0:core', function (element, data) {

  var BATCH_SIZE = 2;

  var $container = $(element);
  var $notifications = $container.find('.notifications');
  var instance;

  var notifications = [];
  var newNotifications = [];
  var $loadMore;
  var appNotifications;

  function hasNotifications() {
    return !!$container.find('.notifications .notification').length;
  }

  function isUnread(n) {
    return !n.readStatus;
  }

  function addNotification(notification, options) {
    options = options || {};

    if (!notification.isFirstBatch && !options.forceRender) {
      newNotifications.push(notification);
      if ($('.notifications-new').length) {
        return;
      }

      $notifications.prepend(Fliplet.Widget.Templates['templates.newNotifications']());
      debugger;
      updateUnreadCount(_.filter(notifications, isUnread).length + _.filter(newNotifications, isUnread).length);
      return;
    }

    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notification']());
    var html = tpl(notification);
    var index = -1;

    notifications.push(notification);
    notifications = _.orderBy(notifications, ['createdAt'], ['desc']);
    index = _.findIndex(notifications, { id: notification.id });

    if (!hasNotifications()) {
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
  }

  function updateUnreadCount(count) {
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
    if (!Array.isArray(ids)) {
      ids = [ids];
    }
    ids = _.uniq(_.compact(ids));

    var arr = [];
    _.forEach(notifications, function (n) {
      if (ids.indexOf(n.id) < 0) {
        return;
      }

      arr.push(n);
    });
    var newUnreadCount = Math.max(0, parseInt($('.unread-count').text(), 10) - arr.length);

    return instance.markNotificationsAsRead(arr)
      .then(function () {
        var selector = _.map(arr, function (n) {
          return '[data-notification-id="' + n.id + '"]'
        }).join(',');;
        $notifications.find(selector).removeClass('notification-unread').addClass('notification-read').find('.notification-badge').remove();
        return appNotifications.saveUpdates({
          unreadCount: newUnreadCount
        });
      })
      .then(function () {
        updateUnreadCount(newUnreadCount);
      });
  }

  function markAllAsRead() {
    return instance.markNotificationsAsRead('all')
      .then(function () {
        $notifications.find('.notification-unread').removeClass('notification-unread').addClass('notification-read').find('.notification-badge').remove();
        return appNotifications.saveUpdates({
          unreadCount: 0,
          clearNewCount: true
        });        
      })
      .then(function () {
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
    if (instance.isPolling()) {
      return;
    }

    var $target = $(target).addClass('loading');

    return instance.poll({
      limit: BATCH_SIZE,
      where: {
        createdAt: {
          $lt: _.min(_.map(notifications, 'createdAt'))
        }
      },
      publishToStream: false
    }).then(function (notifications) {
      $(target).removeClass('loading');
      if (!notifications || !notifications.entries) {
        return;
      }

      if (!notifications.entries.length) {
        $loadMore.remove();
        $loadMore = null;
        return;
      }

      notifications.entries.forEach(function (notification) {
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

  function attachObservers() {
    Fliplet.Hooks.on('notificationsUpdated', function (data) {
      updateUnreadCount(data.unreadCount);
    });

    $container
      .on('click', '.notification[data-notification-id]', function () {
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

  function noNotificationsFound() {
    $('.notifications').html(Fliplet.Widget.Templates['templates.noNotifications']());
    $('.notifications-toolbar').remove();    
  }

  function init() {
    attachObservers();

    moment.updateLocale('en', {
      calendar : {
        sameElse: 'MMMM Do YYYY'
      }
    });

    appNotifications = Fliplet.Widget.get('Notifications');

    instance = Fliplet.Notifications.init({
      batchSize: BATCH_SIZE,
      onFirstResponse: function (err, notifications) {
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
      }
    });
    instance.stream(processNotification);
    instance.unread.count()
      .then(function (count) {
        updateUnreadCount(count);
        appNotifications.saveUpdates({
          unreadCount: count,
          newCount: 0
        });
      });
  }

  return {
    init: init
  };
});