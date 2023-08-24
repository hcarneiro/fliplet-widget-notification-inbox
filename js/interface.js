var appSettingsBadgeType;

function saveWidget() {
  var saveAppSettings = Promise.resolve();
  var badgeType = $('[name="notificationsBadgeType"]:checked').val();

  // Update app settings if the value has changed
  if (badgeType && badgeType !== appSettingsBadgeType) {
    saveAppSettings = Fliplet.App.Settings.set({
      notificationsBadgeType: badgeType
    });
  }

  return saveAppSettings.then(function() {
    return Fliplet.Widget.save();
  }).then(function() {
    return Fliplet.Widget.complete();
  }).catch(function(error) {
    Fliplet.Modal.alert({
      title: 'Error saving widget',
      message: Fliplet.parseError(error)
    });
  });
}

function attachObservers() {
  // Update Studio interface labels
  $(window).on('resize', Fliplet.Widget.autosize);

  // Toggle save button after notifications overlay closes
  window.addEventListener('message', function(event) {
    if (event.data.event === 'overlay-close') {
      Fliplet.Widget.resetSaveButtonLabel();
    }
  });

  // Fired from Fliplet Studio when the external save button is clicked
  Fliplet.Widget.onSaveRequest(function() {
    return saveWidget();
  });

  $('.manage-notifications').on('click', function(e) {
    e.preventDefault();
    Fliplet.Studio.emit('overlay', {
      name: 'notifications',
      options: {
        appId: Fliplet.Env.get('appId'),
        size: 'large',
        title: 'Notifications',
        classes: 'publish-option-overlay notifications-widget'
      }
    });
  });
}

function init() {
  var data = Fliplet.Widget.getData() || {};
  var badgeType = Fliplet.Env.get('appSettings').notificationsBadgeType;

  appSettingsBadgeType = badgeType;

  if (['new', 'unread'].indexOf(badgeType) < 0) {
    badgeType = 'new';
  }

  // Restore form data
  $('[name="notificationsBadgeType"][value="' + badgeType + '"]').prop('checked', true);

  // Show interface UI after loading
  $('.interface-container').removeClass('loading');
}

attachObservers();
init();
