SimpleV = function(form, options) {

	// prevent skipping the constructor
	if (!(this instanceof SimpleV)) {

		return new SimpleV(form, options);
	}

	var self = this;

	// allowed extra validations
	this._validationTypes = [
		'email'
	];

	// storage for transformed directives
	this._cache = [];

	// global counter to identify each input
	this._cacheTracking = -1;

	// track elements with a "name" attribute to share directives among them
	this._groupNames = {};

	/* BEGIN public methods */

		this.validate = function() {

			var result = true;
			var elements, elementCount, i;
			var firstElementWithReason = null;

			/* BEGIN: <input> */

				elements 		= self.form.getElementsByTagName('input');
				elementCount 	= elements.length;

				for (i = 0; i < elementCount; i++) {

					switch (elements[i].type) {

						case 'text':
						case 'password':
						case 'search':

							if (jQuery(elements[i]).is(':visible') === false) {

								if (self.options.log === true) { console.warn('SimpleV: Element not visible. Element will not be validated.', elements[i]); }
								continue;
							}

							if (self._validateText(elements[i], true) === false) {

								if (firstElementWithReason === null) { firstElementWithReason = elements[i]; }
								result = false;
							}
							break;

						case 'checkbox':
						case 'radio':

							if (jQuery(elements[i]).is(':visible') === false) {

								if (self.options.log === true) { console.warn('SimpleV: Element not visible. Element will not be validated.', elements[i]); }
								continue;
							}

							if (self._validateDecision(elements[i], true) === false) {

								if (firstElementWithReason === null) { firstElementWithReason = elements[i]; }
								result = false;
							}
							break;
					}
				}

			/* END: <input> */

			/* BEGIN: <textarea> */

				elements 		= self.form.getElementsByTagName('textarea');
				elementCount 	= elements.length;

				for (i = 0; i < elementCount; i++) {

					if (jQuery(elements[i]).is(':visible') === false) {

						if (self.options.log === true) { console.warn('SimpleV: Element not visible. Element will not be validated.', elements[i]); }
						continue;
					}

					if (self._validateText(elements[i], true) === false) {

						if (firstElementWithReason === null) { firstElementWithReason = elements[i]; }
						result = false;
					}
				}

			/* END: <textarea> */

			/* BEGIN: <select> */

				elements 		= self.form.getElementsByTagName('select');
				elementCount 	= elements.length;

				for (i = 0; i < elementCount; i++) {

					if (jQuery(elements[i]).is(':visible') === false) {

						if (self.options.log === true) { console.warn('SimpleV: Element not visible. Element will not be validated.', elements[i]); }
						continue;
					}

					if (self._validateDecision(elements[i]) === false) {

						if (firstElementWithReason === null) { firstElementWithReason = elements[i]; }
						result = false;
					}
				}

			/* END: <select> */

			if ((result === false) && (self.options.scrollIntoView === true)) {

				// scroll up to the first reason, in case the reason is not within viewport
				if ((firstElementWithReason !== null) && (self._isElementInViewport(firstElementWithReason) === false)) {

					if (self.options.log === true) { console.info('SimpleV: First element not passing validation is not visible in the current viewport. Scrolling into view...', firstElementWithReason); }
					self._scrollIntoView(firstElementWithReason);
				}
			}

			return result;
		};

	/* END: public methods */

	/* BEGIN: public callbacks */

		this.onValid 	= null;
		this.onInvalid 	= null;

	/* END: public callbacks */

	/* BEGIN: private methods */

		this._prepareElement = function(element) {

			var plainDir = element.getAttribute('data-v');
			if (plainDir === null) { return false; }

			// groupable element
			if ((typeof element.name === 'string') && (element.name.length > 0)) {

				if (typeof self._groupNames[element.name] !== 'object') {

					self._groupNames[element.name] = element;

				} else {

					if (self.options.log === true) { console.info('SimpleV: Element shares the "name" attribute with an already prepared element. Directives can only be declared once.', element); }
					return false;
				}
			}

			if ((typeof plainDir !== 'string') || plainDir.length === 0) {

				if (self.options.log === true) { console.warn('SimpleV: No directives found. Element will not be validated.', element); }
				return false;
			}

			var dir = self._transformDirectives(plainDir);
			if (dir === null) {

				if (self.options.log === true) { console.error('SimpleV: Invalid directives encountered. Element will not be validated.', element); }
				return false;
			}

			// set maxlength attribute
			if (dir.max < Infinity) {

				element.maxLength = dir.max;
			}

			// store element
			dir.element = element;

			// capture groupable tags
			switch (element.type) {

				case 'checkbox':
				case 'radio':

					if (element.name.length > 0) {

						var tagSelector = element.tagName.toLowerCase();

						// capture all elements with the same name
						dir.groupedWith = self.form.querySelectorAll(tagSelector + '[name="' + element.name + '"]');
					}

					break;
			}

			// cache directives
			self._cacheDirectives(element, dir);

			return dir;
		};

		this._transformDirectives = function(plainDir) {

			if (typeof plainDir !== 'string') { return null; }

			var result = {

				id: 			null,

				required: 		false,
				type: 			null,
				min: 			-Infinity,
				max: 			Infinity,
				trim: 			true,
				pattern: 		null,

				element: 		null,
				groupedWith: 	[],
				message: 		null,

				realtime: 		false
			};

			var params 		= plainDir.split(',');
			var paramCount 	= params.length;

			for (var i = 0; i < paramCount; i++) {

				var param = params[i].trim();

				if (param === 'required') {

					result.required = true;

				} else if (/^(min|max)\s*[0-9]+$/.test(param)) {

					var parts = param.match(/^(min|max)\s*([0-9]+)$/);

					if (parts[1] === 'min') {

						result.min = parseInt(parts[2], 10);

					} else {

						result.max = parseInt(parts[2], 10);
					}

				} else if (/^\/.+\/$/.test(param)) {

					var re = param.substring(1, param.length - 1);
					    re = new RegExp(re);

					result.pattern = re;

				} else if (param === 'notrim') {

					result.trim = false;

				} else {

					if (self._validationTypes.indexOf(param) === -1) { return null; }

					result.type = param;
				}
			}

			return result;
		};

		this._cacheDirectives = function(element, directives) {

			var trackingIndex = ++self._cacheTracking;

			directives.id = trackingIndex;
			element.setAttribute('data-v-cached', trackingIndex);

			self._cache[trackingIndex] = directives;
		};

		this._validateText = function(e, registerForRT) {

			var element = ( (e.nodeType === 1) ? e : e.target );

			var dirIndex = element.getAttribute('data-v-cached');
			if (dirIndex === null) { return; }
			var dir = self._cache[dirIndex];

			// register input to be validated in real-time
			if (registerForRT === true) {

				dir.realtime = true;

			// do not validate before the input element was left at least once
			} else if (dir.realtime === false) { return; }

			var text = element.value;
			if (dir.trim === true) {

				text = text.trim();
			}
			var textLength = text.length;

			/* BEGIN: evaluate input */

				var reasons = [];

				// required
				if (dir.required && (textLength === 0)) {

					reasons.push('INPUT_REQUIRED');
				}

				// type
				switch (dir.type) {

					case 'email':

						if ((dir.required === true) || (textLength > 0)) {

							// e-mail validation simplified to: x@x.x
							var posAt 	= text.indexOf('@');
							var hasAt 	= (posAt >= 1);

							var posDot 	= text.indexOf('.', posAt);
							var hasDot 	= ( ((posDot-posAt) >= 2) && (posDot < (textLength-1)) );

							if (!hasAt || !hasDot) { reasons.push('INPUT_EMAIL'); }
						}
						break;
				}

				// min
				if ((dir.min > -Infinity) && (textLength < dir.min)) {

					reasons.push('INPUT_MIN');
				}

				// max
				if ((dir.max < Infinity) && (textLength > dir.max)) {

					reasons.push('INPUT_MAX');
				}

				// pattern
				if (dir.pattern !== null) {

					if ((dir.required === true) || (textLength > 0)) {

						if (dir.pattern.test(text) === false) {

							reasons.push('INPUT_PATTERN');
						}
					}
				}

			/* END: evaluate input */

			if (reasons.length > 0) {

				self._showMessage(dirIndex, reasons);
				return false;

			} else {

				self._hideMessage(dirIndex);
				return true;
			}
		};

		this._registerTextValidation = function(event) {

			var element = event.target;

			// do not validate autofocus on the first blur event unless text was entered
			if (element.autofocus === true) {

				element.autofocus = false;

				if (element.value.length === 0) {

					return;
				}
			}

			self._validateText(event, true);
		};

		this._validateDecision = function(e) {

			var element = ( (e.nodeType === 1) ? e : e.target );

			var dirIndex = element.getAttribute('data-v-cached');
			if (dirIndex === null) { return; }
			var dir = self._cache[dirIndex];

			/* BEGIN: evaluate input */

				var reasons = [];

				var i, checkedCount, groupCount = dir.groupedWith.length;

				// required
				if (dir.required) {

					if (element.tagName === 'SELECT') {

						if (element.value === '') {

							reasons.push('SELECTION_REQUIRED');
						}

					} else {

						var checked = false;

						if (groupCount > 0) {

							for (i = 0; i < groupCount; i++) {

								if (dir.groupedWith[i].checked === true) {

									checked = true;
									break;
								}
							}

						} else {

							checked = element.checked;
						}

						if (checked === false) {

							reasons.push('SELECTION_REQUIRED');
						}
					}
				}

				// min
				if ((dir.min > -Infinity) && (groupCount > 0)) {

					checkedCount = 0;
					for (i = 0; i < groupCount; i++) {

						if (dir.groupedWith[i].checked === true) {

							checkedCount++;
						}
					}

					if (checkedCount < dir.min) {

						reasons.push('SELECTION_MIN');
					}
				}

				// max
				if ((dir.max < Infinity) && (groupCount > 0)) {

					checkedCount = 0;
					for (i = 0; i < groupCount; i++) {

						if (dir.groupedWith[i].checked === true) {

							checkedCount++;
						}
					}

					if (checkedCount > dir.max) {

						reasons.push('SELECTION_MAX');
					}
				}

			/* END: evaluate input */

			if (reasons.length > 0) {

				self._showMessage(dirIndex, reasons);
				return false;

			} else {

				self._hideMessage(dirIndex);
				return true;
			}
		};

		this._registerDecisionValidation = function(e) {

			self._validateDecision(e);
		};

		this._getMessagePosition = function(element) {

			var $element 	= jQuery(element);
			var position 	= $element.position();
			var width 		= $element.outerWidth();
			var height 		= $element.outerHeight();

			switch (self.options.position) {

				case 'top':
					return {
						top: 	(position.top - Math.min(height, 21) - self.options.offsetY),
						left: 	(position.left + self.options.offsetX)
					};

				case 'right':
					return {
						top: 	(position.top + self.options.offsetY),
						left: 	(position.left + width + self.options.offsetX)
					};

				case 'bottom':
					return {
						top: 	(position.top + height + self.options.offsetY),
						left: 	(position.left + self.options.offsetX)
					};

				default:
					throw new Error('SimpleV: Invalid option value encountered for "position". The value "' + self.options.position + '" is not supported.');
			}
		};

		this._createMessage = function(element) {

			var message 		= document.createElement('div');
			message.className 	= self.options.className;

			if (self.options.display === 'relative') {

				var position 			= self._getMessagePosition(element);
				message.style.position 	= 'absolute';
				message.style.top 		= (position.top  + 'px');
				message.style.left 		= (position.left + 'px');

			} else {

				message.style.display = 'inline-block';
			}

			// append to parent element
			element.parentElement.appendChild(message);

			return message;
		};

		this._showMessage = function(index, reasons) {

			// fetch from cache
			var dir = self._cache[index];

			var groupCount = dir.groupedWith.length;
			if (groupCount > 0) {

				var minNotReached = (reasons.indexOf('SELECTION_MIN') >= 0);

				for (var i = 0; i < groupCount; i++) {

					// do not mark checked inputs invalid as long as the minimum is not reached
					if (minNotReached && (dir.groupedWith[i].checked === true)) {

						dir.groupedWith[i].classList.remove(self.options.invalidClass);
						dir.groupedWith[i].classList.add(self.options.validClass);

					} else {

						dir.groupedWith[i].classList.remove(self.options.validClass);
						dir.groupedWith[i].classList.add(self.options.invalidClass);
					}
				}

			} else {

				dir.element.classList.remove(self.options.validClass);
				dir.element.classList.add(self.options.invalidClass);
			}

			// create message element (lazy)
			if (dir.message === null) {

				dir.message = self._createMessage(dir.element);
			}

			// only show the first reason
			var reason = reasons[0];
			if (typeof SimpleV.l10n[reason] === 'string') {

				// localize reason
				var messageText;

				// prioritize custom message
				var custom = dir.element.getAttribute('data-v-msg');
				if ((typeof custom === 'string') && (custom.length > 0)) {
					messageText = custom;
				} else {
					messageText = SimpleV.l10n[reason];
				}

				// replace placeholders
				messageText = messageText.replace(/\{min\}/g, dir.min);
				messageText = messageText.replace(/\{max\}/g, dir.max);

				dir.message.innerHTML = messageText;

			} else {

				throw new Error('SimpleV: Missing localization entry in SimpleV.l10n for reason: ' + reason);
			}

			dir.message.style.removeProperty('display');
		};

		this._hideMessage = function(index) {

			// fetch from cache
			var dir = self._cache[index];

			var groupCount = dir.groupedWith.length;
			if (groupCount > 0) {

				for (var i = 0; i < groupCount; i++) {

					dir.groupedWith[i].classList.remove(self.options.invalidClass);
					dir.groupedWith[i].classList.add(self.options.validClass);
				}

			} else {

				dir.element.classList.remove(self.options.invalidClass);
				dir.element.classList.add(self.options.validClass);
			}

			// if the message element does not exist yet, there's no need to hide anything
			if (dir.message !== null) {

				dir.message.style.display 	= 'none';
				dir.message.innerHTML 		= '';
			}
		};

		this._isElementInViewport = function(element) {

			var rect = element.getBoundingClientRect();

			return (
				(rect.top 		>= 0) &&
				(rect.left 		>= 0) &&
				(rect.bottom 	<= window.innerHeight) &&
				(rect.right 	<= window.innerWidth)
			);
		};

		this._scrollIntoView = function(element) {

			jQuery('html, body').animate({

				scrollTop: (jQuery(element).offset().top + self.options.scrollIntoViewOffset)

			}, self.options.scrollIntoViewDuration);
		};

	/* END: private methods */

	/* BEGIN options */

		this.defaultOptions = {

			// true:  Start real-time validation after the input was left for the first time.
			// false: Start real-time validation immediately.
			delayValidation: 	true,

			// Automatically scroll into view of the first element that did not pass validation.
			scrollIntoView: 	true,

			// Duration of the scroll into view animation in milliseconds.
			scrollIntoViewDuration: 600,

			// Offset added to the position of the first element, which receives the scroll into view.
			scrollIntoViewOffset: -32,

			// Display mode of the message element.
			// 'static':   The message element is an inline-block right after the input element.
			// 'relative': The message element is floating on top of the input element.
			display: 			'static',

			// Directional position of the message element.
			// Only works when [display] is set to 'relative'.
			// 'top':    The message element is shown above the input element.
			// 'right':  The message element is shown next to the input element.
			// 'bottom': The message element is shown below the input element.
			position: 			'top',

			// Offset in 'px' added to the X position of the message element.
			// Only works when [display] is set to 'relative'.
			offsetX: 			null,

			// Offset in 'px' added to the Y position of the message element.
			// Only works when [display] is set to 'relative'.
			offsetY: 			null,

			// Class of the message element dynamically added on validation.
			className: 			'simplev-message',

			// Class to set on the input element in case the validation passed.
			validClass: 		'simplev-valid',

			// Class to set on the input element in case the validation failed.
			invalidClass: 		'simplev-invalid',

			// Log SimpleV related warnings and infos in the console.
			log: 				false

		};

		// merge
		this.options = jQuery.extend({}, this.defaultOptions, options);

	/* END: options */

	this.form = form;

	if (this.options.display === 'relative') {

		// message are positioned absolute to the parent, thus requiring the parent to be positioned relative
		this.form.style.position = 'relative';
	}

	/* BEGIN: hook form */

		this.form.addEventListener('submit', function(event) {

			var result;

			if ( self.validate() ) {

				if (typeof self.onValid == 'function') {

					result = self.onValid(self);

				} else {

					result = true;
				}

			} else {

				if (typeof self.onInvalid == 'function') {

					result = self.onInvalid(self);

				} else {

					result = false;
				}
			}

			if (result === false) {

				event.preventDefault();
			}

			return result;
		});

	/* END: hook form */

	/* BEGIN: hook inputs */

		var elements, elementCount, i;

		/* BEGIN: <input> */

			elements 		= this.form.getElementsByTagName('input');
			elementCount 	= elements.length;

			for (i = 0; i < elementCount; i++) {

				switch (elements[i].type) {

					case 'text':
					case 'password':
					case 'search':

						if (this._prepareElement(elements[i]) === false) { continue; }

						elements[i].addEventListener('input', self._validateText);
						elements[i].addEventListener('blur',  self._registerTextValidation);
						break;

					case 'checkbox':
					case 'radio':

						var dir = this._prepareElement(elements[i]);
						if (dir === false) { continue; }

						var groupCount = dir.groupedWith.length;
						if (groupCount > 0) {

							for (var n = 0; n < groupCount; n++) {

								// share directives and change event
								dir.groupedWith[n].setAttribute('data-v-cached', dir.id);
								dir.groupedWith[n].addEventListener('change', self._validateDecision);
							}

						} else {

							elements[i].addEventListener('change', self._validateDecision);
						}
						break;
				}
			}

		/* END: <input> */

		/* BEGIN: <textarea> */

			elements 		= this.form.getElementsByTagName('textarea');
			elementCount 	= elements.length;

			for (i = 0; i < elementCount; i++) {

				if (this._prepareElement(elements[i]) === false) { continue; }

				elements[i].addEventListener('input', self._validateText);
			}

		/* END: <textarea> */

		/* BEGIN: <select> */

			elements 		= this.form.getElementsByTagName('select');
			elementCount 	= elements.length;

			for (i = 0; i < elementCount; i++) {

				if (this._prepareElement(elements[i]) === false) { continue; }

				elements[i].addEventListener('change', self._validateDecision);
			}

		/* END: <select> */



	/* END: hook inputs */

};

