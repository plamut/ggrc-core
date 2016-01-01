/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

// Initialize delegated event handlers
jQuery(function ($) {
  window.natural_comparator = function (a, b) {
    var i;
    a = a.slug.toString();
    b = b.slug.toString();
    if (a === b) {
      return 0;
    }

    a = a.replace(/(?=\D\d)(.)|(?=\d\D)(.)/g, '$1$2|').split('|');
    b = b.replace(/(?=\D\d)(.)|(?=\d\D)(.)/g, '$1$2|').split('|');

    for (i = 0; i < Math.max(a.length, b.length); i++) {
      if (Number(a[i]) === Number(a[i]) && Number(b[i]) === Number(b[i])) {
        if (Number(a[i]) < Number(b[i])) {
          return -1;
        }
        if (Number(b[i]) < Number(a[i])) {
          return 1;
        }
      } else {
        if (a[i] < b[i]) {
          return -1;
        }
        if (b[i] < a[i]) {
          return 1;
        }
      }
    }
    return 0;
  };

  // Turn the arrow when tree node content is shown
  $('body').on('click', '[data-toggle="collapse"]', function (e) {
    var $this = $(this);
    var $expander_container = $this.closest(':has(.expander, .enddot)');
    var $expander = $expander_container.find('.expander').eq(0);
    var $target = $($this.data('target'));

    setTimeout(function () {
      if ($target.hasClass('in')) {
        $expander.addClass('in');
      } else {
        $expander.removeClass('in');
      }
    }, 100);
  });

  // After the modal template has loaded from the server, but before the
  //  data has loaded to populate into the body, show a spinner
  $('body').on('loaded', '.modal.modal-slim, .modal.modal-wide', function (e) {
    var spin = function () {
      $(this).html(
        $(new Spinner().spin().el)
          .css({
            width: '100px', height: '100px',
            left: '50%', top: '50%',
            zIndex: calculate_spinner_z_index
          })
      ).one('loaded', function () {
        $(this).find('.source').each(spin);
      });
    };

    $(e.target).find('.modal-body .source').each(spin);
  });

  $('body').on('click', '[data-toggle="list-remove"]', function (e) {
    e.preventDefault();
    $(this).closest('li').remove();
  });

  $('body').on('click', '[data-toggle="list-select"]', function (e) {
    var $this = $(this);
    var $li = $this.closest('li');
    var target = $li.closest('ul').data('list-target');
    var data;

    e.preventDefault();

    if (target) {
      data = $.extend({}, $this.data('context') || {}, $this.data());
      $(target).tmpl_mergeitems([data]);
    }
  });
});

