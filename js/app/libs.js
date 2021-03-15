Fliplet.Registry.set('notification-inbox:1.0:app:core', function(data) {
  var BATCH_SIZE = 20;

  var storageKey = 'flAppNotifications';
  var storage;
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

    storage[countProp] = Math.max(0, parseInt(data[countProp], 10) || 0);

    // Update app badge
    Fliplet.Navigator.Notifications.setAppBadge(storage[countProp]);

    return Fliplet.App.Storage.set(storageKey, storage);
  }

  function markAsRead(notifications) {
    var affected;
    var unreadCount;

    return instance.markNotificationsAsRead(notifications)
      .then(function(results) {
        results = results || {};
        affected = results.affected || 0;

        return instance.unread.count();
      })
      .then(function(value) {
        unreadCount = value;

        return saveCounts({
          unreadCount: unreadCount,
          newCount: 0
        });
      })
      .then(function() {
        return Promise.resolve({
          affected: affected,
          unreadCount: unreadCount
        });
      });
  }

  function markAllAsRead() {
    var affected;

    return instance.markNotificationsAsRead('all')
      .then(function(results) {
        results = results || {};
        affected = results.affected || 0;

        return saveCounts({
          unreadCount: 0,
          newCount: 0
        });
      })
      .then(function() {
        return Promise.resolve({
          affected: affected,
          unreadCount: 0
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
          $badge.html(count);
        } else {
          $target.append('<div class="notification-badge">' + count + '</div>');
        }
      });
  }

  /**
   * Updates the session with the latest timestamp that the notifications were seen
   * @param {Object} options - A mapping of options for the function
   * @param {Number} options.seenAt - Timestamp in seconds. Defaults to current timestamp if falsey
   * @param {Boolean} options.force - If true, throttling is disabled
   * @returns {Promise} The promise resolves when the session data is updated, taking throttling into consideration
   */
  function setAppNotificationSeenAt(options) {
    function updateSession() {
      return Fliplet.Session.set(
        { appNotificationsSeenAt: options.seenAt },
        { required: true }
      );
    }

    options = options || {};

    // Default to current timestamp in seconds
    if (!options.seenAt) {
      options.seenAt = Math.floor(Date.now() / 1000);
    }

    // Update session immediately
    if (options.force) {
      return updateSession();
    }

    // Update appNotificationsSeenAt (throttled at 60 seconds)
    return Fliplet.Cache.get(
      {
        expire: 60,
        key: 'appNotificationsSeenAt'
      },
      updateSession
    );
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

  function getLatestNotificationCount(ts, options) {
    function fetchCount() {
      var query;

      if (notificationsBadgeType !== 'unread') {
        // New notification count is always reset to 0 when the page has an inbox
        if (pageHasInbox) {
          return Promise.resolve(0);
        }

        // @TODO Update to use instance.new.count()
        query = { createdAt: { $gt: ts } };
      }

      return instance.unread.count(query);
    }

    var now = Date.now();

    if (typeof ts === 'object') {
      options = ts;
      ts = now;
    }

    ts = ts || now;
    options = options || {};

    return Fliplet.Navigator.Notifications.getAppBadge().then(function(badgeNumber) {
      // App badge number has changed. Get the latest counts immediately.
      if ((typeof badgeNumber === 'number' && badgeNumber !== storage[countProp]) || options.force) {
        return fetchCount();
      }

      // Get notification counts (throttled at 60 seconds)
      return Fliplet.Cache.get({
        expire: 60,
        key: 'appNotificationCount'
      }, fetchCount);
    });
  }

  function checkForUpdates(ts, opt) {
    var countUpdated = false;
    var now = Date.now();

    if (typeof ts === 'object') {
      opt = ts;
      ts = now;
    }

    ts = ts || now;
    opt = opt || {};

    return getLatestNotificationCount(ts, opt)
      .then(function(count) {
        var data = {};

        data[countProp] = count;
        countUpdated = data[countProp] !== storage[countProp];

        return saveCounts(data);
      })
      .then(function(data) {
        addNotificationBadges(data[countProp]);
        broadcastCountUpdates();

        if (!countUpdated && !opt.force) {
          return Promise.resolve();
        }

        return poll();
      });
  }

  function checkForUpdatesSinceLastClear(options) {
    return checkForUpdates(storage.clearedAt || Date.now(), options);
  }

  function attachObservers() {
    Fliplet.Hooks.on('pushNotification', function() {
      checkForUpdatesSinceLastClear({ force: true });
    });

    // Check the latest notification count against badge when the app resumes into foreground
    document.addEventListener('resume', checkForUpdatesSinceLastClear, false);
  }

  function getInstance() {
    return instancePromise.then(function() {
      return instance;
    });
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

        instance = Fliplet.Notifications.init({
          batchSize: BATCH_SIZE,
          scope: data.scope,
          onFirstResponse: function(err, notifications) {
            Fliplet.Hooks.run('notificationFirstResponse', err, notifications);
          }
        });
        instanceReady();

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
    getLatestNotificationCount: getLatestNotificationCount
  };
});
