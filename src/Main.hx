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
		#end
		
		//FLAG_USE_SLASH_FOR_OPTION = true;
		
		// Initialize Program Information here.
		PROGRAM_INFO = {
			name:"Win10 - My Tools",	// winmt
			version:"0.1",
			desc:"Tweaks services/tasks/group policy. Also applies some custom tweaks."
			
		};
		//ARGS.requireAction = true;
		ARGS.helpText = 'Tweaks of services/tasks/registry are stored in <yellow>"config.ini"<!>';
		ARGS.Actions = [
			['serv_off', 'Disable a custom set of services.\nAs well as all the user services'],
			['serv_test', 'Enable<cyan>(1)<!> Disable<cyan>(0)<!> a custom set of services. <darkgray>For testing purposes<!>'],
			['serv_save', 'Save all enabled services to a text file. You must provide the file path'],
			['task_off', 'Disable a custom set of tasks'],
			['policy', 'Apply a custom set of Group Policy values'],
			['tweaks', 'Apply some general tweaks'],
			['info', 'Show Information on: <cyan>[task, serv, all]<!>']
		];		
		
		ARGS.Options = [
		];
		
		CLIApp.FLAG_LOG_QUIET = false;
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
			case 'tweaks' : 
				E.tweaks_apply();
				
			case 'policy' : 
				E.policy_apply();
			
			case 'serv_off' : 
				E.services_stop_all();
			
			case 'serv_test' : 
				if (argsInput[0] == null) exitError('Need to set <cyan>1<!> to enable <cyan>0<!> to disable');
				E.services_act_group('serv_test', argsInput[0] == "0");
			
			case 'serv_save' : 
				if (argsInput[0] == null) exitError('Need to define a file');
				E.serv_save(argsInput[0]);
				
			case 'task_off' : 
				E.tasks_disable_conf();
			
			case 'info' : 
				switch (argsInput[0]) {
					case "task":	E.tasks_info();
					case "serv": 	E.services_info();
					default:		E.services_info(); E.tasks_info();
				}
			default:
		}
	}//---------------------------------------------------;
	
	// --
	static function main()  {
		new Main();
	}//---------------------------------------------------;
	
}// --