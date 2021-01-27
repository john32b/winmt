/********************************************************************
 * Represent a single Process 
 * 
 * - Engine.hx Creates a Serv object from when parsing system services
 * - 
 *******************************************************************/

package;
import djNode.utils.CLIApp;
import djNode.utils.Registry;

class Serv 
{
	
	// : All these fields should be set by the Engine when it creates a service object
	
	public var ID:String;
	public var DISPLAY_NAME:String;
	
	// KERNEL_DRIVER -- system
	// FILE_SYSTEM_DRIVER -- system 
	// WIN32_SHARE_PROCESS
	// WIN32_OWN_PROCESS
	// USER_SHARE_PROCESS
	public var TYPE:String;
	
	// RUNNING
	// STOPPED
	public var STATE:String;
	public var STOPPABLE:Bool = true; // It is default true for all, unless special reason which will turn to false
	
	public function new()
	{
	}//---------------------------------------------------;
	

	public function isRunning():Bool
	{
		return STATE == "RUNNING";
	}//---------------------------------------------------;
	
	
	/**
	    Disable a service by writing to the Registry
		0 = Boot
		1 = System
		2 = Automatic
		3 = Manual
		4 = Disabled
	**/
	function disable_reg():Bool
	{
		trace('Disabling ($ID) with the Registry');
		var res = Registry.setValueDWord("HKLM\\SYSTEM\\CurrentControlSet\\Services\\" + ID, "Start", "4");
		return res;
	}//---------------------------------------------------;
	
	function enable_reg():Bool
	{
		trace('Enabling ($ID) with the Registry');
		var res = Registry.setValueDWord("HKLM\\SYSTEM\\CurrentControlSet\\Services\\" + ID, "Start", "3");
		return res;
	}//---------------------------------------------------;
	
	/**
	  Try to disable the service with `sc config` 
	  if this fails Modify the Registry to set the start to `disabled`. Restart is needed
	  @return reg  : Disabled with registry, need restart
	          ok   : Disabled normally OK
			  error: Could not be disabled ?
	 */
	public function disable():String
	{
		trace('  .Disabling `($ID) : ${DISPLAY_NAME}`');
		var res = CLIApp.quickExecS('sc config $ID start= disabled');
		if (res == null)
		{
			trace("Cannot disable with `sc` command, Trying with Registry");
			if (disable_reg()){
				trace("REG OK");
				return "reg";
			}else{
				trace("REG FAIL");
				return "error";
			}
		}
		
		return "ok";
	}//---------------------------------------------------;
	
	
	/**
	  Try to ENABLE the service with `sc config` 
	  if this fails Modify the Registry to set the start to `manual`. Restart is needed
	  @return reg  : Enabled with registry, need restart
	          ok   : Enabled normally OK
			  error : Could not be enabled
	 */
	public function enable():String
	{
		trace('  .Enabling `($ID) : ${DISPLAY_NAME}`');
		var res = CLIApp.quickExecS('sc config $ID start= demand');
		if (res == null)
		{
			trace("Cannot enable with `sc` command, Trying with Registry");
			if (enable_reg()){
				trace("REG OK");
				return "reg";
			}else{
				trace('. Cannot Enable');
				return "error";
			}
		}	
		trace('. Enabled OK');
		return "ok";
	}//---------------------------------------------------;
	
	public function stop():Bool
	{
		trace('  .Stopping `${DISPLAY_NAME}`');
		
		var res = CLIApp.quickExecS('sc stop $ID');
		if (res == null)
		{
			trace(". Cannot stop"); 
			return false;
		}
		
		STATE = "STOPPED";
		trace(". Stopped OK");
		return true;
	}//---------------------------------------------------;
	
	public function start()
	{
		trace('  .Starting `${DISPLAY_NAME}`');
		
		var res = CLIApp.quickExecS('sc start $ID');
		if (res == null){
			trace(". Cannot start"); return false;
		}
		STATE = "RUNNING";
		trace(". Started OK");
		return true;
	}//---------------------------------------------------;
	
	
}// --
