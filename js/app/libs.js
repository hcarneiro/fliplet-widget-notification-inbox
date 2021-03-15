Fliplet.Registry.set('notification-inbox:1.0:app:core', function(data) {
  var BATCH_SIZE = 20;

  var storageKey = 'flAppNotifications';
  var storage;
  var instance;
  var timer;
  var instanceReady;
  var instancePromise = new Promise(function(resolve) {
    instanceReady = resolve;
  });
  var pageHasInbox = !!Fliplet.Registry.get('notification-inbox:1.0:core');
  var notificationsBadgeType = Fliplet.Env.get('appSettings').notificationsBadgeType;

  if (['unread', 'new'].indexOf(notificationsBadgeType) < 0) {
    notificationsBadgeType = 'new';
  }

  function saveCounts(data) {
    data = data || {};

    storage.updatedAt = Date.now();

    if (pageHasInbox || !storage.clearedAt) {
      storage.clearedAt = Date.now();
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

    switch (notificationsBadgeType) {
      case 'unread':
        if (typeof storage.unreadCount === 'number') {
          Fliplet.Navigator.Notifications.setBadgeNumber(storage.unreadCount);
        }

        break;
      case 'new':
      default:
        if (typeof storage.newCount === 'number') {
          Fliplet.Navigator.Notifications.setBadgeNumber(storage.newCount);
        }

        break;
    }

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

  function addNotificationBadges(options) {
    if (typeof options !== 'undefined' && !_.isObject(options)) {
      options = { count: options };
    }

    options = options || {};

    var count = options.count || storage.newCount;

    count = parseInt(count, 10);

    if (isNaN(count) || count <= 0) {
      $('.add-notification-badge')
        .removeClass('has-notification-badge')
        .find('.notification-badge').remove();

      return;
    }

    $('.add-notification-badge')
      .addClass('has-notification-badge')
      .find('.notification-badge').remove().end()
      .append('<div class="notification-badge">' + count + '</div>');
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

    // Update appNotificationsSeenAt immediately
    if (options.force) {
      return updateSession;
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

  function getLatestNotificationCounts(ts, options) {
    function fetchCounts() {
      return Promise.all([
        // @TODO Update to use instance.new.count()
        instance.unread.count({ createdAt: { $gt: ts } }),
        instance.unread.count()
      ]);
    }

    options = options || {};

    var countProp = notificationsBadgeType + 'Count';

    return Fliplet.Navigator.Notifications.getBadgeNumber().then(function(badgeNumber) {
      // App badge number has changed. Get the latest counts immediately.
      if ((typeof badgeNumber === 'number' && badgeNumber !== storage[countProp]) || options.forcePolling) {
        return fetchCounts;
      }

      // Get notification counts (throttled at 60 seconds)
      return Fliplet.Cache.get(
        {
          expire: 60,
          key: 'appNotificationsCounts'
        },
        fetchCounts
      );
    });
  }

  function checkForUpdates(ts, opt) {
    var countsUpdated = false;

    if (typeof ts === 'object') {
      opt = ts;
      ts = Date.now();
    }

    ts = ts || Date.now();
    opt = opt || {};

    return getLatestNotificationCounts(ts, opt)
      .then(function(counts) {
        var data = {
          updatedAt: Date.now(),
          unreadCount: counts[1],
          newCount: counts[0]
        };
        var comparisonProp = notificationsBadgeType + 'Count';

        countsUpdated = data[comparisonProp] !== storage[comparisonProp];

        if (pageHasInbox) {
          data.newCount = 0;
        }

        return saveCounts(data);
      })
      .then(addNotificationBadges)
      .then(broadcastCountUpdates)
      .then(function() {
        if (!countsUpdated && !opt.forcePolling) {
          return Promise.resolve();
        }

        return poll();
      });
  }

  function checkForUpdatesSinceLastClear() {
    return checkForUpdates(storage.clearedAt || Date.now());
  }

  function setTimer(ms) {
    if (typeof ms === 'undefined') {
      ms = 0;
    }

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }

    timer = setTimeout(checkForUpdatesSinceLastClear, ms);
  }

  function attachObservers() {
    Fliplet.Hooks.on('pushNotification', function() {
      setTimer(0);
    });

    // Check the latest notification count against badge when the app resumes into foreground
    document.addEventListener('resume', getLatestNotificationCounts, false);
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
            checkForUpdatesSinceLastClear();
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
