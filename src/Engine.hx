/********************************************************************************************************

░██╗░░░░░░░██╗██╗███╗░░██╗░░░░░░███╗░░░███╗████████╗
░██║░░██╗░░██║██║████╗░██║░░░░░░████╗░████║╚══██╔══╝
░╚██╗████╗██╔╝██║██╔██╗██║█████╗██╔████╔██║░░░██║░░░
░░████╔═████║░██║██║╚████║╚════╝██║╚██╔╝██║░░░██║░░░
░░╚██╔╝░╚██╔╝░██║██║░╚███║░░░░░░██║░╚═╝░██║░░░██║░░░
░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚══╝░░░░░░╚═╝░░░░░╚═╝░░░╚═╝░░░

********************************************************************************************************/

package;

import djA.cfg.ConfigFileB;
import djNode.BaseApp;
import djNode.Terminal;
import djNode.utils.CLIApp;
import djNode.utils.Print2;
import djNode.utils.Registry;
import js.node.Fs;
import js.node.Os;
import js.node.Path;
import sys.FileSystem;
import sys.io.File;

class Engine
{
	static inline var CONF_FILE = "config.ini";
	static inline var SECTION_SERVICES = 'services';
	static inline var SECTION_TWEAKS = 'tweaks';
	
	var T:Terminal;
	var P:Print2;
	
	// The main config file
	var CONF:ConfigFileB;
	
	// : Service data, These are filled on `services_init()`
	// :
	var SERV_DB:Array<Serv>;		// All the services that are read
	
	// : Task Data. These are filled on `tasks_init()`
	// :
	var TASKS_DB:Array<TaskD>;		// All system tasks
	var TASKS_CONF:Array<TaskD>;	// The tasks defined in config file (valid ones that exist)
	var TASKS_BAD:Array<String>;	// Config file tasks not found in system
	
	public var OPTIONS:Dynamic;
	
	// --
	public function new() 
	{
		T = BaseApp.TERMINAL;
		P = new Print2();
			
		// -- Load settings File
		if (!FileSystem.exists(CONF_FILE)) {
			throw 'Config File does not exist. <$CONF_FILE>';
		}
		
		try{
			CONF = new ConfigFileB(sys.io.File.getContent(CONF_FILE));
		}catch (e:String) {
			throw "Error Parsing Config File : " + e;
		}

	}//---------------------------------------------------;
	
	
	
