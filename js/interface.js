// Update Studio interface labels
$(window).on('resize', Fliplet.Widget.autosize);

// Fired from Fliplet Studio when the external save button is clicked
Fliplet.Widget.onSaveRequest(function () {
  // Directly close interface because there's no configuration required
  Fliplet.Widget.complete();
});

Fliplet.Studio.emit('widget-save-label-update', { text : 'Close' });
Fliplet.Studio.emit('widget-cancel-label-update', { text : '' });

// Activate Nofifications app component
Fliplet.API.request('v1/widget-instances/com.fliplet.notifications/interface?appId=' + Fliplet.Env.get('appId'));