// This is only used by import to redirect on successful import
// - this cannot use other response headers because it is proxied through
//   an iframe to achieve AJAX file upload (using remoteipart)
jQuery(function ($) {
  var submit_import = 'form.import input[type=submit]';
  var file_select_elem = 'form.import input[type=file]';

  function onSubmitClick(ev) {
    if (typeof ev !== 'object') {
      // sometimes browser triggers submit, not the user -> ignore
      return;
    }
    if ($(this).hasClass('disabled') || $(file_select_elem).val() === '') {
      if (ev) {
        ev.preventDefault();
      }
    }
    $(this).addClass('disabled');
  }
  function checkStatus(result, type, $btn) {
    CMS.Models.BackgroundTask.findOne({id: result.id}, function (task) {
      var msg = ($btn && $btn.val() === 'Upload and Review') ?
      $btn.val() : type;
      var $container;
      var jsonResult;
      var headers;
      var i;
      if (task.status === 'Pending' || task.status === 'Running') {
        $('body').trigger(
          'ajax:flash',
            {progress: msg + ' ' + task.status.toLowerCase() + '...'}
        );
        // Task has not finished yet, check again in a while:
        setTimeout(function () {
          checkStatus(result, type, $btn);
        }, 3000);
      } else if (task.status === 'Success') {
        $container = $('#results-container');
        if ($btn) {
          $btn.removeClass('disabled');
        }
        // Check if redirect:
        try {
          jsonResult = $.parseJSON($(task.result.content).text());
          if ('location' in jsonResult) {
            GGRC.navigate(jsonResult.location);
            return;
          }
        } catch (e) {}
        // Check if file download (export):
        if ('headers' in task.result) {
          headers = task.result.headers;
          for (i = 0; i < headers.length; i++) {
            if (headers[i][0] === 'Content-Type' &&
              headers[i][1] === 'text/csv') {
              window.location.assign('/background_task/' + task.id);
            }
          }
        }
        $container.html(task.result.content);
        $container.find('input[type=submit]').click(onSubmitClick);
        if (msg === 'Upload and Review') {
          // Don't display "Upload and Review successful." message;
          // But kill progress message.
          $('body').trigger('ajax:flash', {});
          return;
        }
        $('body').trigger(
          'ajax:flash',
            {success: msg + ' successful.'}
        );
      } else if (task.status === 'Failure') {
        if ($btn) {
          $btn.removeClass('disabled');
        }
        $('body').trigger(
          'ajax:flash',
            {error: msg + ' failed.'}
        );
      }
    });
  }
  $(submit_import).click(onSubmitClick);
  // handler to initialize import upload button as disabled
  $(submit_import).ready(function () {
    $(submit_import).addClass('disabled');
  });
  $('body').on('ajax:success', 'form.import', function (e, data, status, xhr) {
    var $btn = $('form.import .btn.disabled').first();
    var result;
    if (xhr.getResponseHeader('Content-Type') === 'application/json') {
      result = $.parseJSON(data);
      if ('location' in result) {
        // Redirect
        GGRC.navigate(result.location);
      }
      // Check if task has completed:
      setTimeout(function () {
        checkStatus(result, 'Import', $btn);
      }, 500);
    } else if ($btn) {
      $btn.removeClass('disabled');
    }
  });

  // change button to disabled when no file selected, and vice versa
  $(file_select_elem).change(function (ev) {
    if (this.value === '') {
      $(submit_import).each(onSubmitClick);
    } else {
      $(submit_import).removeClass('disabled');
    }
  });

  jQuery(function ($) {
    $('body').on('ajax:success', 'form[data-remote][data-update-target]', function (e, data, status, xhr) {
      var $container;
      if (xhr.getResponseHeader('Content-Type') === 'text/html') {
        $container = $($(this).data('update-target'));
        $container.html(data);
        $container.find('input[type=submit]').click(onSubmitClick);
      }
    });
  });
});

jQuery(function ($) {
  function refresh_page() {
    setTimeout(can.proxy(window.location.reload, window.location), 10);
  }

  $('body').on('ajax:complete', '[data-ajax-complete="refresh"]', refresh_page);
});

jQuery(function ($) {
  $('body').on('ajax:success', '#helpedit form', function (e, data, status, xhr) {
    var $modal = $(this).closest('.modal');
    $modal.find('.modal-header h1').html(data.help.title);
    $modal.find('.modal-body .help-content').html(data.help.content);
    $modal.find('.modal-body #helpedit').collapse('hide');
  });
});

jQuery(function ($) {
  // Used in object_list sidebars (References, People, Categories)
  $('body').on('modal:success', '.js-list-container-title a', function (e, data) {
    var $this = $(this);
    var $title = $this.closest('.js-list-container-title');
    var $span = $title.find('span');
    var $expander = $title.find('.expander').eq(0);

    $span.text('(' + (data.length || 0) + ')');

    if (data.length > 0) {
      $span.removeClass('no-object');
    } else {
      $span.addClass('no-object');
    }

    if (!$expander.hasClass('in')) {
      $expander.click();
    }
  });
});

