/*
 * gui-builder - A simple WYSIWYG HTML5 app creator
 * Copyright (c) 2011, Intel Corporation.
 *
 * This program is licensed under the terms and conditions of the
 * Apache License, version 2.0.  The full text of the Apache License is at
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 */
"use strict";

// Fixes PTSDK-130: Block right-click context menu in design-view iframe
if (!top.$.gb.options || !top.$.gb.options.debug)
    $(document).bind('contextmenu', function(e) { e.preventDefault(); });

// In order to get the very first instance of page change events,
// the bind must occur in the jQM mobileinit event handler
$(document).bind('mobileinit', function() {
    $.mobile.defaultPageTransition = 'none';
    $.mobile.loadingMessage = false;

    // Make sure to sync up the ADM anytime the page changes in jQM
    $('div').live('pageshow', function(e) {
        var pageId = $(this).data('uid'),
            node = (window.parent !== window)?window.parent.ADM.getDesignRoot().findNodeByUid(pageId):null,
            currentPage = (window.parent !== window)?window.parent.ADM.getActivePage():null;

        // No change so do nothing
        if (currentPage && currentPage.getUid() === pageId) {
            return;
        }

        if (node) {
            window.parent.ADM.setActivePage(node);
        }
    });
});

$(function() {
    var handleSelect = function (e, ui){
        if ($(ui).data('role') === 'content' ||
            $(ui).data('role') === 'page') {
            setSelected(null);
        } else if (!$(ui).hasClass('ui-selected')) {
            setSelected(ui);
        } else if (e.ctrlKey) {
            setSelected(null);
        }
        e.stopPropagation();
        return false;  // Stop event bubbling
    }

    // Attempt to add child, walking up the tree until it
    // works or we reach the top
    var addChildRecursive = function (parentId, type, dryrun) {
        var adm = window.top.ADM, node;

        if (parentId && type) {
            node = adm.addChild(parentId, type, dryrun);
            if (!node) {
                var parent = adm.getDesignRoot().findNodeByUid(parentId),
                    gParent = parent.getParent();
                if (gParent) {
                    return addChildRecursive(gParent.getUid(), type, dryrun);
                } else {
                    return node;
                }
            }
        }
        return node;
    };

    window.handleSelect = handleSelect;
    $('div:jqmData(role="page")').live('pageinit', function(e) {
        var targets,
            debug = (window.top.$.gb &&
                     window.top.$.gb.options &&
                     window.top.$.gb.options.debug),

            debugOffsets = (window.top.$.gb &&
                     window.top.$.gb.options &&
                     window.top.$.gb.options.debug &&
                     window.top.$.gb.options.debug.offsets),

            trackOffsets = function (msg, ui, data) {
                var o = ui && ui.offset,
                    p = ui && ui.position,
                    d = data && data.offset,
                    c = d && d.click;

                if (!debugOffsets) return;

                msg = msg || 'offsets:';

                if (o) { msg += '\t| ' + o.left+','+o.top; }
                    else { msg += '\t|       ' }
                if (p) { msg += '\t|' + p.left+','+p.top; }
                    else { msg += '\t|       ' }
                if (d) { msg += '\t|' + d.left+','+d.top; }
                    else { msg += '\t|       ' }
                if (c) { msg += '\t|' + c.left+','+c.top; }
                    else { msg += '\t|       ' }

                console.log(msg);
            };


        // Unbind *many* event handlers generated by jQM:
        // - Most we don't need or want to be active in design view
        // - Some we do (collapsible "expand" and "collapse" for example
        $(document).unbind('click vmousedown vmousecancel vmouseup'
                         + 'vmouseover focus vmouseout blur');

        $('.adm-node:not(.delegation),.orig-adm-node').each ( function (index, node) {
            var admNode, widgetType, delegate, events,
                delegateNode,
                adm = window.parent.ADM,
                bw = window.parent.BWidget;

            delegateNode = $(node);
            if (adm && bw) {
                admNode = adm.getDesignRoot()
                    .findNodeByUid($(node).attr('data-uid')),
                widgetType = admNode.getType(),
                delegate = bw.getWidgetAttribute(widgetType, 'delegate'),
                events = bw.getWidgetAttribute(widgetType, 'events');

                if (delegate) {
                    if (typeof delegate === "function") {
                        delegateNode = delegate($(node), admNode);
                    } else {
                        switch (delegate){
                        case "next":
                            delegateNode =  $(node).next();
                            break;
                        case "grandparent":
                            delegateNode =  $(node).parent().parent();
                            break;
                        case "parent":
                            delegateNode =  $(node).parent();
                            break;
                        default:
                            delegateNode = $(node);
                        }
                    }
                }

                // Move the adm-node class to the delegateNode and assign
                // data-uid to it so that in sortable.stop we can always get
                // it from ui.item.
                if (node !== delegateNode[0]) {
                    $(node).addClass('orig-adm-node');
                    $(node).removeClass('adm-node');
                    delegateNode.addClass('adm-node');
                    delegateNode.addClass('delegation');
                    delegateNode.attr('data-uid', $(node).attr('data-uid'));
                }

                // Configure "select" handler
                delegateNode.click( function(e) {
                    return handleSelect(e, this);
                });

                if (events) {
                    $(node).bind(events);
                }
            }
        });

        // Configure "sortable" behaviors
        targets = $('.nrc-sortable-container,[data-role="page"]');

        // Fixup "Collapsible" to make the content div jQM adds at runtime
        // be a "sortable" as well
        $('.ui-collapsible-content').addClass('nrc-sortable-container');
        targets.add('.ui-collapsible-content');

        debug && console.log("Found ["+targets.length+"] sortable targets: ");

        targets
            .sortable({
                distance: 5,
                forceHelperSize: true,
                forcePlaceholderSize: true,
                placeholder: 'ui-sortable-placeholder',
                tolerance: 'pointer',
                appendTo: 'body',
                connectWith: '.nrc-sortable-container',
                cancel: '> :not(.adm-node)',//,select',
                items: '> *.adm-node',
                start: function(event, ui){
                    $(this).addClass('ui-state-active');
                    trackOffsets('start:   ',ui,$(this).data('sortable'));
                },
                over: function(event, ui){
                    $(this).addClass('ui-state-active');
                    trackOffsets('over:    ',ui,$(this).data('sortable'));
                },
                out: function(event, ui){
                    $(this).removeClass('ui-state-active');
                    trackOffsets('out:     ',ui,$(this).data('sortable'));
                },
                receive: function(event, ui){
                    // XXX: workaround for loss of $.data context when the
                    //      draggable connectToSortable plugin clones the
                    //      ui.item and places it into the sortable...
                    $(this).data('received', ui.item.data());
                    trackOffsets('receive: ',ui,$(this).data('sortable'));
                },
                stop: function(event, ui){
                    trackOffsets('stop:    ',ui,$(this).data('sortable'));
                    var type, isDrop,
                        pid = $(this).attr('data-uid'),
                        node = null,
                        adm = window.parent.ADM,
                        bw = window.parent.BWidget,
                        root = adm.getDesignRoot(),
                        node, zones, newParent,
                        rdx, idx, cid, pid, sid,
                        sibling, children, parent,
                        role, received;

                    role = $(this).attr('data-role') || '';

                    function childIntersects(that) {
                        var intersects = false,
                            s = $(that).find(':data(sortable)')
                                       .not('.ui-sortable-helper');
                        s.each( function(i) {
                            var inst = $.data(this, 'sortable');
                            // Find contained sortables with isOver set
                            if (inst.isOver) {
                                intersects = true;
                                return false;
                            }
                        });
                        return intersects;
                    };

                    $(this).removeClass('ui-state-active');

                    if (!ui.item) return;

                    isDrop = ui.item.hasClass('nrc-palette-widget');
                    received = $(this).data('received');

                    // Let child containers get the drop if they intersect
                    if (childIntersects(this)) {
                        if (isDrop && received) {
                            //received.data('draggable').cancel();
                            $(received.draggable).draggable('cancel');
                        } else {
                            $(this).sortable('cancel');
                        }
                        ui.item.remove();
                        return false;
                    }

                    // Drop from palette: add a node
                    if (isDrop) {
                        if (!received) {
                            ui.item.remove();
                            return false;
                        }

                        if (received.admNode) {
                            type = received.admNode.type;
                        }

                        if (!type) {
                            console.warn('Drop failed: Missing node type');
                            ui.item.remove();
                            return false;
                        }

                        children = $(this).children('.adm-node')
                                          .add(ui.item);
                        idx = children.index(ui.item);

                        // Append first(only)/last child to this container
                        if (idx >= children.length-1 || role === 'page') {
                            if (adm.addChild(pid, type, true)) {
                                node = adm.addChild(pid, type);
                                debug && console.log('Appended node',role);
                                if (node) adm.setSelected(node.getUid());
                            } else {
                                console.warn('Append child failed:',role);
                            }
                        } else if (idx > 0) {
                            // Insert nth child into this container
                            sibling = $(ui.item, this).prev('.adm-node');
                            sid = sibling.attr('data-uid');
                            if (adm.insertChildAfter(sid, type, true)) {
                                node = adm.insertChildAfter(sid, type);
                                debug && console.log('Inserted nth node',role);
                                if (node) adm.setSelected(node.getUid());
                            } else {
                                console.warn('Insert nth child failed:',role);
                            }
                        } else {
                            // Add 1st child into an empty container
                            if (children.length-1 <= 0) {
                                if (adm.addChild(pid, type, true)) {
                                    node = adm.addChild(pid, type);
                                    debug && console.log('Added 1st node',role);
                                    if (node) adm.setSelected(node.getUid());
                                } else {
                                    console.warn('Add 1st child failed:',role);
                                }
                            } else {
                                // Insert 1st child into non-empty container
                                sibling = $(this).children('.adm-node:first');
                                sid = sibling.attr('data-uid');
                                if (adm.insertChildBefore(sid, type, true)) {
                                    node = adm.insertChildBefore(sid, type);
                                    debug && console.log('Inserted 1st node',role);
                                    if (node) adm.setSelected(node.getUid());
                                } else {
                                    console.warn('Insert 1st child failed:',role);
                                }
                            }
                        }
                        ui.item.remove();
                        return;

                    // Sorted from layoutView: move a node
                    } else {
                        idx = ui.item.parent().children('.adm-node')
                                              .index(ui.item);
                        cid = ui.item.attr('data-uid');
                        pid = ui.item.parent().attr('data-uid');
                        node = root.findNodeByUid(cid);
                        newParent = root.findNodeByUid(pid);
                        zones = bw.getZones(newParent.getType());

                        // Notify the ADM that element has been moved
                        if ((zones && zones.length===1 &&
                                      zones[0].cardinality!=='1') ||
                            (newParent && newParent.getType() === 'Header')) {
                            if (!node ||
                                !adm.moveNode(node, newParent, zones[0],
                                              idx)) {
                                console.warn('Move node failed');
                            } else {
                                debug && console.log('Moved node');
                                if (node) adm.setSelected(node.getUid());
                            }
                        } else {
                            console.warn('Move node failed: invalid zone');
                        }
                    }
/*
                },
                custom: {
                    refreshContainers: function() {
                        for (var i = this.containers.length - 1; i >= 0; i--){
                            var wo = top.getOffsetInWindow(
                                         this.containers[i].element[0]
                                         .ownerDocument.documentElement,top),
				p = this.containers[i].element.offset();

                            this.containers[i].containerCache.left =
                                 p.left + wo.left;
                            this.containers[i].containerCache.top =
                                 p.top + wo.top;
                            this.containers[i].containerCache.width =
                                 this.containers[i].element.outerWidth();
                            this.containers[i].containerCache.height =
                                 this.containers[i].element.outerHeight();
                            trackOffsets('cache['+i+']:',
                                 { offset: {left: wo.left, top:wo.top}});
                        };
                    }
*/
                }
            })
            .disableSelection();

        var inputs = targets.find('input');
        $(inputs).disableSelection();

        // Fixup "Collapsible" to make the content div be marked as empty,
        // not it's toplevel element
        $('.ui-collapsible.nrc-empty').each (function () {
            $(this).removeClass('nrc-empty')
                   .find('.ui-collapsible-content')
                       .addClass('nrc-empty');
        });

        // Populate empty nodes with a "hint" to drop things there
        $('.nrc-empty').each( function() {
            if ($('.nrc-hint-text', this).length === 0) {
                $(this).append('<p class="nrc-hint-text">Drop target...</p>');
            }
        });
    });

    $('div:jqmData(role="page")').live('pageshow', function(e) {
        // Make sure selected node is visible on pageinit
        $('.ui-selected:first').each(function () {
            $.mobile.silentScroll($(this).offset().top);
        });
    });

    // Allow for deletion of selected widget
    $(document).keyup(function(e) {
        if (e.which === 46) {
            $('.ui-selected').each( function () {
                var id = $(this).attr('data-uid');
                window.parent.ADM.removeChild(id);
            });
        }
    });
    // Watch our parent document also
    $(top.document).keyup(function(e) {
        if (e.which === 46 && !$(this.activeElement).is('input')) {
            $('.ui-selected').each( function () {
                var id = $(this).attr('data-uid');
                window.parent.ADM.removeChild(id);
            });
        }
    });


    function messageHandler(e) {
        switch (e.data) {
            case 'reload':
                reloadPage();
                break;
            case 'refresh':
                refreshPage();
                break;
            default:
                console.warn('Unknown request: '+e.data);
                break;
        }
    }

    window.addEventListener('message', messageHandler, false);

    function reloadPage() {
        $('.nrc-dropped-widget').each( function () {
            // Hide the hint text
            $(this).parent().children('.nrc-hint-text').remove();

            // Remove this class to prevent "create"ing more than once
            $(this).removeClass('nrc-dropped-widget');

            // TODO: Add better and more complete handling of this
            // Disable Text widgets so they are selectable but not editable
            if (this.nodeName == "INPUT" && this.type == "text") {
                this.readOnly=true;
            }
        });
        var aPage = top.ADM.getActivePage();
        if (aPage) {
            $.mobile.changePage($('#' + aPage.getProperty('id')));
        } else {
            $.mobile.initializePage();
        }
    }

    function refreshPage() {
        $('.nrc-dropped-widget').each( function () {
            // Hide the hint text
            $(this).parent().children('.nrc-hint-text').fadeOut();

            // Force jQM to call the init on the dropped widget
            // letting it determined styling, not us!
            $(this).closest('.ui-page').page();

            // Remove this class to prevent "create"ing more than once
            $(this).removeClass('nrc-dropped-widget');

            // TODO: Add better and more complete handling of this
            // Disable Text widgets so they are selectable but not editable
            if (this.nodeName == "INPUT" && this.type == "text") {
                this.readOnly=true;
            }
        });
    }

    function setSelected(item) {
        var selectedItems = $('.ui-selected'),
            adm = window.parent.ADM;
        /*
           In the context of this "onclick()" handler, the following
           rules are being applied:

           IF any items are selected THEN
               DESELECT all of them
           SELECT the clicked item

           TODO: Figure out how we want to UNSELECT all without making
                 any selection, or by making "click" toggle the items
                 selection state
         */

        if (selectedItems.length) {
            // Mark all selectees as unselect{ed,ing}
            $(selectedItems).removeClass('ui-selected')
                            .removeClass('ui-selecting')
                            .removeClass('ui-unselecting');
        }

        // Mark this selectee element as being selecting
        $(item).removeClass('ui-unselecting')
               .removeClass('ui-selecting')
               .addClass('ui-selected');

        adm.setSelected((item?$(item).attr('data-uid'):item));
    }
});
