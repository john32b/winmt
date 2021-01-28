package;

import djNode.utils.CLIApp;
import djNode.utils.Print2;
import js.Node;
import js.html.AbortController;
import djNode.BaseApp;
import djNode.tools.LOG;

class Main extends BaseApp
{
	var E:Engine;
	
	override function init():Void 
	{	
		#if debug
			LOG.pipeTrace(); // All trace() calls will redirect to LOG object
			LOG.setLogFile("a:\\winmt_log.txt");
			LOG.FLAG_SHOW_POS = false;
			CLIApp.FLAG_LOG_QUIET = false;
		#end
		
		PROGRAM_INFO = {
			name:"Win10 - My Tools (winmt)",
			version:"0.2",
			desc:"Manages services/tasks/group policy. Also applies some custom tweaks. <bold,black,:cyan>-- Use at your own risk! --<!>"
			
		};
		
		ARGS.helpText = 'Tweaks of services/tasks/registry are stored in <yellow>"config.ini"<!>';
		ARGS.Actions = [
			['serv', '<all, main, user, grp:GROUPNAME> <enable, disable, info>. GroupName as defined in config.ini [serv] section\n<main> = the main Service blocklist, <user> are all windows 10 usermode services'],
			['task_off', 'Disable tasks defined in the blocklist'],
			['policy', 'Apply a custom set of Group Policy values'],
			['tweaks', 'Apply some general tweaks'],
			#if debug
			['test', 'Tests and debug']
			#end
		];	
		
		ARGS.Options = [
		
			['sort', 'When displaying service infos, sort by <blue>[state, type]<!>.', 'yes'],
			['id', 'When displaying service infos, display the service ID as well']
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
		E.OPTIONS = argsOptions;
		
		switch (argsAction)
		{
			case 'test':
			
			case 'tweaks' : 
				E.tweaks_apply();
				
			case 'policy' : 
				E.policy_apply();
				
			case 'task_off' : 
				E.tasks_apply_blocklist();
			
			case 'serv':
				var helpText = 'Correct format : <yellow>serv<!> <cyan>< all, main, user, grp:GROUPNAME ><!> <magenta>< enable, disable, info ><!>';
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
				
			default:
		}
	}//---------------------------------------------------;
	
	// --
	static function main() new Main();
	
}// -- 