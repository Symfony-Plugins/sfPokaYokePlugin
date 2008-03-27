PokeYoke = Class.create();
PokeYoke.prototype = {

  	initialize: function(rules) {
  	this.pkykValidationRules = rules;
		this.pkyk = new Object();
		// apply blur event listeners to all fields in the validation rules
		if(pkykConf.checkOnBlur) {
			for (var i in this.pkykValidationRules) {
				var pkykField = null;
				var pkykFields = document.getElementsByName(i);
				for(var z=0; z < pkykFields.length; z++) {
					switch(pkykFields[z].tagName) 
					{
					   case "INPUT":
					   case "SELECT":
					   case "TEXTAREA":
					       pkykField = pkykFields[z];
					       break;  
					}
				}
				if(pkykField)
				{
				    this.registerFieldBlur( pkykField );
				} 
				else 
				{
				    //alert('You have rules that do not relate to a form field in the current document.');
				}
			}
		}
		// apply submit event listener to forms
		if(pkykConf.checkOnSubmit) {
			var formNodeList = document.getElementsByTagName('form');
			for (var i = 0; i < formNodeList.length; i++) { 
				var pkykForm = formNodeList[i]; 
				this.registerFormSubmit( pkykForm );
			}
		}
  	},

	registerFieldBlur: function( pkykField ) {
		Event.observe( pkykField , 'blur', this.checkFieldOnBlur.bind(this), false);
	},
	
	registerFormSubmit: function( pkykForm ) {
		Event.observe( pkykForm , 'submit', this.checkFormOnSubmit.bind(this), false);
	},

  	checkFieldOnBlur: function(evt) {
		this.validateField(Event.element(evt));
  	},
	
	checkFormOnSubmit: function(evt) {
		var pkykForm = Event.element(evt);
		
		var pkykFormElements = Form.getElements( pkykForm );
		for (var i = 0; i < pkykFormElements.length; i++)
		{ 
			this.validateField(pkykFormElements[i]);			
		}
		this.renderGlobalErrors( pkykForm );
		if(Object.values(this.pkyk).length > 0)
		{
			Event.stop(evt);
			return false;
		}
		else
		{
			return true;
		}
	},
	
	validateField: function(target)
	{
		// reset values for each iteration
		var required = false;
		var elementError = false;
		var errorMsg = '';
		var targetName = target.name;
		var targetValue = this.trim( $F(target) );
		if(target.disabled)
		{
			// if the imput is disabled quit function
			return;
		}
		// if a validation rule exists
		if(this.pkykValidationRules[target.name])
		{
			if (pkykConf.debug)	alert(target.name + ' is being validated');
			
			if(this.pkykValidationRules[target.name]['required'])
			{
				required = this.pkykValidationRules[target.name]['required'];
			}
			// If the field is required test for a at least one character
			if(required)
			{
				if (!targetValue.match(/.+/))
				{
					errorMsg = this.pkykValidationRules[target.name]['required_msg'];
					elementError = true;
				}
				else{
					errorMsg = '';
					elementError = false;
				}
			}
			
			var validators = this.pkykValidationRules[target.name]['validators'];
			if(validators != undefined && !elementError)
			{
				for (var validatorName in validators) {
					// try to create a validator object 
					try {
						eval('validator = new '+validatorName+'()');
					} catch (e) {
						//alert('Unknown validatior :: '+validatorName);
						continue;
					}
					
					// Attache a standard initialization method
					validator.initialize = function(parameters) {
						try {	
							for(var parameter in parameters) {
								this[parameter] = parameters[parameter];
							}
						} catch(e) {}
					}
					
					// Initialize parameters
					if(this.pkykValidationRules[target.name]['validators'][validatorName]['parameters'])
					{
						validator.initialize(this.pkykValidationRules[target.name]['validators'][validatorName]['parameters']);
					}
					
					// Validate
					errorMsg = validator.execute(targetValue);
					if(errorMsg) {
	    				elementError = true;
	    				continue;
					}
				}
			}
			
			if(elementError) {
				// set global error array with this key to the correct values
				this.pkyk[targetName] = {
					target: target, 
					errorMsg: errorMsg
				};
				this.renderInlineError( target, errorMsg );
			} else {
	   			this.removeErrors( target );
			}
		}
  	},
	
	renderInlineError: function(target, msg)
	{
		// test config settings
		if(pkykConf.displayBlurInlineErrors){
			var pkykErrorNode = $( pkykConf.inlineErrorId + target.name );
			
			if( pkykErrorNode ) {
				pkykErrorNode.innerHTML = pkykConf.errorPrefix + msg + pkykConf.errorSuffix;
				pkykErrorNode.show();
			} else {
				new Insertion.After( target, '<div id="'+ pkykConf.inlineErrorId + target.name + '" class="' + pkykConf.inlineErrorClass + '">' + msg + '</div>' );
			}
		}
	},
	
	renderGlobalErrors: function( pkykForm )
	{
		if (pkykConf.displaySubmitGlobalErrors && Object.values(this.pkyk).length > 0)
		{
			if($('pkykGlobalErrors'))
			{
				$('pkykGlobalErrors').remove();
			}
			var pkykGlobalStr = '';
			var pkykGlobalErrorTitle = ( pkykConf.globalErrorTitle.length > 0 ) ? '<p class="'+pkykConf.globalErrorTitleClass+'">'+pkykConf.globalErrorTitle+'</p>' : '';
			
			if( Object.values(this.pkyk).length > 0 )
			{
				for (var i = 0; i < Object.values(this.pkyk).length; i++) {
					var pkykFieldname = Object.values(this.pkyk)[i].target.name;
					var pkykErrorStr = pkykConf.errorPrefix + Object.values(this.pkyk)[i].errorMsg + pkykConf.errorSuffix;
					pkykGlobalStr += '<li class="'+pkykConf.globalErrorClass+'" id="pkykGlobal_' + pkykFieldname + '">' + pkykErrorStr + '</li>';
				}
			
				new Insertion.Top( pkykForm, '<div id="pkykGlobalErrors">' + pkykGlobalErrorTitle + '<ul>' + pkykGlobalStr + '</ul></div>' );
			}
	
			if( pkykConf.globalErrorFocus && $( 'pkykGlobalErrors' ) )
			{
				var vListItems = $( 'pkykGlobalErrors' ).getElementsByTagName('li');
				for (var i = 0; i < vListItems.length; i++)
				{
					Event.observe( vListItems[i] , 'click', this.getFieldFocus.bind(this), false);
				}
			}
		}
	},
	
	removeErrors: function(target)
	{	
		if( $( pkykConf.inlineErrorId + target.name ))
		{
			$( pkykConf.inlineErrorId + target.name ).innerHTML = '';
			$( pkykConf.inlineErrorId + target.name ).hide();
		}
		
		if( $( 'pkykGlobal_' + target.name ) )
		{
			var pkykGlobalListItem = $( 'pkykGlobal_' + target.name );
			Element.remove(pkykGlobalListItem);
		}
		
		if(this.pkyk[target.name])
		{
			delete this.pkyk[target.name];
		}
		
		if(Object.values(this.pkyk).length == 0 && $('pkykGlobalErrors'))
		{
			$('pkykGlobalErrors').remove();
		}
	},
	
	getFieldFocus: function(evt)
	{
		var target = Event.element( evt );
		var targetId = target.id;
		var targetField = $(targetId.replace(/pkykGlobal_/,''));
		if(targetField)
		{
			targetField.scrollTo();
			Field.select( targetField );
		}
	},
	
	trim: function(value)
	{
		cleanValue = '';
		if(value)
		{
			cleanValue = value.gsub(/^\s+/, '');
			cleanValue = cleanValue.gsub(/\s+$/, '');
		}
		
		return cleanValue;	
	}
}
	
	
/* Validators */