	/**
	  - Gets all System Services and initializes Arrays
	  - You need to call this before service operations
	  @throws
	**/
	function services_init()
	{
		if (SERV_DB != null) return; // Already inited
		
		trace("--> Getting Service Data ");
		
		SERV_DB = [];
		var out = CLIApp.quickExecS('sc query type= all state= all') + "";
		var lines:Array<String> = out.split(Os.EOL);
		var c = 1; // Skip the first line, which is empty
		while (c < lines.length)
		{
			var s = new Serv();
			s.ID = StringTools.trim(lines[c++].split(':')[1]);
			s.DISPLAY_NAME = StringTools.trim(lines[c++].split(':')[1]);
			
			/** HELP:
			    Source String:
					TYPE   : 60  USER_SHARE_PROCESS TEMPLATE  
					TYPE   : 2  FILE_SYSTEM_DRIVER  
				Capture:
					(USER_SHARE_PROCESS)
					(FILE_SYSTEM_DRIVER)
			**/
			var reg01:EReg = ~/.*:\W(.*?)\W+(.*?)\W+/;
			if (reg01.match(lines[c++])){
				s.TYPE = reg01.matched(2);
			}else{
				throw "Parse Error : " + lines[c - 1] + " -- Could not get TYPE ";
			}
			
			if (reg01.match(lines[c++])){
				// Note: If not 'STOPPED' there is a one more line there
				s.STATE = reg01.matched(2);
				if (s.STATE != "STOPPED"){
					// Get another line that says stoppable state
					var regStop:EReg = ~/.*(NOT_STOPPABLE)/;
					if (regStop.match(lines[c++])){
						s.STOPPABLE = false;
					}
				}
			}else{
				throw "Parse Error : " + lines[c - 1] + " -- Could not get STATE ";
			}
			
			SERV_DB.push(s);
			
			c += 5; // Go to the start of the next entry
		}
		
	}//---------------------------------------------------;
	
	
	/**
	   Sort an array of service objects
	   @param	serv
	   @param	type : ab | state | type
	   @return
	**/
	public function services_sort(serv:Array<Serv>, type:String):Array<Serv>
	{
		var sfn:Serv->Serv->Int;
		switch (type)
		{
			case "type":
				var ar = ['WIN32_SHARE_PROCESS', 'WIN32_OWN_PROCESS', 'USER_SHARE_PROCESS'];
				sfn = (a:Serv, b:Serv) -> {
					return (ar.indexOf(a.TYPE) - ar.indexOf(b.TYPE));
				}
			case "state":
				sfn = (a:Serv, b:Serv) -> {
					var aa = a.STATE.charAt(0).toLowerCase();
					var bb = b.STATE.charAt(0).toLowerCase();
					if (aa < bb) return -1; if(aa>bb) return 1; return 0;			
				}	
			default: // alphabetical
				sfn = (a:Serv, b:Serv) -> {
					var aa = a.DISPLAY_NAME.charAt(0).toLowerCase();
					var bb = b.DISPLAY_NAME.charAt(0).toLowerCase();
					if (aa < bb) return -1; if(aa>bb) return 1; return 0;			
				}
		}
		serv.sort(sfn);
		return serv;
	}//---------------------------------------------------;
	
	
	/**
	   Act on a group of services. Basically 
	   @param	grp | all,blocklist,user,group
	   @param	act | enable/disable/info/save
	**/
	public function services_act_group(grp:String, act:String )
	{
		trace('--> Services_act_group( $grp , $act) ');
		
		services_init();
		var o = services_get_group(grp);
		services_sort(o.serv, 'ab');
		if (OPTIONS.sort != null) {
			services_sort(o.serv, OPTIONS.sort);
		}
		
		// -- Help Text
		var ss = switch (grp){ 
			case "all" : "All Services";
			case "blocklist" : "Blocklist";
			case "user" : "User services";
			default : "Custom group " + grp;
		}
		
		P.p('- Service Group: <cyan>[$grp]<!> : $ss');
		
		switch (act)
		{
			case "info":
					P.H('Services Info  : ', 0);
					services_info(o.serv);
					
			case "enable":
					P.H(' Services Enable: ', 0);
					services_batch_toggle(o.serv, false);
					
			case "disable":
					if (grp == "all") throw "For safety reasons. You cannot disable ALL services";
					P.H(' Services Enable: ', 0);
					services_batch_toggle(o.serv, true);
					
			default: 
					throw "param"; // General Parameter Error
		}
		
		// -- Unavailable Service IDs
		if (o.bad.length > 0)
		{
			P.ptem('<:yellow,black> WARNING: <!,yellow> ({1}) Services could not be identified : <!>', cast o.bad.length);
			for (i in o.bad) P.p('\t- $i');
			P.line(60);
		}
		
		P.p("- [OK] ");
	}//---------------------------------------------------;
	
	
	