jQuery(function ($) {
  function checkActive(notification_configs) {
    var inputs = $('.notify-wrap').find('input');
    var active_notifications;

    active_notifications = $.map(notification_configs, function (a) {
      if (a.enable_flag) {
        return a.notif_type;
      }
    });
    $.map(inputs, function (input) {
      // Handle the default case, in case notification objects are not set:
      if (notification_configs.length === 0) {
        input.checked = input.value === 'Email_Digest';
      } else {
        input.checked = active_notifications.indexOf(input.value) > -1;
      }
    });
  }

  CMS.Models.NotificationConfig.findActive().then(checkActive);

  // Don't close the dropdown if clicked on checkbox
  $('body').on('click', '.notify-wrap', function (ev) {
    ev.stopPropagation();
  });

  $('body').on('click', 'input[name=notifications]', function (ev, el) {
    var li = $(ev.target).closest('.notify-wrap');
    var inputs = li.find('input');
    var active = [];
    var email_now = li.find('input[value="Email_Now"]');
    var email_now_label = email_now.closest('label');
    var email_digest = li.find('input[value="Email_Digest"]');

    if (email_digest[0].checked) {
      email_now_label.removeClass('disabled');
      email_now.prop('disabled', false);
    } else if (!email_digest[0].checked) {// uncheck email_now
      email_now.prop('checked', false);
      email_now_label.addClass('disabled');
    }

    inputs.prop('disabled', true);
    active = $.map(inputs, function (input) {
      if (input.checked) {
        return input.value;
      }
    });
    CMS.Models.NotificationConfig.setActive(active).always(function (response) {
      email_digest.prop('disabled', false);
      if (email_digest[0].checked) {
        email_now.prop('disabled', false);
      }
    });
  });

  $('body').on('click', '.clear-display-settings', function (e) {
    CMS.Models.DisplayPrefs.findAll().done(function (data) {
      var destroys = [];
      can.each(data, function (d) {
        d.unbind('change'); // forget about listening to changes.  we're going to refresh the page
        destroys.push(d.resetPagePrefs());
      });
      $.when.apply($, destroys).done(function () {
        GGRC.navigate();
      });
    });
  })
  .on('click', '.set-display-settings-default', function (e) {
    var page_token = getPageToken();
    CMS.Models.DisplayPrefs.findAll().done(function (data) {
      var destroys = [];
      can.each(data, function (d) {
        d.unbind('change'); // forget about listening to changes.  we're going to refresh the page
        destroys.push(d.setPageAsDefault(page_token));
      });
      $.when.apply($, destroys).done(function () {
        $('body').trigger(
          'ajax:flash',
          {success: 'Saved page layout as default for ' + (page_token === 'dashboard' ? 'dashboard' : page_token)}
        );
      });
    });
  });
});

// Make all external links open in new window.
jQuery(function ($) {
  $('body').on('click', 'a[href]:not([target])', function (e) {
    if (!e.isDefaultPrevented()) {
      if (/^http/.test(this.protocol) &&
        this.hostname !== window.location.hostname) {
        e.preventDefault();
        window.open(this.href);
      }
    }
  });
});

function resize_areas(event, target_info_pin_height) {
  var $window;
  var $lhsHolder;
  var $header;
  var $footer;
  var $topNav;
  var $innerNav;
  var $objectArea;
  var $bar;
  var $pin;
  var winHeight;
  var winWidth;
  var objectWidth;
  var lhsHeight;
  var footerMargin;
  var internavHeight;
  var internavWidth;

  $window = $(window);
  $lhsHolder = $('.lhs-holder');
  $footer = $('.footer');
  $header = $('.header-content');
  $innerNav = $('.inner-nav');
  $objectArea = $('.object-area');
  $topNav = $('.top-inner-nav');
  $bar = $('.bar-v');
  $pin = $('.pin-content');

  winHeight = $window.height();
  winWidth = $window.width();
  lhsHeight = winHeight - 180; // new ui
  footerMargin = lhsHeight + 130; // new UI
  internavWidth = $innerNav.width() || 0; // || 0 for pages without inner-nav
  objectWidth = winWidth;
  internavHeight = object_area_height();

  $lhsHolder.css('height', lhsHeight);
  $bar.css('height', lhsHeight);
  $footer.css('margin-top', footerMargin);
  $innerNav.css('height', internavHeight);
  $objectArea
    .css('margin-left', internavWidth)
    .css('height', internavHeight)
    .css('width', objectWidth);

  function object_area_height() {
    var height = winHeight - not_main_elements_height();
    var nav_pos = $topNav.css('top') ?
              Number($topNav.css('top').replace('px', '')) : 0;

    if (nav_pos < $header.height()) {
      height -= $topNav.height();
    }

    return height;
  }

  function not_main_elements_height() {
    var margins = [$objectArea.css('margin-top'),
                   $objectArea.css('margin-bottom'),
                   $objectArea.css('padding-top'),
                   $objectArea.css('padding-bottom')]
              .map(function (margin) {
                if (!margin) {
                  margin = '0';
                }
                return Number(margin.replace('px', ''));
              })
              .reduce(function (m, h) {
                return m + h;
              }, 0);

    var pin_height = $.isNumeric(target_info_pin_height) ?
              target_info_pin_height : $pin.height();

          // the 5 gives user peace of mind they've reached bottom
    var UIHeight = [$topNav.height(), $header.height(),
                      $footer.height(),
                      margins, pin_height, 5]
              .reduce(function (m, h) {
                return m + h;
              }, 0);

    return UIHeight;
  }
}

