Fliplet.Registry.set('notification-inbox:1.0:core', function (element, data) {

  var BATCH_SIZE = 20;
  var $container = $(element);

  var instance = Fliplet.Notifications.init({
    batchSize: BATCH_SIZE,
    onFirstResponse: function (err, notifications) {
      if (err) {
        // @TODO Error loading data
        return;
      }

      if (!notifications.length) {
        // @TODO No notifications found
      }
    }
  });
  var notifications = [];
  var newNotifications = [];
  var unreadCount = 0;
  var $loadMore;

  var update;

  function hasNotifications() {
    return !!$container.find('.notifications .notification').length;
  }

  function addNotification(notification, options) {
    options = options || {};

    if (notification.id === 3) {
      update = notification;
    }

    if (!notification.isFirstBatch && !options.forceAdd) {
      newNotifications.push(notification);
      if ($('.yes').length) {
        return;
      }

      $container.append(Fliplet.Widget.Templates['templates.newNotifications']());
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
      $container.find('.notifications').html(html);
    } else if (index === 0) {
      // Notification goes to the beginning
      $container.find('.notifications').prepend(html);
    } else if (index === notifications.length - 1) {
      // Notification goes to the end
      $container.find('.notifications').append(html);
    } else {
      // Notification goes to the middle acc. index
      $container.find('.notifications .notification').eq(index).before(html);
    }

    if (options.addLoadMore && !$('.load-more').length) {
      $loadMore = $(Fliplet.Widget.Templates['templates.loadMore']());
      $container.find('.notifications').after($loadMore);
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

  function updateUnreadCount() {
    unreadCount = _.filter(notifications, function (n) {
      return !n.readStatus;
    }).length;
    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notifications.toolbar']());
    var html = tpl({
      count: unreadCount
    });
    $container.find('.notifications-toolbar').html(html);
    $container[unreadCount ? 'addClass' : 'removeClass']('notifications-has-unread');
  }

  function processNotification(notification) {
    if (notification.isDeleted) {
      deleteNotification(notification);
    } else if (notification.isUpdate) {
      updateNotification(notification);
    } else {
      addNotification(notification, {
        addLoadMore: true
      });
    }

    updateUnreadCount();
  }

  function markAsRead(ids) {
    if (!Array.isArray(ids)) {
      ids = _.compact([ids]);
    }
    return instance.markNotificationsAsRead(ids);
  }

  function markAllAsRead() {
    return instance.markNotificationsAsRead('all');
  }

  function addNewNotifications() {
    while (newNotifications.length) {
      notification = newNotifications.shift();
      addNotification(notification, {
        forceAdd: true
      });
    }
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
          $lt: _.findLast(notifications).createdAt
        }
      }
    }).then(function (notifications) {
      $(target).removeClass('loading');
      if (!notifications.length) {
        $loadMore.remove();
      }
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

  function attachObservers() {
    $container
      .on('click', '.notification[data-notification-id]', function () {
        markAsRead($(this).data('notificationId'));
      })
      .on('click', '[data-read-all]', function (e) {
        e.preventDefault();
        markAllAsRead();
      })
      .on('click', '[data-load-more]', function (e) {
        e.preventDefault();
        loadMore(this);
      })
      .on('click', '.yes', function (e) {
        e.preventDefault();
        addNewNotifications();
      });
  }

  attachObservers();
  instance.stream(processNotification);

  return {};
});