	/**
	 * Get and Print services Info
	 * - All BLOCKLIST service status
	 * - All USER services status
	 * - All BLOCKLIST missing services
	 */
	function services_info(SERV:Array<Serv>)
	{
		var T_RUNNING = 0;
		if (OPTIONS.id)
		{
			P.table("L,48|L,30,1|L,10,1|L,12,1");
			P.tline();
			P.T.fg(magenta);
			P.tr(['Service', 'ID', 'Status', 'Type']);
		}else{
			P.table("L,48|L,10,1|L,12,1");
			P.tline();
			P.T.fg(magenta);
			P.tr(['Service', 'Status', 'Type']);
		}
		
		P.T.reset();
		P.tline();
		
		for (serv in SERV) {
			var this_running = false;
			if (serv.isRunning()){
				T_RUNNING++;
				this_running = true;
			}
			P.tc(serv.DISPLAY_NAME);
			if (OPTIONS.id) P.tc(serv.ID);
			// --
			P.T.fg(this_running?green:red);
			P.tc(serv.STATE);
			// -- Minor visual, to translate "USER_SHARE_PROCESS" > "USER" and make it green
			if (serv.TYPE == "USER_SHARE_PROCESS") {
				P.T.fg(cyan); P.tc("USER");
			}else{
				P.T.fg(magenta); P.tc(serv.TYPE);
			}
			P.T.reset();
			P.tr();
		}
		P.tline();
		// -- Table End
		// -- General Infos:
		P.ptem('Total <darkgray>(valid)<!> Services : <yellow>{1}<!>', SERV.length);
		P.ptem('Running : <green>{1}<!> | Stopped : <red>{2}<!>', T_RUNNING, (SERV.length - T_RUNNING)); 
		P.line(60);
		// Dev: Do I need to log, I mean it is right there on the screen.
	}//---------------------------------------------------;

	
	/**
	   - Returns unsorted, You need to sort later if you want
	   Get a group of services from an ID
	   main : The services as declared in `config.ini`
	   all  : All system services (excluding DRIVERS)
	   user : All user services
	   grp:Name : Custom group of services as defined in `config.ini`
	   @param	group : main | user | all | grp:GROUPNAME
	   @throws "param" means invalid parameter other throws are errors
	**/
	function services_get_group(group:String):{serv:Array<Serv>, bad:Array<String>}
	{
		if (group == null) throw "param";
		
		trace('--> Services_get_group ($group)');
		
		var S:Array<Serv> = [];
		var SBAD:Array<String> = [];
		var SIDS:Array<String>;
		
		// -- Return just the USER services from the system
		if (group == "user")
		{
			S = SERV_DB.filter( (s)-> s.TYPE == "USER_SHARE_PROCESS" );
			return { serv:S, bad:SBAD }; // Note, SBAD is [], I am not expecting bad service names at this point
		}
		
		// -- Return ALL services
		if (group == "all")
		{
			S = SERV_DB.filter( (s) -> ['KERNEL_DRIVER', 'FILE_SYSTEM_DRIVER'].indexOf(s.TYPE) ==-1 );
			// ^ Add the services of type not belonging to that array 
			return { serv:S, bad:SBAD };
		}

		// -- This is a service group. read the Service IDs and construct
		//    an array with real service Objects, Also will create a BadServices list
		//	  which is services that were not found on the system.
		
		SIDS = CONF.getTextArray(SECTION_SERVICES, group);
		if (SIDS == null) throw 'Cannot find [services]:$group in <config.ini>';
		
		// :: Check for any user Services in those lists, so I can translate them.
		var userServ:Array<String> = []; // All the actual service names for (u-) user services
		for (c in 0...SIDS.length) 
		{
			if (SIDS[c].substr(0, 2) == "u-") {
				var sname = SIDS[c].substr(2).toLowerCase(); // Real Service Name/ID
				var found = false;
				// DEV: I need to search all services for services starting with (n)
				for (s in SERV_DB) {
					if (s.ID.toLowerCase().indexOf(sname) == 0) {
						found = true;
						userServ.push(s.ID);
					}
				}
				if (!found) SBAD.push("USER:" + SIDS[c]);	// push the "u-servname" name
				SIDS[c] = "";
			}
		}
		
		// :: --------------------------- ::
		// Append the new generated names to the same array
		// note: that old names are now "", so I need to check later
		SIDS = SIDS.concat(userServ);
		
		// Now I need to convert the Array of Service ID
		// to an array with real Service Objects in it
		for (sid in SIDS) {
			if (sid == "") continue;
			var serv = service_get_by_id(sid);
			if (serv == null) {
				SBAD.push(sid);
				trace('Warning, service ID "$sid" Does not exist');
			}else{
				S.push(serv);
			}
		}
		
		return {
			serv:S,		//	contains all real service objects
			bad:SBAD	//	contains service IDs that were declared but not found
		};
	}//---------------------------------------------------;
	
