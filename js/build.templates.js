this["Fliplet"] = this["Fliplet"] || {};
this["Fliplet"]["Widget"] = this["Fliplet"]["Widget"] || {};
this["Fliplet"]["Widget"]["Templates"] = this["Fliplet"]["Widget"]["Templates"] || {};

this["Fliplet"]["Widget"]["Templates"]["templates.loadMore"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"load-more\">\n  <button data-load-more class=\"btn btn-link btn-block btn-lg\">"
    + container.escapeExpression((helpers.T || (depth0 && depth0.T) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"widgets.notificationInbox.actions.loadMore",{"name":"T","hash":{},"data":data}))
    + "</button>\n  <i class=\"fa fa-spinner fa-pulse fa-3x fa-fw\"></i>\n</div>\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.noNotifications"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3=container.escapeExpression;

  return "<div class=\"no-notifications\">\n  <h3>"
    + alias3((helpers.T || (depth0 && depth0.T) || alias2).call(alias1,"widgets.notificationInbox.noNotifications.title",{"name":"T","hash":{},"data":data}))
    + "</h3>\n  <p>"
    + alias3((helpers.T || (depth0 && depth0.T) || alias2).call(alias1,"widgets.notificationInbox.noNotifications.instruction",{"name":"T","hash":{},"data":data}))
    + "</p>\n</div>\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.notification"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div\n  class=\"notification {{#if readAt}}notification-read{{else}}notification-unread{{/if}}{{#if hasLink}} notification-linked{{/if}} {{data.type}}\"\n  data-notification-id=\"{{id}}\"\n  data-notification-status=\"{{status}}\"\n>\n  <div class=\"subtitle\">{{TD createdAt format=\"fromNow\"}}</div>\n  {{#if data.tags}}\n  <div class=\"tags\">\n    {{#each data.tags}}\n    <span class=\"tag {{type}}\">{{name}}</span>\n    {{/each}}\n  </div>\n  {{/if}}\n  {{#if data.title}}<h2 class=\"title\">{{data.title}}</h2>{{/if}}\n  {{#if data.message}}<div class=\"description\">\n    <p>{{{data.message}}}</p>\n  </div>{{/if}}\n  {{#if data.body}}<div class=\"description\">\n    <p>{{{data.body}}}</p>\n  </div>{{/if}}\n  {{#unless readStatus}}<div class=\"notification-badge\"></div>{{/unless}}\n</div>\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.notificationsError"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"notifications-error\">\n  <h3>"
    + container.escapeExpression((helpers.T || (depth0 && depth0.T) || helpers.helperMissing).call(depth0 != null ? depth0 : (container.nullContext || {}),"widgets.notificationInbox.errors.loadingFailed",{"name":"T","hash":{},"data":data}))
    + "</h3>\n</div>\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.toolbar"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    var alias1=depth0 != null ? depth0 : (container.nullContext || {}), alias2=helpers.helperMissing, alias3=container.escapeExpression;

  return "<p><span class=\"unread-count\">{{TN count}}</span> "
    + alias3((helpers.T || (depth0 && depth0.T) || alias2).call(alias1,"widgets.notificationInbox.toolbar.unread",{"name":"T","hash":{},"data":data}))
    + " <span class=\"toolbar-read-all\">(<a data-read-all href=\"#\">"
    + alias3((helpers.T || (depth0 && depth0.T) || alias2).call(alias1,"widgets.notificationInbox.toolbar.actions.readAll",{"name":"T","hash":{},"data":data}))
    + "</a>)</span><i class=\"fa fa-lg fa-fw fa-cog pull-right\" data-settings></i><i class=\"fa fa-lg fa-fw fa-refresh pull-right\" data-refresh></i></p>\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.toolbar.empty"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<p>&nbsp;<i class=\"fa fa-lg fa-fw fa-cog pull-right\" data-settings></i><i class=\"fa fa-lg fa-fw fa-refresh pull-right\" data-refresh></i></p>\n";
},"useData":true});