jQuery(function ($) {
  // Footer expander animation helper
  function expander(toggle, direction) {
    var $this = $(toggle);
    var $expander = $this.closest('div').find('.section-expander');
    var out = direction === 'out';
    var height = $expander.outerHeight();
    var width = $expander.outerWidth();
    var start = out ? 0 : width;
    var end = out ? width : 0;
    var duration = 500;
    var clip;

    if (out) {
      $this.filter(':not(.section-sticky)').fadeOut(200);
    }

    // Check for intermediate animation
    // Update the starting point and duration as appropriate
    if ($expander.is(':animated')) {
      $expander.stop();
      clip = $expander.css('clip').match(/^rect\(([0-9.-]+)px,?\s+([0-9.-]+)px,?\s+([0-9.-]+)px,?\s+([0-9.-]+)px\)$/);
      if (clip) {
        // Start or end is always zero, so we can use some shortcuts
        start = parseFloat(clip[2]);
        duration = ~~((end ? end - start : start) / width * duration);
      }
    }

    // Process animation
    $expander.css({
      display: 'inline-block', marginRight: end + 'px', clip: 'rect(0px, ' + start + 'px, ' + height + 'px, 0px)', left: $this.is('.section-sticky') ? $this.outerWidth() : 0
    }).animate({
      marginRight: start + 'px'
    }, {
      duration: duration, easing: 'easeInOutExpo', step: function (now, fx) {
        $(this).css('clip', 'rect(0px, ' + (width - now + (out ? start : end)) + 'px, ' + height + 'px, 0px)');
      }, complete: function () {
        if (!out) {
          $this.filter(':not(.section-sticky)').fadeIn();
          $(this).hide();
        }
        $(this).css({
          marginRight: '0px', clip: 'auto'
        });
      }
    });

    // Queue the reverse on mouseout
    if (out) {
      $this.closest('li').one('mouseleave', function () {
        expander($this, 'in');
      });
    }
  }

  // Footer expander animations (verify that an expander exists)
  $('body').on('mouseenter', '.section-add:has(+ .section-expander), .section-expander:visible:animated', function (e) {
    var $this = $(this);
    expander($this.hasClass('section-add') ?
      $this : $this.prev('.section-add'), 'out');
  });

  $('body').on('click', '.show-long', function (e) {
    var $this = $(this);
    var $descField = $this.closest('.span12').find('.tree-description');

    $this.hide();
    $descField.removeClass('short');
  });

  // show/hide audit lead and firm
  $('body').on('mouseover', '.ui-autocomplete li a', function (e) {
    var $this = $(this);
    $this.addClass('active');
    $this.closest('li').addClass('active');
  });
  $('body').on('mouseleave', '.ui-autocomplete li a', function (e) {
    var $this = $(this);
    $this.removeClass('active');
    $this.closest('li').removeClass('active');
  });
});

jQuery(window).on('load', resize_areas);
jQuery(window).on('resize', resize_areas);