SimpleV.l10n = {
	INPUT_REQUIRED:     'This field is required.',
	INPUT_MIN:          'This field must contain at least {min} characters.',
	INPUT_MAX:          'This field must not exceed a total number of {max} characters.',
	INPUT_PATTERN:      'This field does not match the expected pattern.',
	INPUT_EMAIL:        'This field is not a valid e-mail address.',
	SELECTION_REQUIRED: 'Selection is required.',
	SELECTION_MIN:      'Select at least {min} options.',
	SELECTION_MAX:      'Select no more than {max} options.'
};

// collections of forms that were initialized with SimpleV
SimpleV.forms = [];
SimpleV.form  = null;

SimpleV.init = function(body, options) {
	//         function(body)
	//         function(options)

	// swap arguments
	if (typeof body === 'object') {

		if (body.nodeType !== 1) {

			options = body;
			body = undefined;
		}

	} else if (typeof body === 'string') {

		body = document.querySelector(body);

	} else if (body !== undefined) {

		throw new Error('SimpleV: Invalid arguments encountered for function: init');
	}

	if (body === undefined) {

		body = document.body;
	}

	var forms;
	if (body.tagName === 'FORM') {

		forms = [ body ];

	} else {

		forms = body.querySelectorAll('form[data-v]');
	}
	var formsCount = forms.length;

	for (var i = 0; i < formsCount; i++) {

		// prevent attaching SimpleV more than once
		if (forms[i].hasAttribute('data-v-cached')) {

			if ((options !== undefined) && (options.log === true)) { console.warn('SimpleV: Form already initialized.', forms[i]); }
			continue;
		}

		var enabled = forms[i].getAttribute('data-v');
		if (enabled === 'false') {

			if ((options !== undefined) && (options.log === true)) { console.warn('SimpleV: Form explicitly skipped.', forms[i]); }
			continue;
		}

		// mark form as being initialized by SimpleV
		forms[i].setAttribute('data-v-cached', SimpleV.forms.length);

		// keep track of form
		SimpleV.forms.push(
			new SimpleV(forms[i], options)
		);

		// alias for the first form
		if (SimpleV.forms.length === 1) {
			SimpleV.form = SimpleV.forms[0];
		}
	}
};

SimpleV.isValid = function(form) {

	SimpleV.init(form);

	for (var i = 0; i < SimpleV.forms.length; i++) {

		if (SimpleV.forms[i].form === form) {

			return SimpleV.forms[i].validate();
		}
	}

	return false;
};

SimpleV.version = '0.1.4';