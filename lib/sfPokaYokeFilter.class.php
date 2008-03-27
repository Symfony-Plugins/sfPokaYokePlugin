<?php
class sfPokaYokeFilter extends sfFilter
{
	public function execute($filterChain)
  	{
	    $this->getContext()->getResponse()->addJavaScript(sfConfig::get('sf_prototype_web_dir').'/js/prototype');
			
  		// Nothing to do before the action
	    $filterChain->execute();
  		
  		// Retrieve the context singleton
  		$this->context = $this->getContext(); 
	    $this->response = $this->context->getResponse();

	    $formRoutes = $this->getFormModuleActions();
	    
			$configHandler = new sfPokaYokeConfigHandler();
			$configHandler->initialize();
			
	    foreach($formRoutes as $route)
	    {
        $moduleName = $route['module'];
        $actionName = $route['action'];		
			
        // Retrieve any validation .yml file for this action
        $configFile = sfConfig::get('sf_app_module_dir').'/'.$moduleName.'/'.sfConfig::get('sf_app_module_validate_dir_name').'/'.$actionName.'.yml';
		    
	    	// Override the default config values
	    	if(file_exists($configFile))
	    	{
					$jsValidationRules[] = $configHandler->execute(array($configFile));
	    	}
	    }
	    
	    
	    // we only need poka yoke to activate when there is at least one rule defined
			if ($configHandler->getRuleCount()) 
			{				
        $jsConfig[] = 'pkykConf = new Object();'.PHP_EOL;
        $jsConfig[] = 'pkykConf.on = "'.sfConfig::get('app_pokayoke_on', true).'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.debug = "'.sfConfig::get('app_pokayoke_debug', false).'";'.PHP_EOL;
        // validation events
        $jsConfig[] = 'pkykConf.checkOnBlur = "'.sfConfig::get('app_pokayoke_validateonblur', true).'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.checkOnSubmit = "'.sfConfig::get('app_pokayoke_validateonsubmit', true).'";'.PHP_EOL;
        // inline error config
        $jsConfig[] = 'pkykConf.displayBlurInlineErrors = "'.sfConfig::get('app_pokayoke_display_inline_onblur', true).'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.displaySubmitInlineErrors = "'.sfConfig::get('app_pokayoke_display_inline_onsubmit', false).'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.inlineErrorId = "'.sfConfig::get('app_pokayoke_inline_id_prefix', 'error_for_').'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.inlineErrorClass = "'.sfConfig::get('app_pokayoke_inline_class', 'form_error').'";'.PHP_EOL;
        // global form errors
        $jsConfig[] = 'pkykConf.displayBlurGlobalErrors = "'.sfConfig::get('app_pokayoke_display_global_onblur', false).'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.displaySubmitGlobalErrors = "'.sfConfig::get('app_pokayoke_display_global_onsubmit', true).'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.globalErrorClass = "'.sfConfig::get('app_pokayoke_globalclass', 'form_error').'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.globalErrorTitle = "'.sfConfig::get('app_pokayoke_globaltitle', 'The following form information has been completed but it contains errors:').'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.globalErrorTitleClass = "'.sfConfig::get('app_pokayoke_global_title_class', 'pkyk_global_title').'";'.PHP_EOL;
        $jsConfig[] = 'pkykConf.globalErrorFocus = "'.sfConfig::get('app_pokayoke_global_onclick_focus', true).'";'.PHP_EOL;

				$jsConfig[] = 'pkykConf.errorPrefix = "'.sfConfig::get('sf_validation_error_prefix', '').'";'.PHP_EOL;
				$jsConfig[] = 'pkykConf.errorSuffix = "'.sfConfig::get('sf_validation_error_suffix', '').'";'.PHP_EOL;
				
				$jsInitialize[]  = 'Event.observe(window, "load", initValidator, false);'.PHP_EOL;
				$jsInitialize[]  = 'function initValidator() {';
				$jsInitialize[]  = 'if(pkykConf.on){';
				//generate init code for each set of validation rules
				for ($i=$configHandler->getRuleCount();$i>0;$i--) 
				{
					$jsInitialize[]  = 'var validator'.$i.' = new PokeYoke( pkykValidationRules'.$i.' );';
				}
				$jsInitialize[]  = '}}';

				$jsInitializeString = implode('', $jsInitialize);
    		$jsValidationRulesString = implode('', $jsValidationRules);
    		$jsConfigString = implode('', $jsConfig);
    		
    		// we need only one script tag for all the init and rulecode.
        $jsString = '<script language="javascript" type="text/javascript">//<![CDATA['.PHP_EOL.
        $jsValidationRulesString.$jsConfigString.$jsInitializeString.
          PHP_EOL.'//]]></script>';
    		//since poka yoke js is required and it was not before included, do that now
        $request = sfContext::getInstance()->getRequest();
        $sf_relative_url_root = $request->getRelativeUrlRoot();
        $jsInclude = '<script type="text/javascript" src="'.$sf_relative_url_root.'/sfPokaYokePlugin/js/pkykValidator.js"></script>';
    		
    		$content = $this->getContext()->getResponse()->getContent();
    		//$content =  str_ireplace('</head>', $jsString.'</head>', $content);
    		// Javascript included a the bottom of the page lead to quicker page rendering.
    		$content = str_ireplace('</body>', $jsString.$jsInclude.'</body>', $content);
    		//write the patched content back to the response
	    	$this->getContext()->getResponse()->setContent($content);
    	}	    	
   	}
   	
   	public function getFormActions()
   	{
      $dom = new DomDocument();
      $dom->validateOnParse = true;
      @$dom->loadHTML($this->response->getContent());		
      // retreive all form nodes from the response
      $nodeList = $dom->getElementsByTagName('form');

      $formActions = array();

      foreach ($nodeList as $node) {
        $formActions[] = $node->getAttribute('action');
      }

      return $formActions;
   	}
   	
   	public function getFormModuleActions()
   	{
   		$formRoutes = array();
   		$formAction = $this->getFormActions();
   		foreach($formAction as $route)
   		{
   			// Strip the scriptname if it present in the route string
   			$route = str_replace($_SERVER['SCRIPT_NAME'], '', $route);
   			
   			$r = sfRouting::getInstance();   			
   			$formRoutes[] = $r->parse($route);
   		}
   		
   		return $formRoutes;
   	}
}
