package;

import djNode.utils.CLIApp;
import djNode.utils.Print2;
import js.Node;
import djNode.BaseApp;
import djNode.tools.LOG;

class Main extends BaseApp
{
	var E:Engine;
	
	override function init():Void 
	{	
		PROGRAM_INFO = {
			name:"Win10 - My Tools (winmt)",
			version:"0.2",
			desc:"Applies Tweaks, handles services. <bold,black,:cyan>-- Use at your own risk! --<!>"
			
		};
		
		ARGS.helpText = 'Tweaks of services/tasks/registry are defined in <yellow>"config.ini"<!>';
		ARGS.Actions = [
			['serv', '(1)<blue>[all, blocklist, user, {Group}]<!> (2)<blue>[enable, disable, info]<!>\n' +
					'e.g. serv blocklist disable<darkgray>  > Disable all services in `blocklist`<!>'],
			['tweaks', 'Apply a set of tweaks. Task Scheduler, Group Policy, Registry and others.']
			
			//['test', 'Tests and debug']
		];	
		
		ARGS.Options = [
			['sort', 'When displaying service infos, sort by <blue>[state, type]<!>.', 'yes'],
			['id', 'When displaying service infos, display the service ID as well'],
			['log', 'Write debug logs to a file', 'yes']
		];
		
		super.init();
		
		if (argsOptions.log != null)
		{
			LOG.pipeTrace(); // All trace() calls will redirect to LOG object
			LOG.setLogFile(argsOptions.log);
			LOG.FLAG_SHOW_POS = false;
			CLIApp.FLAG_LOG_QUIET = false; // Trace the commands that CLIApp executes
		}
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
		
		// I don't want a line after H0 text. Note the Engine itself prints to the terminal
		Print2.H_STYLES[0].line = null;
		
		try{
			E = new Engine();
		}catch (err:String) {
			exitError(err);
		}
		
		E.OPTIONS = argsOptions;
		
		switch (argsAction)
		{
			//case 'test':
			//T.println("Reserved for debugging");
			
			case 'tweaks' : 
				E.policy_apply(); T.endl();
				E.tasks_apply_blocklist(); T.endl();
				E.tweaks_apply(); T.endl();
				
			case 'serv':
				var helpText = 'Correct format : <yellow>serv<!> <cyan>[all, blocklist, user, {Group}]<!> <magenta>[enable, disable, info]<!>';
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