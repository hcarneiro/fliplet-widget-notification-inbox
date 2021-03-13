Fliplet.Registry.set('notification-inbox:1.0:app:core', function(data) {
  var BATCH_SIZE = 20;

  var storageKey = 'flAppNotifications';
  var storage;
  var instance;
  var clearNewCountOnUpdate = false;
  var timer;
  var instanceReady;
  var instancePromise = new Promise(function(resolve) {
    instanceReady = resolve;
  });

  function saveCounts(data) {
    data = data || {};

    storage.updatedAt = Date.now();

    if (clearNewCountOnUpdate || !storage.clearedAt) {
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

  function broadcastCountUpdates() {
    Fliplet.Hooks.run('notificationCountsUpdated', storage);
  }

  function isPolling() {
    return instance.isPolling();
  }

  function poll(options) {
    return instance.poll(options);
  }

  function getNewNotifications(ts) {
    return Promise.all([
      instance.unread.count({ createdAt: { $gt: ts } }),
      instance.unread.count()
    ]);
  }

  function checkForUpdates(ts, opt) {
    var countsUpdated = false;

    if (typeof ts === 'object') {
      opt = ts;
      ts = Date.now();
    }

    ts = ts || Date.now();
    opt = opt || {};

    return getNewNotifications(ts)
      .then(function(counts) {
        var data = {
          updatedAt: Date.now(),
          unreadCount: counts[1],
          newCount: counts[0]
        };
        var comparisonProps = ['unreadCount', 'newCount'];

        countsUpdated = !_.isEqual(_.pick(data, comparisonProps), _.pick(storage, comparisonProps));

        if (clearNewCountOnUpdate) {
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
  }

  function getInstance() {
    return instancePromise.then(function() {
      return instance;
    });
  }

  function init(options) {
    options = options || {};

    clearNewCountOnUpdate = !!options.clearNewCountOnUpdate;

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

        instance.stream(function(notification) {
          Fliplet.Hooks.run('notificationStream', notification);
        });

        Fliplet().then(function() {
          setTimeout(function() {
            // Adding a timeout to allow page JS to modify page DOM first
            addNotificationBadges();
            broadcastCountUpdates();
            checkForUpdatesSinceLastClear();

            if (!storage.updatedAt || options.startCheckingUpdates) {
              setTimer(0);
            }
          }, 0);
        });
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
    addNotificationBadges: addNotificationBadges
  };
});