/**
 * sfStringValidator allows you to apply string-related constraints to a
 * parameter.
 *
 * Optional parameters:
 *
 * # insensitive  - [false]              - Whether or not the value check
 *                                                against the array of values is
 *                                                case-insensitive. Note:
 *                                                When using this option, values
 *                                                in the values array must be
 *                                                entered in lower-case.
 * # max          - [none]               - Maximum string length.
 * # max_error    - [Input is too long]  - An error message to use when
 *                                                input is too long.
 * # min          - [none]               - Minimum string length.
 * # min_error    - [Input is too short] - An error message to use when
 *                                                input is too short.
 * # values       - [none]               - An array of values the input
 *                                                is allowed to match.
 * # values_error - [Invalid selection]  - An error message to use when
 *                                                input does not match a value
 *                                                listed in the values array.
 */

/* Constructor */
var sfStringValidator=function() {
	this.insensitive = false;
	this.max = null;
	this.max_error = "Input is too long";
	this.min = null;
	this.min_error = "Input is too short";
	this.values = null;
	this.values_error = "Invalid selection";
}

/* Validation method */
sfStringValidator.prototype.execute=function(value) {
	if ((this.min != null) && (value.length < this.min)) {
		// too short
		return this.min_error;
	}

	if ((this.max != null) && (value.length > this.max)) {
		// too long
		return this.max_error;
	}
    
	if(this.values != null) {
		for(i = 0; i < this.values.length; i++) {
			if((this.insensitive?(this.values[i].toLowerCase()):(this.values[i])) == (this.insensitive?(value.toLowerCase()):(value))) {
				return false;
			}
		}
		
		return this.values_error;
	}

	return false;
}

