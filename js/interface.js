Fliplet().then(function () {
  var data = Fliplet.Widget.getData() || {};

  $(window).on('resize', Fliplet.Widget.autosize);

  if (!_.hasIn(data, 'heading')) {
    $('#heading').val('Notifications');
  }

  $('form').submit(function (event) {
    event.preventDefault();

    Fliplet.Widget.save({
      heading: $('#heading').val()
    }).then(function () {
      Fliplet.Widget.complete();
    });
  });

  // Fired from Fliplet Studio when the external save button is clicked
  Fliplet.Widget.onSaveRequest(function () {
    $('form').submit();
  });
});
