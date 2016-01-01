/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

(function ($) {
  'use strict';
  /* MODAL_FORM PUBLIC CLASS DEFINITION
   * =============================== */
  var ModalForm = function (element, options, trigger) {
    this.options = options;
    this.$element = $(element);
    this.$trigger = $(trigger);

    this.init();
  };

  /* NOTE: MODAL_FORM EXTENDS BOOTSTRAP-MODAL.js
   * ========================================== */
  ModalForm.prototype = new $.fn.modal.Constructor(null, {remote: false});

  $.extend(ModalForm.prototype, {
    init: function () {
      var that = this;

      this.$element
        .on('preload', function () {
          that.is_form_dirty(true);
        })
        .on('keypress', 'form', $.proxy(this.keypress_submit, this))
        .on('keyup', 'form', $.proxy(this.keyup_escape, this))
        .on('click.modal-form.close', '[data-dismiss="modal"]',
          $.proxy(this.hide, this))
        .on('click.modal-form.reset',
          'input[type=reset], [data-dismiss="modal-reset"]',
          $.proxy(this.reset, this))
        .on('click.modal-form.submit',
          'input[type=submit], [data-toggle="modal-submit"]',
          $.proxy(this.submit, this))
        .on('shown.modal-form', $.proxy(this.focus_first_input, this))
        .on('loaded.modal-form', $.proxy(this.focus_first_input, this))
        .on('loaded.modal-form', function (ev) {
          $('a[data-wysihtml5-command], a[data-wysihtml5-action]', ev.target)
            .attr('tabindex', '-1');
          $(this).trigger('shown'); // this will reposition the modal stack
        })
        .on('delete-object', $.proxy(this.delete_object, this))
        .draggable({handle: '.modal-header'});
    },
    doNothing: function (e) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    },
    delete_object: function (e, data, xhr) {
      // If this modal is contained within another modal, pass the event onward
      var $trigger_modal = this.$trigger.closest('.modal');
      var delete_target;

      if ($trigger_modal.length > 0) {
        $trigger_modal.trigger('delete-object', [data, xhr]);
      } else {
        delete_target = this.$trigger.data('delete-target');
        if (delete_target === 'refresh') {
          // Refresh the page
          GGRC.navigate(window.location.href.replace(/#.*/, ''));
        } else if (xhr && xhr.getResponseHeader('location')) {
          // Otherwise redirect if possible
          GGRC.navigate(xhr.getResponseHeader('location'));
        } else {
          // Otherwise refresh the page
          GGRC.navigate(window.location.href.replace(/#.*/, ''));
        }
      }
    },
    $form: function () {
      return this.$element.find('form').first();
    },
    is_form_dirty: function (cache_values) {
      var that = this;
      var cache = {};
      var dirty = false;

      // Generate a hash of the form values
      can.each(this.$form().serializeArray(), function (field) {
        cache[field.name] = cache[field.name] ?
          cache[field.name] + ',' + field.value : field.value;
      });

      // Cache the initial form values as requested
      if (cache_values || !this._cached_values) {
        this._cached_values = cache;
      } else { // Otherwise compute a diff to determine whether the form is dirty
        can.each(cache, function (value, key) {
          dirty = dirty ||
            (value !== that._cached_values[key] &&
              (!!value || that._cached_values[key] !== undefined));
        });
      }
      return dirty;
    },
    submit: function (e) {
      var $form = this.$form();
      var that = this;

      if (!$form.data('submitpending')) {
        $('[data-toggle=modal-submit]', $form)
          .each(function () {
            $(this).data('origText', $(this).text());
          })
          .addClass('disabled pending-ajax')
          .attr('disabled', true);

        $form.data('submitpending', true)
        .one('ajax:beforeSend', function (ev, _xhr) {
          that.xhr = _xhr;
        })
        .submit();
      }
      if (e.type === 'click') {
        e.preventDefault();
      }
    },
    keypress_submit: function (e) {
      if (e.which === 13 && !$(e.target).is('textarea')) {
        if (!e.isDefaultPrevented()) {
          e.preventDefault();
          this.$form().submit();
        }
      }
    },
    keyup_escape: function (e) {
      if ($(document.activeElement).is('select, [data-toggle=datepicker]') &&
        e.which === 27) {
        this.$element.attr('tabindex', -1).focus();
        e.stopPropagation();
      }
    },
    reset: function (e) {
      var form = this.$form()[0];
      if (form) {
        form.reset();
      }
      this.hide(e);
    },
    hide: function (e) {
      var that = this;
      var control = this.$element.control();
      var options = control && control.options;

      // If the hide was initiated by the backdrop, check for dirty form data before continuing
      if (e && $(e.target).is('.modal-backdrop')) {
        if ($(e.target).is('.disabled')) {
          // In the case of a disabled modal backdrop, treat it like any other disabled data-dismiss,
          //  i.e. do nothing.
          e.stopPropagation();
          return;
        }
        if (this.is_form_dirty()) {
          // Confirm that the user wants to lose the data prior to hiding
          GGRC.Controllers.Modals.confirm({
            modal_title: 'Discard Changes',
            modal_description: 'Are you sure that you want to discard your changes?',
            modal_confirm: 'Discard',
            instance: options.instance,
            model: options.model,
            skip_refresh: true
          }, function () {
            that.$element
              .find('[data-dismiss=\'modal\'], [data-dismiss=\'modal-reset\']')
              .trigger('click');
            that.hide();
          });
          return;
        }
      }
      // Hide the modal like normal
      $.when(function () {
        if (options) {
          return can.trigger(options.instance, 'modal:dismiss');
        }
        return undefined;
      }).then(function () {
        $.fn.modal.Constructor.prototype.hide.apply(this, [e]);
        this.$element.off('modal_form');
      }.bind(this));
    },
    focus_first_input: function (ev) {
      var that = this;
      setTimeout(function () {
        var $first_input;
        $first_input = that.$element.find('*[autofocus]');
        if ($first_input.length === 0) {
          $first_input = that.$element
            .find('input[type="text"], input[type="checkbox"], select, textarea')
            .not('[placeholder*=autofill], label:contains(autofill) + *, [disabled]')
            .first();
        }
        if ($first_input.length > 0 && (!ev || that.$element.is(ev.target))) {
          $first_input.get(0).focus();
        }
      }, 100);
    }
  });

  $.fn.modal_form = function (option, trigger) {
    return this.each(function () {
      var $this = $(this);
      var data = $this.data('modal_form');
      var options = $.extend({}, $.fn.modal_form.defaults,
          $this.data(), typeof option === 'object' && option);

      if (!data) {
        $this.data('modal_form',
          (data = new ModalForm(this, options, trigger)));
      }
      if (typeof option === 'string') {
        data[option]();
      } else if (options.show) {
        data.show();
      }
    });
  };
  $.fn.modal_form.Constructor = ModalForm;
  $.fn.modal_form.defaults = $.extend({}, $.fn.modal.defaults, {});

  /* MODAL-FORM DATA-API
   * =================== */
  $('body').on('click.modal-form.data-api', '[data-toggle="modal-form"]',
    function (e) {
      var $this = $(this);
      var href;
      var $target = $($this.attr('data-target') ||
        (href = $this.attr('href')) && href.replace(/.*(?=#[^\s]+$)/, '')); // strip for ie7
      var option = $target.data('modal-form') ? 'toggle' :
        $.extend({}, $target.data(), $this.data());

      e.preventDefault();
      $target.modal_form(option);
    });

  // Default flash handler
  // Default form complete handler
  $('body').on('ajax:complete', function (e, xhr, status) {
    var data = null;
    var modal_form;
    var flash_types;
    var type_i;
    var message;
    var flash;

    try {
      data = JSON.parse(xhr.responseText);
    } catch (exc) {}

    if (!e.stopRedirect) {
      // Maybe handle AJAX/JSON redirect or refresh
      if (xhr.status === 278) {
        // Handle 278 redirect (AJAX redirect)
        GGRC.navigate(xhr.getResponseHeader('location'));
      } else if (xhr.status === 279) {
        // Handle 279 page refresh
        GGRC.navigate(window.location.href.replace(/#.*/, ''));
      } else {
        modal_form = $('.modal:visible:last').data('modal_form');
        if (modal_form && xhr === modal_form.xhr) {
          delete modal_form.xhr;
          $('[data-toggle=modal-submit]', modal_form.$element)
            .removeAttr('disabled')
            .removeClass('disabled pending-ajax')
            .each(function () {
              $(this).text($(this).data('origText'));
            });
          $('form', modal_form.$element).data('submitpending', false);
        }
      }
    }
    if (data) {
      // Parse and dispatch JSON object
      $(e.target).trigger('ajax:json', [data, xhr]);
    } else if (xhr.responseText) {
      // Dispatch as html, if there is html to dispatch.  (no result should not blank out forms)
      $(e.target).trigger('ajax:html', [xhr.responseText, xhr]);
    }

    if (!e.stopFlash) {
      // Maybe handle AJAX flash messages
      flash_types = ['error', 'alert', 'notice', 'warning'];

      for (type_i in flash_types) {
        if (flash_types.hasOwnProperty(type_i)) {
          message = xhr.getResponseHeader('x-flash-' + flash_types[type_i]);
          message = JSON.parse(message);
          if (message) {
            if (!flash) {
              flash = {};
            }
            flash[flash_types[type_i]] = message;
          }
        }
      }

      if (flash) {
        $(document.body).trigger('ajax:flash', flash);
      }
    }
  });

  $('body').on('ajax:flash', function (e, flash) {
    var $target;
    var $flash_holder;
    var type;
    var message_i;
    var flash_class;
    var flash_class_mappings = {
      notice: 'success'
    };
    var html;
    var got_message = _.some(_.values(flash), function (msg) {
      return !!msg;
    });

    if (!got_message) {
      // sometimes ajax:flash is triggered with bad data
      return;
    }

    // Find or create the flash-message holder
    $target = $(e.target);
    if ($target.has('.modal-body').length < 1) {
      $target = $('body');
    }
    $flash_holder = $target.find('.flash');

    if ($flash_holder.length === 0) {
      $flash_holder = $('<div class="flash"></div>');
      $target.find('.modal-body').prepend($flash_holder);
    } else {
      $flash_holder.empty();
    }

    for (type in flash) {
      if (flash.hasOwnProperty(type)) {
        if (flash[type]) {
          if (typeof (flash[type]) === 'string') {
            flash[type] = [flash[type]];
          }
          flash_class = flash_class_mappings[type] || type;

          html = ['<div class="alert alert-' + flash_class + '">',
            '<a href="#" class="close" data-dismiss="alert">x</a>'
            ];
          for (message_i in flash[type]) {
            if (flash[type].hasOwnProperty(message_i)) {
              html.push('<span>' + flash[type][message_i] + '</span>');
            }
          }
          html.push('</div>');
          $flash_holder.append(html.join(''));
        }
      }
    }
  });

  $('body').on('ajax:html', '.modal > form', function (e, html, xhr) {
    var sel = 'script[type=\'text/javascript\'], script[language=\'javascript\'], script:not([type])';
    var $frag = $(html);

    $frag.filter(sel).add($frag.find(sel)).each(function () {
      $(this).remove();
      setTimeout($(this).html(), 10);
    });
    $(this).find('.modal-body').html($frag);
  });
})(window.jQuery);
