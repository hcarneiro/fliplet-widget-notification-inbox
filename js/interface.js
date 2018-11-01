Fliplet().then(function () {
  var data = Fliplet.Widget.getData() || {};

  $(window).on('resize', Fliplet.Widget.autosize);

  $('form').submit(function (event) {
    event.preventDefault();

    Fliplet.Widget.save({}).then(function () {
      Fliplet.Widget.complete();
    });
  });

  // Fired from Fliplet Studio when the external save button is clicked
  Fliplet.Widget.onSaveRequest(function () {
    $('form').submit();
  });

  Fliplet.API.request('v1/widget-instances/com.fliplet.notifications/interface?appId=' + Fliplet.Env.get('appId'));
});
