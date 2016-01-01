/*!
    Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
    Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
    Created By: brad@reciprocitylabs.com
    Maintained By: brad@reciprocitylabs.com
*/

/* =========================================================
 * Extra scripts for beta designs
 * ========================================================= */

jQuery(function ($) {
  // render out templates function
  var renderExternalTmpl = function (item) {
    var file = '/design/templates/' + item.name;
    if ($(item.selector).length > 0) {
      $.when($.get(file)).done(function (tmplData) {
        $(item.selector).append(tmplData);
        // $.templates({ tmpl: tmplData });
        // $(item.selector).append($.render.tmpl(item.data));
      });
    }
  };
  var userHasPriviledge;

  renderExternalTmpl({name: 'selectorSectionToControl', selector: '#templates', data: {}});
  renderExternalTmpl({name: 'selectorSectionToControlNA', selector: '#templates', data: {}});

  $(document).on('click', '#expand_all', function (event) {
    // $('.row-fluid-slotcontent').show("fast");
    $('.row-fluid-slotcontent').addClass('in');
    $('.expander').addClass('toggleExpanded');
  });

  $(document).on('click', '#shrink_all', function (event) {
    // $('.row-fluid-slotcontent').hide("fast");
    $('.row-fluid-slotcontent').removeClass('in');
    $('.expander').removeClass('toggleExpanded');
  });

  /* Checkbutton in modals widget function */
  $(document).on('click', '.checkbutton', function (event) {
    $(this).children('i').toggleClass('grcicon-blank');
    $(this).children('i').toggleClass('grcicon-x-grey');
  });

  /* Toggle widget function */
  $(document).on('click', '.accordion-toggle', function (event) {
    $(this).children('i').toggleClass('grcicon-blue-expand');
  });

  /* Toggle slot function */
  // Handled by rotation of expander icon
  /* $(document).on("click", ".toggle", function(event){
    $(this).children(".expander").toggleClass("toggleExpanded");
  }); */

  $(document).on('click', '.expandAll', function (event) {
    // $("h3.trigger").toggleClass("active").next().slideToggle("fast");
    $(this).children('i').toggleClass('grcicon-blue-expand');
  });

  // Handle remove buttons
  $(document).on('click', '.removeCircleButton', function (event) {
    // alert("here");
    $('#confirmModal').on('hidden', function () {
      $(this).closest('.controlSlot').remove();
    });
    $('#confirmModal').modal('show');
  });

  /* no worky
    $(document).on("click", ".sluggroup", function(event){
      //alert("here");
      var $this = $(this);
      $('.sluggroup').removeClass('selected');
      $this.addClass('selected');
    });
*/

  $(document).on('click', '.greyOut', function (event) {
    $(this).closest('.singlecontrolSlot').remove();
  });

  $('.addpersonItem').click(function () {
    $('#modalpeopleList').append('<li class=\'controlSlot ui-draggable\'><div class=\'arrowcontrols-group\'> <div class=\'controls-type\'>Controls-Type</div><div class=\'controls-subtype\'> <a class=\'dropdown-toggle statustextred\' data-toggle=\'dropdown\' href=\'#\'>Select Role</a> <ul class=\'dropdown-menu dropdown-menusmall\'><li>Owner</li><li>User</li></ul> </div>  <div class=\'controls-subgroup\'>Controls-Subgroup</div></div><a class=\'personItem\'><div class=\'removeCircleButton fltrt\'><i class=\'gcmssmallicon-dash-white\'></i></div></a></li>');
  });

  $('.referenceItem').click(function () {
    $('#referenceList').append('<li class=\'controlSlot\'><a href=\'#\'><div class=\'circle fltrt\'><i class=\'gcmssmallicon-dash-white\'></i></div></a><span class=\'controls-group\'>Reference Type</span><br /><span class=\'controls-subgroup\'>Reference Item</span></li>');
  });

  $('#quicklinks a:last').tab('show');

  $('#myLock a').click(function (e) {
    e.preventDefault();
    $('#programinformationLocked').tab('hide');
    $('#programinformationUnlocked').tab('show');
  });

  // if includes a xpander we need to toggle it.
  $('body').on('click', '.grcicon-more', function (e) {
    var $this = $(this);
    var slotcontent = $this.closest('.slot')
      .find('.slottitle').attr('data-target');
    var $thisexpander = $this.closest('.slot').find('.expander');
  // bootstrap data toggle opens this one up, but ...

    e.preventDefault();

  // var title = $("em").attr("data-target");

    if (!$thisexpander.hasClass('in')) {
      $thisexpander.addClass('in');
      $(slotcontent).collapse('show');
    } else if ($thisexpander) {
      // $thisexpander.removeClass('in');
      // $(slotcontent).collapse('hide');
    }

    $('[id$=-more]').each(function (i) {
      var el = $(this);
      if (el.hasClass('in')) {
        // its open close it!
        el.collapse('hide');
      } else {
        // its already closed, relax.
        // We have an isue with items on their way to closing and you clicked another, so checking for animating...
        el.filter(':animated').toggleClass('in');
      }
    });
  });

  // show/hide widget

  $('body').on('click', '.widget-trigger', function (e) {
    var $this = $(this);
    var $widgetBody = $this.closest('.widget').find('.widget-body');
    var $icon = $this.find('i');
    e.preventDefault();

    if ($this.hasClass('active')) {
      $widgetBody.slideUp('fast');
      $this.removeClass('active');
      $icon
        .removeClass('icon-chevron-down')
        .addClass('icon-chevron-right');
    } else {
      $widgetBody.slideDown('fast');
      $this.addClass('active');
      $icon
        .removeClass('icon-chevron-right')
        .addClass('icon-chevron-down');
    }
  });

  // show/hide list item
  $('body').on('click', '.list-trigger', function (e) {
    var $this = $(this);
    var $listBody = $this.closest('.wlist-title').next();
    var $icon = $this.find('i');
    e.preventDefault();

    if ($this.hasClass('active')) {
      $listBody.slideUp('fast');
      $this.removeClass('active');
      $icon
        .removeClass('icon-chevron-down')
        .addClass('icon-chevron-right');
    } else {
      $listBody.slideDown('fast');
      $this.addClass('active');
      $icon
        .removeClass('icon-chevron-right')
        .addClass('icon-chevron-down');
    }
  });

  // nicer hover

  $('body').on('mouseenter', '.people-list li', function (e) {
    $(this).removeClass('.halfopacity');
    // $(this).find(".additional").slideDown("fast");
  });

  $('body').on('mouseleave', '.people-list li', function (e) {
    $(this).addClass('.halfopacity');
    // $(this).find(".additional").slideUp("fast");
  });

  $('body').on('click', '.people-list li', function (e) {
    if ($(this).find('.additional').hasClass('shown')) {

    } else {
      // brute force ugly
      $('.additional').slideUp('shown');
      $('.additional').removeClass('shown');
      $(this).find('.additional').slideDown('fast');
      $(this).find('.additional').addClass('shown');
    }
  });

  // add item in target list
  $('body').on('click', '.add-me', function (e) {
    var $this = $(this);
    var $icon = $this.find('i');
    var $itemToAdd = $this.closest('li');
    var $name = $itemToAdd.find('.name').html();
    var $company = $itemToAdd.find('.company').html();
    var $target = $this.closest('.modal-body').find('.target');
    var $unassignedItems = $('#unassignedElements');
    var $unassignedValue = parseInt($unassignedItems.html(), 10);
    var $additionalinfo = '';
    var $item2add = '';
    e.preventDefault();

    if ($this.closest('.modal-body')
      .find('#currentList').hasClass('category-list')) {
      $item2add = '<h6 class="itemstatus">Added</h6>';
      // Nothing
      // Pending approval, nothing in additional info
    } else if ($this.closest('.modal-body')
      .find('#currentList').hasClass('people-list')) {
      // We gave relationships
      // Pending approval, start-stop
      $item2add = '<div class="btn-group inline"> <a class="span7 btn btn-danger btn-mini dropdown-toggle nominheight fltrt" data-toggle="dropdown"> Select Relationship <span class="caret"></span> </a> <ul class="dropdown-menu"> <li> <a href="#" id="makeAccountable"> is Accountable for </a> </li> <li> <a href="#" id="makeResponsible"> is Responsible for </a> </li> </ul> </div>';
      $additionalinfo = '<div class="row-fluid additional"> <div class="span4"></div> <div class="span4"> <label>Start Date (Optional)</label> <input class="span12 date" id="datepicker-stopdate-rd" placeholder="MM/DD/YYYY" type="text"> </div> <div class="span4"> <label>Stop Date (Optional)</label> <input class="span12 date" id="datepicker-stopdate-rd" placeholder="MM/DD/YYYY" type="text"> </div>';
    } else if ($this.closest('.modal-body')
      .find('#currentList').hasClass('reference-list')) {
      // Will have assignment items, nothing now.
      // Pending approval, no start-stop
      $item2add = '<h6 class="itemstatus">Added</h6>';
    } else if ($this.closest('.modal-body')
      .find('#currentList').hasClass('system-list')) {
      // Will have assignment items, nothing now.
      // Pending approval, no start-stop
      $item2add = '<h6 class="itemstatus">Added</h6>';
    }
    $this
      .removeClass('widgetbtn addme')
      .addClass('widgetbtnoff'); // remove icon square around checkmark (not a button anymore)
    $icon
      .removeClass('grcicon-chevron-right')
      .addClass('grcicon-check-green');
    $target
      .prepend('<li class="new-item"> <div class="row-fluid"> <div class="span6"> <span class="company">' + $company + '</span> <span class="name">' + $name + '</span> </div> <div class="span6 actions">  <a class="widgetbtn pull-right" id="removeMe" href="#"> <i class="grcicon-remove"></i> </a> <a class="widgetbtn pull-right" href="#"> <i class="grcicon-edit"></i> </a> ' + $item2add + '</div> </div>' + $additionalinfo + ' </div> </li>')
      .find('li.new-item').hide().fadeIn('slow').removeClass('new-item');
    $unassignedItems
      .html($unassignedValue + 1).fadeIn();

    $('.itemstatus').effect('pulsate', {times: 3}, 800);
    $('.itemstatus').removeClass('itemstatus');
  });

  // show filters in modals

  $('body').on('click', '#makeAccountable', function (e) {
    e.preventDefault();
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').html('is Accountable');
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').removeClass('btn-warning');
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').addClass('btn-success');

    $(this).closest('.btn-group')
      .find('.dropdown-toggle').addClass('halfopacity');
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').removeClass('btn-info');
  });

  $('body').on('click', '#makeResponsible', function (e) {
    e.preventDefault();
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').html('is Responsible');
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').removeClass('btn-warning');
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').addClass('btn-success');

    $(this).closest('.btn-group')
      .find('.dropdown-toggle').addClass('halfopacity');
    $(this).closest('.btn-group')
      .find('.dropdown-toggle').addClass('btn-info');
  });

  $(document).on('click', '#removeMe', function (event) {
    event.preventDefault();
    $(this).closest('li').slideUp('slow', function () {
      jQuery(this).remove();
    });
  });

  $('body').on('click', '#showFilters', function (e) {
    var $this = $(this);
    var $filters = $this.closest('.modal-body').find('.filter-group');
    var $searchableLists = $this.closest('.modal-body')
      .find('.filter-block .people-list');
    e.preventDefault();

    if ($this.hasClass('active')) {
      $filters.hide();
      $this.removeClass('active');
      $searchableLists.removeClass('short');
    } else {
      $filters.show();
      $this.addClass('active');
      $searchableLists.addClass('short');
    }
  });

  $('body').on('click', '#showCategories', function (e) {
    var $this = $(this);
    var $filters = $this.closest('.modal-body').find('.category-group');
    var $searchableLists = $this.closest('.modal-body')
      .find('.filter-block .people-list');
    e.preventDefault();

    if ($this.hasClass('active')) {
      $filters.hide();
      $this.removeClass('active');
      $searchableLists.removeClass('short');
    } else {
      $filters.show();
      $this.addClass('active');
      $searchableLists.addClass('short');
    }
  });

  $('body').on('click', '#showGRCDirectory', function (e) {
    var $this = $(this);
    var $categoryfilters = $this.closest('.modal-body').find('.category-group');
    var $companyfilters = $this.closest('.modal-body').find('.filter-group');
    var $searchableLists = $this.closest('.modal-body')
      .find('.filter-block .people-list');
    e.preventDefault();

    $categoryfilters.show();
    $companyfilters.hide();
    $this.addClass('active');
    $('#filterButton').html('GRC Directory <span class=\'caret\'></span>');
    $searchableLists.removeClass('shortest');
    $searchableLists.addClass('short');
    // }
  });

  $('body').on('click', '#showCompanyDirectory', function (e) {
    var $this = $(this);
    var $categoryfilters = $this.closest('.modal-body').find('.category-group');
    var $companyfilters = $this.closest('.modal-body').find('.filter-group');
    var $searchableLists = $this.closest('.modal-body')
        .find('.filter-block .people-list');
    e.preventDefault();

    // if( $this.hasClass("active") ) {
    // $filters.hide();
    // $this.removeClass("active");
    // $searchableLists.removeClass("short");
    // } else {
    $categoryfilters.hide();
    $companyfilters.show();
    $this.addClass('active');
    $('#filterButton').html('Company Directory <span class=\'caret\'></span>');
    $searchableLists.addClass('shortest');
    $searchableLists.removeClass('short');
    // }
  });

  // status js
  userHasPriviledge = true;
  $('body').on('click', '#actionButton', function (e) {
    var fullDate = new Date();
    var twoDigitMonth = ((fullDate.getMonth().length + 1) === 1) ?
      (fullDate.getMonth() + 1) : '0' + (fullDate.getMonth() + 1);
    var currentDate = fullDate.getDate() + '/' + twoDigitMonth + '/' + fullDate.getFullYear();

    var $this = $(this);
    var $alert = $this.closest('.modal').find('.alert');
    var $date = $this.closest('.modal').find('#updatedDate');
    var $alertMessage = $this.closest('.modal').find('#alertMessage');
    var $status = $this.closest('.modal').find('#statusValue');
    var $currentStatus = $this.closest('.modal').find('#statusValue').html();
    e.preventDefault();

    if (userHasPriviledge) {
      if ($currentStatus === 'Draft') {
        $status
          .html('Waiting for Approval')
          .addClass('statustextred');
        $alertMessage
          .html('New Program has been saved. Waiting on Approval.');
        $alert
          .fadeIn();
        $this
          .html('Approve');
        $date
          .html(currentDate);
      } else if ($currentStatus === 'Waiting for Approval') {
        $status
          .html('Approved')
          .removeClass('statustextred');
        $alertMessage
          .html('Program has been approved.');
        $alert
          .fadeIn();
        $this
        .addClass('disabled');
        window.location = '/programs/1';
      }
    }
  });
});

function toggleGovernance() {
  var interval = 200;
  $('.govWidget').each(function (i) {
    var el = $(this);
    if (el.hasClass('active')) {
      $('#grcbutton-governance').addClass('halfopacity').removeClass('active');
      $.cookie('toggle_governance', null);
      el.delay(i * interval).slideUp(interval);
      el.removeClass('active');
    } else {
      $('#grcbutton-governance').removeClass('halfopacity').addClass('active');
      $.cookie('toggle_governance', '1', {expires: 1, path: '/'});
      el.delay(i * interval).slideDown(interval);
      el.addClass('active');
    }
  });
}

jQuery(function ($) {
  if ($.cookie('toggle_governance') === '1') {
    toggleGovernance();
  } else {
    $('.govWidget').hide();
  }

  $('body').on('click', '#grcbutton-governance', function (e) {
    toggleGovernance();
    e.preventDefault();
  });
});

$(document).load(function () {
  $('#program_start_date').hide();
});
