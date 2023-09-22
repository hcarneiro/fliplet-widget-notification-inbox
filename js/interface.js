function saveWidget() {
  var badgeType = $('[name="notificationsBadgeType"]:checked').val();

  return Fliplet.App.Settings.set({
    notificationsBadgeType: badgeType
  })
    .then(function() {
      return Fliplet.Widget.save({
        notificationsBadgeType: badgeType
      });
    })
    .then(function() {
      return Fliplet.Widget.complete();
    })
    .catch(function(error) {
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
}

function init() {
  var badgeType = Fliplet.Env.get('appSettings').notificationsBadgeType;

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
