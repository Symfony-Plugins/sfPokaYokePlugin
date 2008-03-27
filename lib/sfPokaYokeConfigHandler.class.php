<?php
/**
 * ValidationParser allows you to register validators with the system.
 *
 */

class sfPokaYokeConfigHandler extends sfValidatorConfigHandler
{
	/* keep track on how many rules have been parsed by config handler */
  private $validationRuleCount = 0;
  
  /**
   * Executes this configuration handler.
   *
   * @param array An array of absolute filesystem path to a configuration file
   *
   * @return string Data to be written to a cache file
   *
   * @throws sfConfigurationException If a requested configuration file does not exist or is not readable
   * @throws sfParseException If a requested configuration file is improperly formatted
   */
  public function execute($configFiles)
  {
    // parse the yaml
    $config = $this->parseYamls($configFiles);

    // alternate format?
    if (isset($config['fields']))
    {
      $this->convertAlternate2Standard($config);
    }

    foreach (array('methods', 'names') as $category)
    {
      if (!isset($config[$category]))
      {
        throw new sfParseException(sprintf('Configuration file "%s" is missing "%s" category', $configFiles[0], $category));
      }
    }
    $this->validationRuleCount++;
    // init our data, includes, methods, names and validators arrays
    $data       = array();
    $includes   = array();
    $methods    = array();
    $names      = array();
    $validators = array();

    // get a list of methods and their registered files/parameters
    foreach ($config['methods'] as $method => $list)
    {
      $method = strtoupper($method);

      if (!isset($methods[$method]))
      {
        // make sure that this method is GET or POST
        if ($method != 'GET' && $method != 'POST')
        {
          // unsupported request method
          $error = sprintf('Configuration file "%s" specifies unsupported request method "%s"', $configFiles[0], $method);

          throw new sfParseException($method);
        }

        // create our method
        $methods[$method] = array();
      }

      if (!count($list))
      {
        // we have an empty list of names
        continue;
      }

      // load name list
      $this->loadNames($configFiles, $method, $methods, $names, $config, $list);
    }

    // load attribute list
    $this->loadAttributes($configFiles, $methods, $names, $validators, $config, $list);

    // generate javscript validation rules object, but without javascript tag and comment for better reuse
    $data[] = 'var pkykValidationRules'.$this->getRuleCount().' = {';
    $ret = $this->generateRegistration('POST', $data, $methods, $names, $validators);
    $data[] = '};'.PHP_EOL;

    return implode("", $data);
  }

	/**
   	* Generates raw cache data.
   	*
   	* @param string A request method
   	* @param array  The data array where our cache code will be appended
   	* @param array  An associative array of request method data
   	* @param array  An associative array of file/parameter data
   	* @param array  A validators array
   	*
   	* @return boolean Returns true if there is some validators for this file/parameter
   	*/
    protected function generateRegistration($method, &$data, &$methods, &$names, &$validators)
    {
      $methodsArray = array();
      foreach ($methods[$method] as $name)
      {
        if (preg_match('/^([a-z0-9_-]+)\{([a-z0-9\s_-]+)\}$/i', $name, $match))
        {
          // this file/parameter has a parent
          $subname = $match[2];
          $parent  = $match[1];
          $name    = $match[2];
          $attributes = $names[$parent][$subname];
        }
        else
        {
          // no parent
          $attributes = $names[$name];
        }
        // define rules for each named field
        if ( $attributes['required'] == 0 )
        {
          // If the field is not required override the required and required_msg values
          $attributes['required_msg'] = "''";
          $attributes['required'] = "0";
        }
        
        $methodConfig  = '\''.$name.'\': {';
        $methodConfig .= 'required: '.$attributes['required'].',';
        $methodConfig .= 'required_msg: '.$attributes['required_msg'].'';
        if(count($attributes['validators']) > 0)
        {
          $methodConfig .= ',';
          $methodConfig .= 'validators: {';
          // register validators for this field
          $validatorArray = array();
          foreach ($attributes['validators'] as &$validator)
          {
            $validator = $validators[$validator];
            $validatorConfig = $validator['class'].': {';
            if(is_array($validator['parameters']) && count($validator['parameters']) > 0)
            {
              $validatorConfig .= 'parameters: {';
              $paramArray = array();
              foreach($validator['parameters'] as $parameter => $value)
              {
                $value = ($value === false ? 'false' : $value);
                $value = ($value === true ? 'true' : $value);
                $paramArray[] = $parameter.': \''.$value.'\'';
              }
              $validatorConfig .= implode(",", $paramArray);
              $validatorConfig .= '}';
            }
            $validatorConfig .= '}';
            $validatorArray[] = $validatorConfig;
          }
          $methodConfig .= implode(",", $validatorArray);
          $methodConfig .= '}';
        }
        $methodConfig .= '}';
        $methodsArray[] = $methodConfig;
      }
      $data[] = implode(",",$methodsArray);
      return count($methods[$method]) ? true : false;
    }

    public function getRuleCount(){
      return $this->validationRuleCount;
    }

  /**
   * Loads a list of validators.
   *
   * @param string The configuration file name (for exception usage)
   * @param array  An associative array of validator data
   * @param array  The loaded ini configuration that we'll use for verification purposes
   * @param string A comma delimited list of validator names
   * @param array  A file/parameter name entry
   */
  protected function loadValidators(&$configFiles, &$validators, &$config, &$list, &$entry)
  {
    // create our empty entry validator array
    $entry['validators'] = array();

    if (!$list || (!is_array($list) && trim($list) == ''))
    {
      // skip the empty list
      return;
    }

    // get our validator array
    $array = is_array($list) ? $list : explode(',', $list);

    foreach ($array as $validator)
    {
      $validator = trim($validator);

      // add this validator name to our entry
      $entry['validators'][] = $validator;

      // make sure the specified validator exists
      if (!isset($config[$validator]))
      {
        // validator hasn't been registered
        $error = sprintf('Configuration file "%s" specifies unregistered validator "%s"', $configFiles[0], $validator);
        throw new sfParseException($error);
      }

      // has it already been registered?
      if (isset($validators[$validator]))
      {
        continue;
      }

      if (!isset($config[$validator]['class']))
      {
        // missing class key
        $error = sprintf('Configuration file "%s" specifies category "%s" with missing class key', $configFiles[0], $validator);
        throw new sfParseException($error);
      }

      // create our validator
      $validators[$validator]               = array();
      $validators[$validator]['class']      = $config[$validator]['class'];
      $validators[$validator]['file']       = null;
      $validators[$validator]['parameters'] = null;

      if (isset($config[$validator]['file']))
      {
        // we have a file for this validator
        $file = $config[$validator]['file'];

        // keyword replacement
        $file = $this->replaceConstants($file);
        $file = $this->replacePath($file);

        if (!is_readable($file))
        {
          // file doesn't exist
          $error = sprintf('Configuration file "%s" specifies category "%s" with nonexistent or unreadable file "%s"', $configFiles[0], $validator, $file);
          throw new sfParseException($error);
        }

        $validators[$validator]['file'] = $file;
      }

      // parse parameters
      $parameters = (isset($config[$validator]['param']) ? $config[$validator]['param'] : 'null');

      $validators[$validator]['parameters'] = $parameters;
    }
  }
}