/**
 * sfNumberValidator verifies a parameter is a number and allows you to apply
 * size constraints.
 *
 * Optional parameters:
 *
 * # max        - [none]                  - Maximum number size.
 * # max_error  - [Input is too large]    - An error message to use when
 *                                                 input is too large.
 * # min        - [none]                  - Minimum number size.
 * # min_error  - [Input is too small]    - An error message to use when
 *                                                 input is too small.
 * # nan_error  - [Input is not a number] - Default error message when
 *                                                 input is not a number.
 * # type       - [Any]                   - Type of number (Any, Float).
 * # type_error - [Wrong input] - An error message to use when
 *                                                 input is not a number.
 */

/* Constructor */
var sfNumberValidator=function() {
	this.max = null;
	this.max_error = "Input is too large";
	this.min = null;
	this.min_error = "Input is too small";
	this.nan_error = "Input is not a number";
	this.type = "any"; // 'any', 'decimal', 'float', 'int', 'integer'
	this.type_error = "Wrong input";
}

/* Validation method */
sfNumberValidator.prototype.execute=function(value) {
	if(isNaN(value)) {
		return this.nan_error;
	}
	
	iValue = parseInt(value, 10);
	fValue = parseFloat(value);
	
	if((this.type == 'int') || (this.type == 'integer')) {
		if(fValue != iValue) {
			return this.type_error;
		}
		pValue = iValue;
	} else {
		pValue = fValue;
	}
	
	if((this.min != null) && (pValue < this.min)) {
		return this.min_error;
	}
	
	if((this.max != null) && (pValue > this.max)) {
		return this.max_error;
	}
	
	return false;
}

/**
 * sfRegexValidator allows you to match a value against a regular expression
 * pattern.
 *
 * Required parameters:
 *
 * # pattern - [none] - A PCRE, preg_match() style regular expression
 *                             pattern.
 *
 * Optional parameters:
 *
 * # match       - [true]          - Indicates that the pattern must be
 *                                          matched or must not match.
 * # match_error - [Invalid input] - An error message to use when the
 *                                          input does not meet the regex
 *                                          specifications.
 */

/* Constructor */
var sfRegexValidator=function() {
	this.match = true;
	this.match_error = "Invalid input";
	this.pattern = null;
}

/* Validation method */
sfRegexValidator.prototype.execute=function(value) {
	if(this.pattern != null) {
		match = Boolean(this.match);
		pos = 0;
		unescaped = "";
		while(pos < this.pattern.length) {
			c = this.pattern.charAt(pos);
			if (c == "\\") {
				pos++;
			}
			try {
				unescaped += this.pattern.charAt(pos);
			} catch(e) {}
			pos++;
		}

		try {		
			eval("regExp = "+unescaped);
			value = String(value);
			if((value.match(regExp) && match) || (!value.match(regExp) && !match)) {
				return false;
			} else {
				return this.match_error;
			}
		} catch(e) {
			return false;
		}
	} else {
		return false;
	}
}

/**
 * sfEmailValidator verifies a parameter contains a value that qualifies as an
 * email address.
 * 
 * Optional parameters:
 *
 * # email_error - [Invalid input] - An error message to use when the
 *                                          input is not an email address
 */

/* Constructor */
var sfEmailValidator=function() {
	this.email_error = "Invalid input";
}

sfEmailValidator.prototype.execute=function(value) {
	regExp  = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})$|^$/;
	if (regExp.test(value)) {
		return false;
	} else {
		return this.email_error;
	}
}


/**
 * sfCompareValidator checks the equality of two different request parameters.
 *
 * Required parameters:
 *     check:          field2
 * 
 * Optional parameters:
 * # compare_error - [The values you entered do not match. Please try again.] - 
 *                           An error message to use when the fields do not match
 */

/* Constructor */
var sfCompareValidator=function() {
	this.check = null;
	this.compare_error = "The values you entered do not match. Please try again";
}

sfCompareValidator.prototype.execute=function(value) {
	if(this.check != null) {
		check_field = document.getElementById(this.check);
		if(check_field != null) {
			check_value = check_field.value;
			if(check_value != value) {
				return this.compare_error;
			}
		}
	}
	
	return false;
}

/**
 * sfUrlValidator verifies a parameter contains a value that qualifies as an
 * url address.
 * 
 * Optional parameters:
 *
 * # url_error - [Invalid input] - An error message to use when the 
 * input is not an email address
 */


/* Constructor */

var sfUrlValidator=function() {
	this.url_error = 'Please enter a correctly formatted url';
}

sfUrlValidator.prototype.execute=function(value) {
	regExp  = /^(http|https|ftp):\/\/(([A-Z0-9][A-Z0-9_-]*)(\.[A-Z0-9][A-Z0-9_-]*)+)|^$/i;
	if (regExp.test(value)) {
		return false;
	} else {
		return this.url_error;
	}
}
