/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function (root, GGRC, $, can) {
  var doc = root.document;
  var body = doc.body;
  var $win = $(root);
  var $doc = $(doc);
  var $body = $(body);
  var _type;

  $win.on('hashchange', function () {
    GGRC.current_url_compute(window.location);
  });
  $.migrateMute = true; // turn off console warnings for jQuery-migrate

  // Init ZeroConfig
  ZeroClipboard.config({swfPath: '/static/flash/ZeroClipboard.swf'});

  function ModelError(message, data) {
    this.name = 'ModelError';
    this.message = message || 'Invalid Model encountered';
    this.data = data;
  }
  ModelError.prototype = Error.prototype;
  root.cms_singularize = function (type) {
    type = type.trim();
    _type = type.toLowerCase();
    switch (_type) {
      case 'facilities':
        type = type[0] + 'acility'; break;
      case 'people':
        type = type[0] + 'erson'; break;
      case 'processes':
        type = type[0] + 'rocess'; break;
      case 'policies':
        type = type[0] + 'olicy'; break;
      case 'systems_processes':
        type = type[0] + 'ystem_' + type[8] + 'rocess';
        break;
      default:
        type = type.replace(/s$/, '');
    }
    return type;
  };
  root.calculate_spinner_z_index = function () {
    var zindex = 0;
    $(this).parents().each(function () {
      var z = parseInt($(this).css('z-index'), 10);
      if (z) {
        zindex = z;
        return false;
      }
    });
    return zindex + 10;
  };

  $doc.ready(function () {
    // monitor target, where flash messages are added
    var target = $('section.content div.flash')[0];
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        // check for new nodes
        if (mutation.addedNodes !== null) {
          // remove the success message from non-expandable
          // flash success messages after five seconds
          setTimeout(function () {
            $('.flash .alert').not(':has(ul.flash-expandable)').remove();
          }, 5000);
        }
      });
    });

    var config = {
      attributes: true,
      childList: true,
      characterData: true
    };

    if (target) {
      observer.observe(target, config);
    }

    setTimeout(function () {
      $('.flash .alert-success').not(':has(ul.flash-expandable)').remove();
    }, 5000);

    // TODO: Not AJAX friendly
    $('.bar[data-percentage]').each(function () {
      $(this).css({
        width: $(this).data('percentage') + '%'
      });
    });

    // tree
    $body.on('click', 'ul.tree .item-title', function (e) {
      var $this = $(this);
      var $content = $this.closest('li').find('.item-content');

      if ($this.hasClass('active')) {
        $content.slideUp('fast');
        $this.removeClass('active');
      } else {
        $content.slideDown('fast');
        $this.addClass('active');
      }
    });
    $body.on('change', '.rotate_control_assessment', function (ev) {
      ev.currentTarget.click(function () {
        ev.currentTarget.toggle();
      });
    });
    setTimeout(function () {
      GGRC.queue_event(
        can.map(GGRC.Templates, function (template, id) {
          var key = can.view.toId(GGRC.mustache_path + '/' + id + '.mustache');
          if (!can.view.cachedRenderers[key]) {
            return function () {
              can.view.mustache(key, template);
            };
          }
        })
      );
    }, 2000);
  });

  $win.load(function () {
    var last_popover;
    // affix setup
    $win.scroll(function () {
      if ($('.header-content').hasClass('affix')) {
        $('.header-content').next('.content').addClass('affixed');
      } else {
        $('.header-content').next('.content').removeClass('affixed');
      }
    });
    $body.on('click', 'ul.tree-structure .item-main .grcobject, ul.tree-structure .item-main .openclose', function (evnt) {
      evnt.stopPropagation();
      $(this).openclose();
    });
    // Google Circle CTA Button
    $body.on('mouseenter', '.square-trigger', function () {
      var $this = $(this);
      var $popover = $this.closest('.circle-holder').find('.square-popover');

      $popover.slideDown('fast');
      $this.addClass('active');
      return false;
    });
    $body.on('mouseleave', '.square-popover', function () {
      var $this = $(this);
      var $trigger = $this.closest('.circle-holder').find('.square-trigger');

      $this.slideUp('fast');
      $trigger.removeClass('active');
      $this.removeClass('active');
      return false;
    });
    // References popup preview
    $body.on('mouseenter', '.new-tree .tree-info a.reference', function () {
      if ($(this).width() > $('.new-tree .tree-info').width()) {
        $(this).addClass('shrink-it');
      }
    });

    // Popover trigger for person tooltip in styleguide
    // The popover disappears if the show/hide isn't controlled manually
    $body.on('mouseenter', '.person-tooltip-trigger', function (ev) {
      var target = $(ev.currentTarget);
      var content = target.closest('.person-holder')
        .find('.custom-popover-content').html();
      var popover;

      if (!content) {
        // Don't show tooltip if there is no content
        return;
      }
      if (!target.data('popover')) {
        target.popover({
          html: true,
          delay: {
            show: 400,
            hide: 200
          },
          trigger: 'manual',
          content: function () {
            return content;
          }
        });
        target.data('popover').tip()
          .addClass('person-tooltip').css('z-index', 2000);
      }
      popover = target.data('popover');
      if (last_popover && last_popover !== popover) {
        last_popover.hide();
      }

      // If the popover is active, just refresh the timeout, otherwise show popover
      if (popover.tip().is(':visible') && popover.timeout) {
        clearTimeout(popover.timeout);
        popover.hoverState = 'in';
      } else {
        clearTimeout(popover.timeout);
        popover.enter(ev);
      }

      last_popover = popover;
    });
    $body.on('mouseenter', '.popover', function (ev) {
      // Refresh the popover
      if (last_popover && last_popover.tip().is(':visible')) {
        ev.currentTarget = last_popover.$element[0];
        clearTimeout(last_popover.timeout);
        last_popover.hoverState = 'in';
      }
    });
    $body.on('mouseleave', '.person-holder, .person-tooltip-trigger, .popover, .popover .square-popover', function (ev) {
      var target = $(ev.currentTarget);
      var popover;

      if (target.is('.person-tooltip-trigger')) {
        target = target.closest('.person-holder');
      } else if (target.is('.square-popover')) {
        target = target.closest('.popover');
      }

      // Hide the popover if we left for good
      if (target.is('.person-holder') &&
        (target = target.find('.person-tooltip-trigger')) &&
        (popover = target.data('popover'))) {
        ev.currentTarget = target[0];
        popover.leave(ev);
      // Check if this popover originated from the last person popover
      } else if (last_popover && target.is('.popover') &&
        last_popover.tip()[0] === target[0]) {
        ev.currentTarget = last_popover.$element[0];
        last_popover.leave(ev);
      }
    });

    // Tab indexing form fields in modal
    $body.on('focus', '.modal', function () {
      $('.wysiwyg-area').each(function () {
        var $this = $(this);
        var $textarea = $this.find('textarea.wysihtml5').attr('tabindex');
        var $descriptionField = $this.find('iframe.wysihtml5-sandbox');

        function addingTabindex() {
          $descriptionField.attr('tabindex', $textarea);
        }
        setTimeout(addingTabindex, 100);
      });
    });

    // Prevent link popup in code mode
    $body.on('click', 'a[data-wysihtml5-command=popupCreateLink]', function (e) {
      var $this = $(this);
      if ($this.hasClass('disabled')) {
        // The button is disabled, close the modal immediately
        $('body').find('.bootstrap-wysihtml5-insert-link-modal').modal('hide');
        $this.closest('.wysiwyg-area').find('textarea').focus();
      }
    });

    // Watermark trigger
    $body.on('click', '.watermark-trigger', function () {
      var $this = $(this);
      var $showWatermark = $this.closest('.tree-item').find('.watermark-icon');

      $showWatermark.fadeIn('fast');
      $this.addClass('active');
      $this.html('<span class="utility-link"><i class="grcicon-watermark"></i> Watermarked</span>');

      return false;
    });

    // top nav dropdown position
    function dropdownPosition() {
      var $this = $(this);
      var $dropdown = $this.closest('.hidden-widgets-list')
        .find('.dropdown-menu');
      var $menu_item = $dropdown.find('.inner-nav-item').find('a');
      var offset = $this.offset();
      var win = $(window);
      var win_width = win.width();

      if (win_width - offset.left < 322) {
        $dropdown.addClass('right-pos');
      } else {
        $dropdown.removeClass('right-pos');
      }
      if ($menu_item.length === 1) {
        $dropdown.addClass('one-item');
      } else {
        $dropdown.removeClass('one-item');
      }
    }
    $('.dropdown-toggle').on('click', dropdownPosition);
  });
  root.getPageToken = function getPageToken() {
    return $(document.body).data('page-subtype') ||
      $(document.body).data('page-type') ||
      window.location.pathname.substring(1, (window.location.pathname + '/')
        .indexOf('/', 1));
  };
  // Make sure GGRC.config is defined (needed to run Karma tests)
  GGRC.config = GGRC.config || {};
})(window, GGRC, jQuery, can);