	/**
	   - Processes an Array of Services
	   - Prints to terminal
	   - ! Does not print a header, print it yourself. It just prints a Table
	   Enabled services will be set to "DEMAND" / manual start
	   @param	AR Array of services
	   @param	act enable,disable | will also automatically start,stop
	**/
	function services_batch_toggle(AR:Array<Serv>, _disable:Bool = true)
	{
		P.table("L,54|R,14,1|R,12,2");
		P.tline();
		P.T.fg(magenta);
		P.tr(['Service', 'Run', 'State']);
		P.T.reset();
		P.tline();
		
		// If any service can't stop/start right now, will true this
		var NEED_RESTART = false;
		var COUNT0 = 0;
		
		for (serv in AR) {
			P.tc(serv.DISPLAY_NAME,1);
			P.tc("...", 2);
			
			// ::  Enable/Disable a service regardless if it is running or not
			
			if (!_disable) 
			{
					// -- TO ENABLE -----------------------
					
					var r = serv.enable();
					if (r == "error") 
					{
						P.T.fg(red);
						P.tc("Can't Enable", 3);
					}else{
						if (r == "reg") {
							NEED_RESTART = true;
							P.T.fg(yellow); P.tc("Enabled REG", 3);
						}else{
							P.T.fg(green); P.tc("Enabled", 3);
						}
					}
					
					if (serv.isRunning())					// No reason to try to run it again
					{
						P.T.fg(green);
						P.tc("Was running", 2);
					}else
					{
						P.T.resetFg(); P.tc('...', 2);		// Draw a `...` on the cell and wait for result
						if (serv.start()) {
							P.T.fg(green);
							P.tc("Started", 2); COUNT0++;
						}else{
							P.T.fg(red);
							P.tc("Can't Start", 2);
						}
						
					}

			}else{
					// -- TO DISABLE -----------------------
				
					var r = serv.disable();
					if (r == "error")  {
						P.T.fg(red); P.tc("Can't Disable", 3);
					}else{
						if (r == "reg") {
							NEED_RESTART = true;
							P.T.fg(yellow); P.tc("Disabled REG", 3);
						}else{
							P.T.fg(green); P.tc("Disabled", 3);
						}
					}
					
					if (r == "reg") NEED_RESTART = true;
					if (!serv.isRunning())
					{
						P.T.fg(green);
						P.tc("Was stopped", 2);
					}else
					{
						P.T.resetFg(); P.tc('...', 2);
						if (serv.stop()) {
							P.T.fg(green);
							P.tc("Stopped", 2); COUNT0++;
						}else{
							P.T.fg(red);
							P.tc("Can't Stop", 2);
						}
					}
			}
			
			P.T.reset();
			P.tr();
			
		} // -- end for --
		P.tline();
		P.p('Processed Total <yellow>(${AR.length})<!> services.');
		P.p('Changed state to <yellow>(${COUNT0})<!> services.');
		if(NEED_RESTART) P.p('You need to <cyan>restart<!> the computer to apply the changes.');
		P.line(50);
	}//---------------------------------------------------;
	
	
	// -- Helper, get the service object of an ID. Null if not found
	function service_get_by_id(id:String):Serv
	{
		for (s in SERV_DB) if (s.ID == id) return s;
		return null;
	}//---------------------------------------------------;
	
	
	//====================================================;
	// TASKS
	//====================================================;
	
	// Get all System tasks, along with run status and store in global array
	// subfunction: Used only in tasks_apply_blocklist();
	function tasks_init()
	{
		if (TASKS_DB != null) return;
		TASKS_DB = [];
		TASKS_BAD = [];
		TASKS_CONF = [];
		
		// -- Get All System Tasks
		var out = CLIApp.quickExecS('schtasks /Query /FO LIST') + "";
		var lines:Array<String> = out.split(Os.EOL);
		var c = 1; 
		while (c < lines.length) {
			// FOLDER:
			var line = lines[c++];
			if (line.substr(0, 9) == "TaskName:") {
				var t_name = StringTools.trim(line.substr(9));
				var status = StringTools.trim(lines[c + 1].substr(7)); 
				var T = new TaskD();
					T.PATH = t_name;
					T.STATUS = status;
					TASKS_DB.push(T);
				c += 3;
			}
		} // --
		
		function task_get(path:String):TaskD{
			for (i in TASKS_DB) if (i.PATH == path) return i; return null;
		}//---------------------------------------------------;	
		
		// - Get all TASKS TO BLOCK from config file
		var conf = CONF.getTextArray(SECTION_TWEAKS, 'tasks');
		for (tid in conf) {
			var t = task_get(tid);
			if (t != null) {
				TASKS_CONF.push(t);
			}else{
				TASKS_BAD.push(tid);
			}
		}
	}//---------------------------------------------------;
	
