Fliplet.Registry.set('notification-inbox:1.0:app:core', function(data) {
  var BATCH_SIZE = 20;

  var storageKey = 'flAppNotifications';
  var storage;
  var pushNotificationStorageKey = 'flPushNotificationPayload';
  var instance;
  var instanceReady;
  var instancePromise = new Promise(function(resolve) {
    instanceReady = resolve;
  });
  var pageHasInbox = !!Fliplet.Registry.get('notification-inbox:1.0:core');
  var notificationsBadgeType = Fliplet.Env.get('appSettings').notificationsBadgeType;

  if (['unread', 'new'].indexOf(notificationsBadgeType) < 0) {
    notificationsBadgeType = 'new';
  }

  var countProp = notificationsBadgeType + 'Count';

  function saveCounts(data) {
    data = data || {};

    var now = Date.now();

    storage.updatedAt = now;

    if (pageHasInbox || !storage.clearedAt) {
      storage.clearedAt = now;
    }

    if (typeof data.unreadCount !== 'undefined') {
      storage.unreadCount = Math.max(0, parseInt(data.unreadCount, 10) || 0);
    }

    if (typeof data.newCount !== 'undefined') {
      storage.newCount = Math.max(
        0,
        Math.min(storage.unreadCount, parseInt(data.newCount, 10) || 0)
      );
    }

    // Update app badge
    Fliplet.Navigator.Notifications.setAppBadge(storage[countProp]);

    return Fliplet.App.Storage.set(storageKey, storage);
  }

  function markAsRead(notifications) {
    var affected;
    var unreadCount;

    notifications = _.map(notifications, function(notification) {
      if (typeof notification === 'number') {
        notification = { id: notification };
      }

      return notification;
    });

    return instance.markNotificationsAsRead(notifications)
      .then(function(results) {
        // Get the latest unread counts after a notification is read outside of the inbox
        if (!pageHasInbox) {
          return checkForUpdatesSinceLastClear({ force: true });
        }

        results = results || {};
        affected = results.affected || 0;

        unreadCount = Math.max(0, storage.unreadCount - affected);

        // Update the notification count cache
        return Fliplet.Cache.set('appNotificationCount', [0, unreadCount])
          .then(function() {
            return saveCounts({
              newCount: 0,
              unreadCount: unreadCount
            });
          })
          .then(function() {
            addNotificationBadges();
            broadcastCountUpdates();

            var data = {
              affected: affected,
              unreadCount: unreadCount,
              ids: _.map(notifications, 'id')
            };

            Fliplet.Hooks.run('notificationRead', data);

            return data;
          });
      });
  }

  function markAllAsRead() {
    var affected;

    return instance.markNotificationsAsRead('all')
      .then(function(results) {
        results = results || {};
        affected = results.affected || 0;

        return Fliplet.Cache.set('appNotificationCount', [0, 0])
          .then(function() {
            return saveCounts({
              unreadCount: 0,
              newCount: 0
            });
          })
          .then(function() {
            addNotificationBadges();
            broadcastCountUpdates();

            return {
              affected: affected,
              unreadCount: 0
            };
          });
      });
  }

  function addNotificationBadges(count) {
    if (typeof count === 'undefined') {
      count = storage[countProp];
    }

    count = parseInt(count, 10);

    if (isNaN(count) || count <= 0) {
      $('.add-notification-badge')
        .removeClass('has-notification-badge')
        .find('.notification-badge').remove();

      return;
    }

    $('.add-notification-badge')
      .addClass('has-notification-badge')
      .each(function() {
        var $target = $(this);
        var $badge = $target.find('.notification-badge');

        if ($badge.length) {
          $badge.html(TN(count));
        } else {
          $target.append('<div class="notification-badge">' + TN(count) + '</div>');
        }
      });
  }

  /**
   * Updates the session with the latest timestamp that the notifications were seen
   * @param {Object} options - A mapping of options for the function
   * @param {Number} options.seenAt - UNIX timestamp in seconds. Defaults to current timestamp if falsy
   * @param {Boolean} options.force - If true, throttling is disabled
   * @returns {Promise} The promise resolves when the session data is updated, taking throttling into consideration
   */
  function setAppNotificationSeenAt(options) {
    options = options || {};

    // Default to current timestamp in seconds
    if (!options.seenAt) {
      options.seenAt = Math.floor(Date.now() / 1000);
    }

    // Update appNotificationsSeenAt (throttled at 60 seconds)
    return Fliplet.Cache.get({
      expire: 60,
      key: 'appNotificationsSeenAt',
      forceBackgroundUpdate: options.force
    }, function updateSession() {
      return Fliplet.Session.set(
        { appNotificationsSeenAt: options.seenAt },
        { required: true }
      );
    });
  }

  function broadcastCountUpdates() {
    Fliplet.Hooks.run('notificationCountsUpdated', storage);
  }

  function isPolling() {
    return instance.isPolling();
  }

  function poll(options) {
    return instance.poll(options);
  }

  function getLatestNotificationCounts(lastClearedAt, options) {
    var now = Date.now();

    if (typeof lastClearedAt === 'object') {
      options = lastClearedAt;
      lastClearedAt = now;
    }

    lastClearedAt = lastClearedAt || now;
    options = options || {};

    return Fliplet.Navigator.Notifications.getAppBadge().then(function(badgeNumber) {
      var forceFetch;

      // App badge number has changed. Get the latest counts immediately.
      if ((typeof badgeNumber === 'number' && badgeNumber !== storage[countProp]) || options.force) {
        forceFetch = true;
      }

      // Get notification counts (throttled at 20 seconds)
      return Fliplet.Cache.get({
        expire: 20,
        key: 'appNotificationCount',
        forceBackgroundUpdate: forceFetch
      }, function fetchCounts() {
        var getNewCount = pageHasInbox
          ? Promise.resolve(0)
          : instance.unread.count({ createdAt: { $gt: lastClearedAt } });

        return Promise.all([
          getNewCount,
          instance.unread.count()
        ]);
      });
    });
  }

  function checkForUpdates(ts, opt) {
    var now = Date.now();

    if (typeof ts === 'object') {
      opt = ts;
      ts = now;
    }

    ts = ts || now;
    opt = opt || {};

    return getLatestNotificationCounts(ts, opt)
      .then(function(counts) {
        var data = {
          newCount: counts[0],
          unreadCount: counts[1]
        };

        return saveCounts(data);
      })
      .then(function(data) {
        addNotificationBadges(data[countProp]);
        broadcastCountUpdates();

        // Poll for more notifications if the page contains the inbox,
        // regardless of whether the new/unread counts are updated
        // because notifications could be marked as read immediately
        // from opening push notifications
        if (pageHasInbox) {
          return poll().then(function() {
            setAppNotificationSeenAt({ force: true });
          });
        }
      });
  }

  function checkForUpdatesSinceLastClear(options) {
    return checkForUpdates(storage.clearedAt || Date.now(), options);
  }

  function attachObservers() {
    // Push notification received
    Fliplet.Hooks.on('pushNotification', function() {
      checkForUpdatesSinceLastClear({ force: true });
    });

    // Push notification opened
    Fliplet.Hooks.on('pushNotificationOpen', function(data) {
      return handlePushNotificationPayload(data);
    });

    // Check the latest notification count against badge when the app resumes into foreground
    document.addEventListener('resume', function() {
      // Wait for connection to return
      setTimeout(checkForUpdatesSinceLastClear, 0);
    }, false);

    // Check for updates when device comes back online
    Fliplet.Navigator.onOnline(checkForUpdatesSinceLastClear);
  }

  function getInstance() {
    return instancePromise.then(function() {
      return instance;
    });
  }

  /**
   * Process payload from push notifications to mark app notification as read or store for later
   * @param {Object} payload - Payload
   * @param {Boolean} fromStorage - If true, the payload is accessed from storage instead of directly from notification
   * @returns {undefined}
   */
  function handlePushNotificationPayload(payload, fromStorage) {
    if (typeof payload !== 'object') {
      return;
    }

    var payloadPage = parseInt(payload.page, 10);
    var openCurrentPage = payload.action === 'screen'
      && [Fliplet.Env.get('pageId'), Fliplet.Env.get('pageMasterId')].indexOf(payloadPage) > -1
      && fromStorage;

    // Payload loaded from storage. Clear the storage.
    if (fromStorage) {
      Fliplet.Storage.remove(pushNotificationStorageKey);
    }

    if (['screen', 'url', 'popup'].indexOf(payload.action) === -1
      || (payload.action === 'url' && Fliplet.Navigator.isOnline())) {
      markAsRead([payload.appNotificationId]);
    } else if (openCurrentPage || payload.action === 'popup') {
      setTimeout(function() {
        markAsRead([payload.appNotificationId]);
      }, 1000); // Give time for any redirects to occur
    } else if (payload.action === 'screen' && !fromStorage) {
      // Notification is taking the user to another page
      // Save the notification payload into storage for another page to process
      return Fliplet.Storage.set(pushNotificationStorageKey, payload);
    }
  }

  function init() {
    var defaults = {
      newCount: 0,
      unreadCount: 0
    };

    return Fliplet.App.Storage.get(storageKey, {
      defaults: defaults
    })
      .then(function(value) {
        storage = value;

        // Check if any notification was opened through push notification
        return Fliplet.Storage.get(pushNotificationStorageKey);
      })
      .then(function(payload) {
        instance = Fliplet.Notifications.init({
          batchSize: BATCH_SIZE,
          scope: data.scope,
          onFirstResponse: function(err, notifications) {
            Fliplet.Hooks.run('notificationFirstResponse', err, notifications);
          }
        });
        instanceReady();

        // Mark app notification as read if necessary
        handlePushNotificationPayload(payload, true);

        // Stream notifications if there's an inbox in the screen
        if (pageHasInbox) {
          instance.stream(function(notification) {
            Fliplet.Hooks.run('notificationStream', notification);
          });
        }

        // Fliplet() is used to allow custom code to add .add-notification-badge to elements before running addNotificationBadges()
        Fliplet().then(function() {
          // Adding a timeout to allow page JS to modify page DOM first
          setTimeout(function() {
            if (!pageHasInbox && !$('.add-notification-badge').length) {
              return;
            }

            addNotificationBadges();
            broadcastCountUpdates();
            checkForUpdatesSinceLastClear({ force: pageHasInbox });
          }, 0);
        });

        return storage;
      });
  }

  attachObservers();

  return {
    init: init,
    checkForUpdates: checkForUpdates,
    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead,
    isPolling: isPolling,
    poll: poll,
    getInstance: getInstance,
    addNotificationBadges: addNotificationBadges,
    setAppNotificationSeenAt: setAppNotificationSeenAt,
    getLatestNotificationCounts: getLatestNotificationCounts
  };
});
