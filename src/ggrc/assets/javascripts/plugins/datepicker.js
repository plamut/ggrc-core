/*!
    Copyright (C) 2015 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: ivan@reciprocitylabs.com
    Maintained By: ivan@reciprocitylabs.com
*/
(function ($, moment) {
  // On-demand creation of datepicker() objects
  var $body = $('body');
  var format = {
    changeMonth: true,
    changeYear: true,
    dateFormat: 'mm/dd/yy'
  };

  $body.on('focus', '[data-toggle="datepicker"]', function (ev) {
    var $this = $(this);

    if ($this.data('datepicker')) {
      return;
    }
    $this.datepicker(format);

    if ($this.is('[data-before], [data-after]')) {
      $this.trigger('change');
    }
  });

  // On-demand creation of datepicker() objects, initial date today or later
  $body.on('focus', '[data-toggle="datepicker_today_or_later"]', function (ev) {
    var $this = $(this);

    if ($this.data('datepicker')) {
      return;
    }
    $this.datepicker(format)
         .datepicker('option', 'minDate', new Date());
  });
})(jQuery, moment);
