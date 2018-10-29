Fliplet.Registry.set('notification-inbox:1.0:core', function (element, data) {

  var BATCH_SIZE = 20;
  var $container = $(element);
  var src = {
    'yo': '<div class="yes">new available</div>'
  };

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
  var updates = [];
  var unreadCount = 0;

  function hasNotifications() {
    return !!$container.find('.notifications .notification').length
  }

  function addNotification(notification) {
    var tpl = Handlebars.compile(Fliplet.Widget.Templates['templates.notification']());
    var html = tpl(notification);
    var index = -1;
    notifications.push(notification);
    notifications = _.orderBy(notifications, ['createdAt'], ['desc']);

    if (!hasNotifications()) {
      // No notifications on the page
      $container.find('.notifications').html(html);
      return;
    }

    index = _.findIndex(notifications, { id: notification.id });

    if (index === 0) {
      $container.find('.notifications').prepend(html);
      return;
    } else if (index === notifications.length) {
      $container.find('.notifications').append(html);
    } else {
      $container.find('.notifications .notification').eq(index).before(html);
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

  function processNotification(notification, forceProcess) {
    if (!notification.isFirstBatch && !forceProcess) {
      updates.push(notification);
      if ($('.yes').length) {
        return;
      }

      $container.append(src.yo);
      return;
    }

    if (notification.isDeleted) {
      deleteNotification(notification);
    } else if (notification.isUpdate) {
      updateNotification(notification);
    } else {
      addNotification(notification);
    }

    updateUnreadCount();
  }

  function markAsRead(ids) {
    if (!Array.isArray(ids)) {
      ids = _.compact([ids]);
    }
    instance.markNotificationsAsRead(ids);
  }

  function markAllAsRead() {
    var ids = $('.notification.notification-unread[data-notification-id]').map(function () {
      return $(this).data('notificationId');
    });
    markAsRead(_.compact(ids));    
  }

  function applyUpdates() {
    while (updates.length) {
      update = updates.shift();
      processNotification(update, true);
    }
  }

  function loadMore() {
    if (instance.isPolling()) {
      return;
    }

    return instance.poll({
      limit: BATCH_SIZE,
      where: {
        createdAt: {
          $lt: _.findLast(notifications).createdAt
        }
      }
    }).then(function (notifications) {
      if (!notifications.length) {
        // @TODO No more to load
      }
    }).catch(function (err) {
      // @TODO Error polling for new
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
        loadMore();
      })
      .on('click', '.yes', function (e) {
        e.preventDefault();
        applyUpdates();
      });
  }

  attachObservers();
  instance.stream(processNotification);

  // Fliplet.Hooks.on('onNotificationUpdate', function (data) {
  //   parseUpdate(data);

  //   // Show 'new' UI
  //   if ($('.yes').length) {
  //     return;
  //   }

  //   var html = tpl['yo']();
  //   $container.find('.notifications').append(html);
  //   $('.yes').on('click', function (e) {
  //     e.preventDefault();
  //     var html = tpl['notifications'](data.notifications);
  //     $('.items-holder').append(html);
  //     $('.yes').remove();
  //   });
  // });

  return {
    bar: function () {
      // A public function
    }
  }
});