	/**
	   Disable all tasks from [tweaks]:tasks 
	**/
	public function tasks_apply_blocklist()
	{
		tasks_init();
		
		P.H("Disabling ALL tasks: ", 0);
		P.p('- Tasks defined in <yellow>config.ini<!>');
			P.table("L,60|R,18,1");
			P.tline();
			P.T.fg(magenta);
			P.tr(['Task', 'Status']);
			P.T.reset();
			P.tline();
		var COUNT = 0;
		var CANNOT = 0;
		for (T in TASKS_CONF)
		{
			P.tc(T.PATH, 1);
			if (T.isDisabled()){
				P.T.fg(cyan);
				P.tc("Disabled"); // Already Disabled
				P.T.reset();
				P.tr();
				continue;
			}
			P.tc("...", 2);
			var res = CLIApp.quickExecS('schtasks /change /tn "${T.PATH}" /disable');
			if (res == null){
				P.T.fg(red);
				P.tc('Failed', 2);
				CANNOT++;
			}else{
				P.T.fg(cyan);
				P.tc('Disabled', 2);
				COUNT++;
			}
			P.T.reset();
			P.tr();
		}// -- end for
		
		P.tline();
		P.p('Processed Total <yellow>(${TASKS_CONF.length})<!> Tasks.');
		if (COUNT > 0) P.p('Just disabled <yellow>(${COUNT})<!> Tasks.');
		if (CANNOT > 0) P.p('Could not disable <red>(${CANNOT})<!> Tasks.');
		P.line(50);
		
		// -- Unavailable Task Paths
		if (TASKS_BAD.length > 0)
		{
			P.ptem('<:yellow,black> WARNING: <!,yellow> ({1}) Tasks do not exist in Task Scheduler : <!>', cast TASKS_BAD.length);
			for (i in TASKS_BAD) P.p('\t- $i');
			P.line(60);
		}
		P.p("- [OK] ");
	}//---------------------------------------------------;	
	

	// Try to make a task owned by current user
	// (CURRENTLY NOT USED)
	function task_fix_permissions(t:TaskD):Bool
	{
		var path = Path.join(js.Node.process.env['windir'], 'System32\\Tasks');
			path = Path.join(path, t.PATH);
		
		var op1 = CLIApp.quickExecS('takeown /f "$path"');
		if (op1 == null) {
			trace("Cannot takeown for ", path);
			return false;
		}
		
		// os.userInfo().username
		var user:String = Os.userInfo().username;
		var op2 = CLIApp.quickExecS('icacls "$path" /grant ${user}:f');
		if (op2 == null) {
			trace("Cannot change permissions", path);
			return false;
		}
		
		trace("task fixed ok");
		return true;
	}//---------------------------------------------------;
	
	
	/**
	   Apply Group Policy Tweaks from [tweaks]:gpolicy 
	**/
	public function policy_apply()
	{
		P.H("Applying Group Policy Tweaks: ", 0);
		P.T.endl();
		reg_batch('gpolicy', true);
	}//---------------------------------------------------;
	
	
	/**
	   Apply REGISTRY Tweaks [tweaks]:reg 
	   Apply Custom Commands [tweaks]:commands 
	**/
	public function tweaks_apply()
	{
		P.H("Applying Registry Tweaks: ", 0);
		P.T.endl();
		reg_batch('reg', false);
		P.T.endl();
		P.H("Applying Other Tweaks : ", 0);
		P.T.endl();
		//
		P.line(60);
		var D = CONF.getTextArray(SECTION_TWEAKS, 'commands');
		for (l in D)
		{
			l = StringTools.trim(l);
			if (l.length == 0) continue;
			if (l.charAt(0) == "+") {
				P.p('+ <yellow>' + l.substr(1) + '<!>');
				continue;
			}
			CLIApp.quickExecS(l);
		}
		P.line(60);
		P.p("- [OK] ");
	}//---------------------------------------------------;
	
	
	// Apply reg values from a key in config.ini in ([main] section)
	function reg_batch(key:String, displayKeys:Bool = false)
	{
		P.p('- Applying All Reg keys from <cyan>[$key]<!>:');
		P.line(60);
		var k = CONF.getTextArray(SECTION_TWEAKS, key);
		var	c_key = "";
		for (line in k)
		{
			line = StringTools.trim(line);
			if (line.length == 0) continue;
			if (line.charAt(0) == "+")
			{
				P.p('+ <yellow>' + line.substr(1) + '<!>');
				continue;
			}
			
			if (line.indexOf('HKEY') == 0){
				c_key = line;
				if(displayKeys) P.p(' + <yellow>$c_key<!>');
				continue;
			}else{
				var d = line.split(' ');
				if(displayKeys) P.p('     ${d[0]} = <green,bold>${d[1]}<!>');
				// Actually apply the key:
				var res = Registry.setValueDWord(c_key, d[0], d[1]);
			}
		}
		P.line(60);
		P.p("- [OK] ");
	}//---------------------------------------------------;
	
}//--)