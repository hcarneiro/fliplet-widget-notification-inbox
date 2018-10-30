this["Fliplet"] = this["Fliplet"] || {};
this["Fliplet"]["Widget"] = this["Fliplet"]["Widget"] || {};
this["Fliplet"]["Widget"]["Templates"] = this["Fliplet"]["Widget"]["Templates"] || {};

this["Fliplet"]["Widget"]["Templates"]["templates.loadMore"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"load-more\">\n  <button data-load-more class=\"btn btn-link btn-block btn-lg\">Load more</button>\n  <i class=\"fa fa-spinner fa-pulse fa-3x fa-fw\"></i>\n</div>\n";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.newNotifications"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"yes\">new available</div>";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.notification"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<div class=\"notification {{#if readStatus}}notification-read{{else}}notification-unread{{/if}}\" data-notification-id=\"{{id}}\">\n  <div class=\"subtitle\">{{moment createdAt calendar=\"null\"}}</div>\n  {{#if data.title}}<h2 class=\"title\">{{data.title}}</h2>{{/if}}\n  {{#if data.message}}<div class=\"description\">\n    <p>{{data.message}}</p>\n  </div>{{/if}}\n  {{#unless readStatus}}<div class=\"notification-badge\"></div>{{/unless}}\n</div>";
},"useData":true});

this["Fliplet"]["Widget"]["Templates"]["templates.notifications.toolbar"] = Handlebars.template({"compiler":[7,">= 4.0.0"],"main":function(container,depth0,helpers,partials,data) {
    return "<p>{{count}} unread <span class=\"toolbar-read-all\">(<a data-read-all href=\"#\">Mark all as read</a>)</span></p>\n";
},"useData":true});