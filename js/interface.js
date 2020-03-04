function saveWidget(options) {
  return Fliplet.Widget.save({
    mode: $('#show_demo').prop('checked') ? 'demo' : null
  }).then(function () {
    return Fliplet.Widget.complete();
  }).catch(function (error) {
    Fliplet.Modal.alert({
      title: 'Error saving widget',
      message: Fliplet.parseError(error)
    });
  });
}

function attachObservers() {
  // Update Studio interface labels
  $(window).on('resize', Fliplet.Widget.autosize);

  // Fired from Fliplet Studio when the external save button is clicked
  Fliplet.Widget.onSaveRequest(function () {
    return saveWidget();
  });

  $('.manage-notifications').on('click', function (e) {
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

  // Activate Nofifications app component
  Fliplet.API.request('v1/widget-instances/com.fliplet.notifications/interface?appId=' + Fliplet.Env.get('appId'));

  // Restore form data
  $('#show_demo').prop('checked', data.mode === 'demo');

  // Show interface UI after loading
  $('.interface-container').removeClass('loading');
}

attachObservers();
init();
