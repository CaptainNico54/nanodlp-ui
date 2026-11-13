/* Resin editor navigation protection. This file is loaded only by the resin
   editor templates, after the existing field initialization scripts. */
(function (window, document, $) {
    'use strict';

    function snapshot(forms) {
        return JSON.stringify(forms.map(function (form) {
            return Array.prototype.filter.call(form.elements, function (field) {
                return /^(INPUT|TEXTAREA|SELECT)$/.test(field.tagName) &&
                    !/^(submit|button|reset|image)$/.test(field.type) &&
                    (field.name || (field.id && field.type !== 'hidden'));
            }).map(function (field) {
                var value = field.value;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    value = [field.checked, value];
                } else if (field.tagName === 'SELECT' && field.multiple) {
                    value = Array.prototype.filter.call(field.options, function (option) {
                        return option.selected;
                    }).map(function (option) { return option.value; });
                } else if (field.type === 'file') {
                    value = Array.prototype.map.call(field.files || [], function (file) {
                        return [file.name, file.size, file.type, file.lastModified];
                    });
                } else if (/^(number|range)$/.test(field.type) && value !== '' && isFinite(Number(value))) {
                    // Formatting 1 as 1.00 is not an edit to a numeric setting.
                    value = Number(value);
                }
                return [field.name, field.id, field.type, value, !!(field.validity && field.validity.badInput)];
            });
        }));
    }

    function initialize() {
        var forms = Array.prototype.filter.call(document.querySelectorAll('form[data-resin-editor-form]'), function (form) {
            // The main template contains both normal and service-mode editors.
            // Keep hidden advanced fields within the active form in the snapshot.
            return !form.classList.contains('hidden');
        });
        if (!forms.length) return;

        var initial = snapshot(forms);
        var submission = null;
        var confirmed = null;
        var message = 'You have unsaved changes to this resin profile. Leave without saving?';

        function clearPermission() {
            submission = null;
            confirmed = null;
        }

        function hasChanges() {
            // Read the fields at the time of navigation. The formula editor also
            // writes values programmatically without firing input/change events.
            return snapshot(forms) !== initial;
        }

        window.c3dResinEditorGuard = {
            hasChanges: hasChanges,
            confirmLeave: function () {
                var current = snapshot(forms);
                if (current === initial) return true;
                if (!window.confirm(message)) return false;
                confirmed = current;
                return true;
            }
        };

        // A new edit/navigation attempt must not reuse a previous Save or Leave.
        ['input', 'change', 'click', 'keydown'].forEach(function (type) {
            document.addEventListener(type, clearPermission, true);
        });
        window.addEventListener('pageshow', clearPermission);

        window.addEventListener('submit', function (event) {
            var form = event.target;
            if (forms.indexOf(form) === -1 || event.defaultPrevented) return;
            var target = (event.submitter && event.submitter.getAttribute('formtarget')) || form.getAttribute('target') || '_self';
            if (target.toLowerCase() !== '_self') return;

            // Native validation happens before submit. Observe the event at the
            // end of bubbling, after Athena's existing serialization handlers.
            // Never mark the profile saved before the server returns a new page.
            var pending = { event: event, state: snapshot(forms) };
            submission = pending;
            window.setTimeout(function () {
                if (submission === pending) submission = null;
            }, 1000);
        });

        window.addEventListener('beforeunload', function (event) {
            var current = snapshot(forms);
            var pending = submission;
            var allowed = confirmed === current || (pending && !pending.event.defaultPrevented && pending.state === current);
            clearPermission();
            if (allowed || current === initial) return;
            event.preventDefault();
            // Browsers choose the dialog text. returnValue supports older HMIs.
            event.returnValue = message;
        });
    }

    $(function () {
        // jQuery 1.x ready runs before Athena's native DOMContentLoaded PWM
        // conversion. Defer one turn to include it and the other initializers.
        window.setTimeout(initialize, 0);
    });
})(window, document, jQuery);
