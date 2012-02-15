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

// Property view widget

(function($, undefined) {

    $.widget('gb.propertyView', {

        options: {
            model: null,
        },

        _create: function() {
            var o = this.options,
                e = this.element;

            o.designReset = this._designResetHander;
            o.selectionChanged = this._selectionChangedHander;
            o.activePageChanged = this._activePageChangedHander;
            o.modelChanged = this._modelChangedHander;

            // FIXME: This should work, but $.extend of options seems to be
            //        creating a copy of the ADM, which will not containt the
            //        same nodes and events as the master
            //o.model = o.model || ADM || undefined;
            if (o.model) {
                this._bindADMEvents(o.model);
            }

            $('<div/>').addClass(this.widgetName)
                .appendTo(this.element);

            $('<div id="property_content"></div>').appendTo(this.element);

            this.options.primaryTools = this._createPrimaryTools();
            this.options.secondaryTools = this._createSecondaryTools();

            return this;
        },

        _setOption: function(key, value) {
            switch (key) {
                // Should this REALLY be done here, or plugin registration in
                // the "host"... using the functions mapped in widget options?
                case 'model':
                    this._unbindADMEvents(value);
                    this._bindADMEvents(value);
                    this.options.model = value;
                    break;
                default:
                    break;
            }
        },

        destroy: function() {
            // TODO: unbind any ADM event handlers
            $(this.element).find('.'+this.widgetName).remove();
            this.options.primaryTools.remove();
            this.options.secondaryTools.remove();
        },

        refresh: function(event, widget) {
            widget = widget || this;
            if(event) {
                widget._showProperties(event);
            }
        },

        // Private functions
        _createPrimaryTools: function() {
            return $(null);
        },

        _createSecondaryTools: function() {
            return $(null);
        },

        _bindADMEvents: function(a) {
            var d = a && a.getDesignRoot();
            a.bind("designReset", this._designResetHandler, this);
            a.bind("selectionChanged", this._selectionChangedHandler, this);
            a.bind("activePageChanged", this._activePageChangedHandler, this);
            d.bind("modelUpdated", this._modelUpdatedHandler, this);
        },

        _unbindADMEvents: function(a) {
            var d = a && a.getDesignRoot();
            a.unbind("designReset", this._designResetHandler, this);
            a.unbind("selectionChanged", this._selectionChangedHandler, this);
            a.unbind("activePageChanged", this._activePageChangedHandler, this);
            d.unbind("modelUpdated", this._modelUpdatedHandler, this);
        },

        _designResetHandler: function(event, widget) {
            widget = widget || this;
            widget._unbindADMEvents(this.options.model);
            widget._bindADMEvents(ADM.getDesignRoot());
            widget.refresh(event,widget);
        },

        _selectionChangedHandler: function(event, widget) {
            widget = widget || this;
            widget.refresh(event,widget);
        },

        _activePageChangedHandler: function(event, widget) {
            widget = widget || this;
            widget.refresh(event,widget);
        },

        _modelUpdatedHandler: function(event, widget) {
            widget = widget || this;
            widget.refresh(event,widget);
        },

        _showProperties: function(event) {
            var node = event.node,
                showUid = false,
                labelId, labelVal, valueId, valueVal;

            // Clear the properties pane when nothing is selected
            if (node === null || node === undefined) {
                node = ADM.getActivePage();
                if (node === null || node === undefined) {
                    $('#property_content').empty()
                        .append('<label>Nothing Selected</label>');
                    return;
                }
            }

            $('#property_content').empty()
                .append('<table><tr><td colspan="2">' +
                        '<span id="property_title">' +
                        BWidget.getDisplayLabel(node.getType()) +
                        '</span>' +
                        (showUid ? ' (uid=' + node.getUid() + ')' : '') +
                        '</td></tr></table>');

            var props = node.getProperties();
            var options = node.getPropertyOptions();
            for (var p in props) {
                if (p == "type_label" ||
                    p == "conditional_label" ||
                    p == "conditional_for") {
                    continue;
                } else if (p == "type") {
                    labelVal = node.getProperty("type_label");
                } else if (p == "conditional") {
                    if (node.getProperty("conditional_for") !=
                        node.getProperty("type")) {
                        continue;
                    }
                    labelVal = node.getProperty("conditional_label");
                } else {
                    labelVal = p.replace(/_/g,'-');
                }
                labelId = p+'-label';
                valueId = p+'-value';
                valueVal = props[p];
                if (options[p]) {
                    var code = '<tr><th id="' + labelId + '">' + labelVal +
                               '</th>' + '<td width="100%">' +
                               '<select id="' + valueId + '">';
                    for (var o in options[p]) {
                        if (options[p][o] == props[p]) {
                            code += '<option value="' + options[p][o] +
                                    '" selected=true>' + options[p][o] +
                                    '</option>';
                        } else {
                            code += '<option value="' + options[p][o] + '">' +
                                    options[p][o] + '</option>';
                        }
                    }
                    code += '</select>' + '</td></tr>';
                    $('#property_content').children().last().append(code);
                } else {
                    $('#property_content').children().last()
                        .append('<tr><th id="' + labelId + '">' + labelVal +
                                '</th>' +
                                '<td>' +
                                '<input class="full" id="' + valueId + '" />' +
                                '</td></tr>');
                    $('#'+valueId).val(valueVal);
                }
                $('#' + valueId).change(node, function (event) {
                    var updated = event.srcElement.id.replace(/-value/,''),
                        node = event.data,
                        value = null,
                        element = $('#'+event.srcElement.id);

                    if (node === null || node === undefined) {
                        console.error('Missing node, property change failed!');
                        return;
                    }

                    switch (BWidget.getPropertyType(node.getType(), updated)) {
                        case 'boolean':
                            value = Boolean(element.val());
                            break;
                        case 'float':
                            value = parseFloat(element.val());
                            break;
                        case 'integer':
                            value = parseInt(element.val(), 10);
                            break;
                        case 'number':
                            value = Number(element.val());
                            break;
                        case 'object':
                            value = Object(elementval());
                            break;
                        case 'string':
                            value = String(element.val());
                            break;
                        default:
                            break;
                    }
                    node.setProperty(updated, value);
                });
            }

            $('table','#property_content').attr({ 'cellspacing': '0' });
            $('th:odd, td:odd','#property_content')
                .css({ 'border-top': '1px solid black',
                       'border-bottom': '1px solid black' });
            $('td','#property_content').attr('align','left');
            $('th','#property_content').attr('align','left')
                .addClass('ui-helper-reset ui-state-default');
        },
    });
})(jQuery);