package;

import djNode.utils.CLIApp;
import djNode.utils.Print2;
import js.Node;
import js.html.AbortController;
import djNode.BaseApp;
import djNode.tools.LOG;


class Main extends BaseApp
{
	
	//var P:Print2;
	var E:Engine;
	
	override function init():Void 
	{	
		// All traces will redirect to LOG object
		#if debug
		LOG.pipeTrace();
		LOG.setLogFile("a:\\wintweak_log.txt");
		LOG.FLAG_SHOW_POS = false;
		CLIApp.FLAG_LOG_QUIET = false;
		#end
		
		//FLAG_USE_SLASH_FOR_OPTION = true;
		
		// Initialize Program Information here.
		PROGRAM_INFO = {
			name:"Win10 - My Tools",	// winmt
			version:"0.2",
			desc:"Tweaks services/tasks/group policy. Also applies some custom tweaks."
			
		};
		//ARGS.requireAction = true;
		ARGS.helpText = 'Tweaks of services/tasks/registry are stored in <yellow>"config.ini"<!>';
		ARGS.Actions = [
			['serv', '<all, user, grp:GROUPNAME> <enable, disable, info>. GroupName as defined in config.ini [serv] section\n<all> = the main Service blocklist, <user> are all windows 10 usermode services'],
			['serv_save', '<all, user, grp:GROUPNAME> <filename. Save services info to a text file.'],
			['task_off', 'Disable tasks defined in the blocklist'],
			['policy', 'Apply a custom set of Group Policy values'],
			['tweaks', 'Apply some general tweaks']
		];	
		
		ARGS.Options = [
		];
		
		super.init();
	}//---------------------------------------------------;
	
	// This is the user code entry point :
	// --
	override function onStart() 
	{
		if (argsAction == null){
			printBanner(true);
			printHelp(); return;
		}else{
			printBanner();
		}
		
		if (!isAdmin()) {
			exitError('You need to run this with Administrator rights');
		}
		
		Print2.H_STYLES[0].line = null;
		
		E = new Engine();
		
		switch (argsAction)
		{
			// One time tweaks ::
			
			case 'tweaks' : 
				E.tweaks_apply();
				
			case 'policy' : 
				E.policy_apply();
				
			case 'task_off' : 
				E.tasks_apply_blocklist();
			
			case 'serv':
				var helpText = 'Correct format : <yellow>serv<!> <cyan>< all, user, grp:GROUPNAME ><!> <magenta>< enable, disable, info ><!>';
				if (argsInput[0] == null || argsInput[1] == null) exitError(helpText);
				if (['enable', 'disable', 'info'].indexOf(argsInput[1]) < 0) {
					exitError(helpText);
				}
				try{
					E.services_act_group(argsInput[0], argsInput[1]);
				}catch (e:String){
					if (e == "param") exitError(helpText);
					exitError(e);
				}
				
			case 'serv_save' : 
				var helpText = 'Correct format : <yellow>serv_save<!> <cyan>< all, user, grp:GROUPNAME ><!> <magenta>FILENAME<!>';
				if (argsInput[0] == null || argsInput[1] == null) exitError(helpText);
				try{
					E.services_act_group(argsInput[0], 'save', argsInput[1]);
				}catch (e:String){
					if (e == "param") exitError(helpText);
					exitError(e);
				}
				
			default:
		}
	}//---------------------------------------------------;
	
	// --
	static function main()  {
		new Main();
	}//---------------------------------------------------;
	
}// --