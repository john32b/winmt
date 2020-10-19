/********************************************************************************************************

░██╗░░░░░░░██╗██╗███╗░░██╗░░░░░░███╗░░░███╗████████╗
░██║░░██╗░░██║██║████╗░██║░░░░░░████╗░████║╚══██╔══╝
░╚██╗████╗██╔╝██║██╔██╗██║█████╗██╔████╔██║░░░██║░░░
░░████╔═████║░██║██║╚████║╚════╝██║╚██╔╝██║░░░██║░░░
░░╚██╔╝░╚██╔╝░██║██║░╚███║░░░░░░██║░╚═╝░██║░░░██║░░░
░░░╚═╝░░░╚═╝░░╚═╝╚═╝░░╚══╝░░░░░░╚═╝░░░░░╚═╝░░░╚═╝░░░
---------------------------------------------------------------------------------------------------------

- Custom Tweak of a Windows 10 Installation (2019-LTSC)
- Disable Services from a blocklist
- Disable/Enable Service sets
- Disable Tasks
- Edit Group Policy
- Some Tweaks to Registry

- by ~JohnDimi~

********************************************************************************************************/

package;

import djA.cfg.ConfigFileB;
import djNode.BaseApp;
import djNode.Terminal;
import djNode.utils.CLIApp;
import djNode.utils.Print2;
import djNode.utils.Registry;
import haxe.display.Protocol.InitializeParams;
import js.node.Fs;
import js.node.Os;
import js.node.Path;
import sys.FileSystem;
import sys.io.File;

class Engine
{
	static inline var CONF_FILE = "config.ini";
	
	var T:Terminal;
	var P:Print2;
	
	// The main config file
	var CONF:ConfigFileB;
	
	// : Service data, These are filled on `services_init()`
	// :
	var SERV_DB:Array<Serv>;		// All the services that are read
	var SERV_BLOCK:Array<Serv>;		// Services in the BlockList in the config.ini (only the valid ones)
	var SERV_NULL:Array<String>;	// Service IDs from the BlockList that were not found in the system
	var SERV_USER:Array<Serv>;		// User Services - what was parsed from the system. enabled + disabled
	
	// : Task Data. These are filled on `tasks_init()`
	var TASKS_DB:Array<TaskD>;		// All system tasks
	var TASKS_CONF:Array<TaskD>;	// The tasks defined in config file (valid ones that exist)
	var TASKS_BAD:Array<String>;	// Config file tasks not found in system
	
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
	**/
	public function services_init()
	{
		if (SERV_DB != null) return;
		
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
		
		// :: Get User Services
		
		SERV_USER = [];
		for (s in SERV_DB) {
			if (s.TYPE == "USER_SHARE_PROCESS") {
				SERV_USER.push(s);
			}
		}
		
		// :: Get Bad Services (those that don`t exist in system)
		
		SERV_BLOCK = [];
		SERV_NULL = [];
		var cserv = CONF.getTextArray('main', 'services');
		for (sid in cserv) {
			var serv = service_get_by_id(sid);
			if (serv == null){
				SERV_NULL.push(sid);
				continue;
			}
			SERV_BLOCK.push(serv);
		}
		
		// ::  Sort config and user services
		
		var sfn = (a:Serv, b:Serv) -> {
			var aa = a.DISPLAY_NAME.charAt(0).toLowerCase();
			var bb = b.DISPLAY_NAME.charAt(0).toLowerCase();
			if (aa < bb) return -1; if(aa>bb) return 1; return 0;			
		};
		
		SERV_BLOCK.sort(sfn);
		SERV_USER.sort(sfn);
	}//---------------------------------------------------;
	
	
	/**
	 * Save all enabled services to a file
	 * TODO: This function could be better. Print more info
	 */
	public function services_save(file:String)
	{
		// Array with lines to print to the file
		var D:Array<String> = [ 
		'- WinMT , ' + Date.now().toString() , 
		'- List of services (from the BlockList) that are enabled :', 
		'---------------', ''
		];
			
		services_init();
		var SS = SERV_BLOCK.concat(SERV_USER);
		for (i in SS) {
			if (i.isRunning()) {
				D.push('Name: ' + i.DISPLAY_NAME);
				D.push('ID : ' + i.ID);
				D.push('----------');
			}
		}
		var fout = js.node.Path.normalize(file);
		Fs.writeFileSync(fout, D.join('\n'));
		trace("-- Saved info to ", fout);
		P.p('Saved enabled services to <cyan>"${fout}"<!>');
	}//---------------------------------------------------;
	
	/**
	 * Get and Print services Info
	 * - All BLOCKLIST service status
	 * - All USER services status
	 * - All BLOCKLIST missing services
	 */
	public function services_info()
	{
		services_init();
		var T_RUNNING = 0;
		// Both those in config file + all user services
		var SERV = SERV_BLOCK.concat(SERV_USER);
		// --
		P.H("Services Info  : ", 0);
		P.p("These are the services that are defined in the <yellow>config.ini<!> file to be disabled");
		P.table("L,50|L,10,1|L,12,1");
		P.tline();
		P.T.fg(magenta);
		P.tr(['Service', 'Status', 'Type']);
		P.T.reset();
		P.tline();
		for (serv in SERV) {
			var this_running = false;
			if (serv.isRunning()){
				T_RUNNING++;
				this_running = true;
			}
			P.tc(serv.DISPLAY_NAME);
			// --
			P.T.fg(this_running?green:red);
			P.tc(serv.STATE);
			// --
			if (serv.TYPE == "USER_SHARE_PROCESS")
			{
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
		var TOTAL_VALID:Int = SERV_BLOCK.length;
		P.ptem('Total <darkgray>(valid)<!> Services in BlockList: <yellow>{1}<!>', SERV_BLOCK.length);
		P.ptem('Total User Services : <yellow>{1}<!>', SERV_USER.length);
		P.ptem('Running : <green>{1}<!> | Stopped : <red>{2}<!>', T_RUNNING, (SERV.length - T_RUNNING)); 
		P.line(60);
		
		// -- Unavailable Service IDs
		if (SERV_NULL.length > 0){
			P.ptem('<:yellow,black> WARNING: <!,yellow> ({1}) Services could not be identified : <!>', cast SERV_NULL.length);
			for (i in SERV_NULL) {
				P.p('\t- $i');
			}
			P.line(60);
		}		
		
		// Dev: Do I need to log, I mean it is right there on the screen.
		
	}//---------------------------------------------------;

	/**
	   Work on a group of services from the 'config.ini' file
	   @param	grp Key name in the config file [serv] section
	   @param	state true for disable, false to enable
	**/
	public function services_act_group(grp:String, disable:Bool = true)
	{
		trace('--> Services_Act_Group($grp,$disable)');
	
		// Get all services in this array
		var SERV_GRP:Array<Serv> = [];
		// Service IDs that were not found in system
		var SERV_BAD:Array<String> = [];
		
		var servIDS = CONF.getTextArray('serv', grp);
		if (servIDS == null) {
			BaseApp.app.exitError('Key <yellow>"$grp"<!fg> does not exist in config.ini');
		}
		
		services_init();
		
		// - Translate user services to real service names:
		// DEV: Scans servIDS for user service strings. 
		//		Gets all system services that start with that userservice ID into userServ[]
		// 		Removes original string from servIDS. so that servIDS can be processed normally without garbage
		var userServ:Array<String> = [];
		for (c in 0...servIDS.length) {
			if (servIDS[c].substr(0, 2) == "u-") {
				var sname = servIDS[c].substr(2);
				var found = false;
				// DEV: I need to search all services for services starting with (n)
				for (s in SERV_DB) {
					if (s.ID.indexOf(sname) == 0) {
						found = true;
						userServ.push(s.ID);
					}
				}
				if (!found) SERV_BAD.push("USER:" + servIDS[c]);	// push the "u-servname" name
				servIDS[c] = "";
			}
		}
		
		// Append the new generated names to the same array
		// note: that old names are now "", so I need to check later
		servIDS = servIDS.concat(userServ);
		
		// Now I need to convert the Array of Service ID
		// to an array with real Service Objects in it
		for (sid in servIDS) {
			if (sid == "") continue;
			var serv = service_get_by_id(sid);
			if (serv == null) {
				SERV_BAD.push(sid);
				trace('Warning, service ID "$sid" Does not exist');
				continue;
			}
			SERV_GRP.push(serv);
		}		
		
		// > Up to here
		// SERV_BAD contains any service ID that was not found
		// SERV_GRP are services ready to be processed
		
		// -> Actually disable/enable services now
		
		P.H(disable?"Disabling":"Enabling" + ' Services: ', 0);
		P.p('- Services in KEYNAME <cyan>[$grp]<!> defined in the <yellow>config.ini<!> file');
		services_batch_op(SERV_GRP, disable);
		services_print_null(SERV_BAD);
		P.p(" - DONE - ");
	}//---------------------------------------------------;
	
	/**
	   Stop ALL services, BlockList + UserServices
	**/
	public function services_stop_all()
	{
		trace("--> Services_Stop_All()");
		services_init();
		var AR = SERV_BLOCK.concat(SERV_USER);
		P.H("Disabling ALL Services: ", 0);
		P.p('- Services in BLOCKLIST defined in <yellow>config.ini<!> file');
		P.p('- Plus all the dynamic <yellow>User Services<!>');
		// -
		services_batch_op(AR, true);
		services_print_null(SERV_NULL);	// DEV: SERV_NULL was filled in services_init();
		// -
		P.p(" - DONE - ");
	}//---------------------------------------------------;

	// - Prints null Service ID Warning
	// - Only prints if array non empty
	public function services_print_null(ar:Array<String>)
	{
		// -- Unavailable Service IDs
		if (ar.length > 0){
			P.ptem('<:yellow,black> WARNING: <!,yellow> ({1}) Services could not be identified : <!>', cast ar.length);
			for (i in ar) P.p('\t- $i');
			P.line(60);
		}
	}//---------------------------------------------------;
	
	
	/**
	   - Processes an Array of Services
	   - Prints on terminal
	   - ! Does not print a header, print it yourself. It just prints a Table
	   @param	AR Array of services
	   @param	act enable,disable | will also automatically start,stop
	**/
	function services_batch_op(AR:Array<Serv>, _disable:Bool = true)
	{
		P.table("L,54|R,14,1");
		P.tline();
		P.T.fg(magenta);
		P.tr(['Service', 'Status']);
		P.T.reset();
		P.tline();
		
		// If any service can't stop/start right now, will true this
		var NEED_RESTART = false;
		var COUNT0 = 0;
		
		for (serv in AR) {
			P.tc(serv.DISPLAY_NAME,1);
			P.tc("...", 2);
			
			if (!_disable)
			{
				if (!serv.isRunning()) {
					var r = serv.enable();
					if (r != null && r == "reg") NEED_RESTART = true;
					P.T.resetFg(); P.tc('...', 2);
					if (serv.start()){
						P.T.fg(green);
						COUNT0++;
						P.tc("Just Started", 2);
					}else{
						P.T.fg(red);
						P.tc("Can't Start", 2);
					}
				}else{ // Already running
					P.T.fg(cyan);
					P.tc('Started', 2);
				}
				
			}else{
				
				if (serv.isRunning()) {
					var r = serv.disable();
					if (r != null && r == "reg") NEED_RESTART = true;
					P.T.resetFg(); P.tc('...', 2);
					if (serv.stop()){
						P.T.fg(green);
						COUNT0++;
						P.tc("Just Stopped", 2);
					}else{
						P.T.fg(red);
						P.tc("Can't Stop", 2);
					}
				}else{ // Already Stopped
					P.T.fg(cyan);
					P.tc('Stopped', 2);
				}
			}
			
			P.T.reset();
			P.tr();
			
		} // -- end for --
		
		P.tline();
		
		P.p('Processed Total <yellow>(${AR.length})<!> services.');
		P.p('Changed state to <yellow>(${COUNT0})<!> services.');
		if(NEED_RESTART)
			P.p('You need to <cyan>restart<!> the computer to apply the changes.');
		P.line(50);
	}//---------------------------------------------------;
	
	
	// -- Helper, get the service object of an ID. Null if not found
	function service_get_by_id(id:String):Serv
	{
		for (s in SERV_DB) {
			if (s.ID == id) return s;
		}
		return null;
	}//---------------------------------------------------;
	
	
	//====================================================;
	// TASKS
	//====================================================;
	
	// Get all System tasks, along with run status and store in global array
	public function tasks_init()
	{
		if (TASKS_DB != null) return;
		TASKS_DB = [];
		TASKS_BAD = [];
		TASKS_CONF = [];
		
		// `schtasks /Query` to get all tasks infos
		var out = CLIApp.quickExecS('schtasks /Query /FO LIST') + "";
		var lines:Array<String> = out.split(Os.EOL);
		
		// Get All System Tasks
		var c = 1; // 
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
		}
		
		var conf = CONF.getTextArray('main', 'tasks');
		for (tid in conf) {
			var t = task_get(tid);
			if (t != null) {
				TASKS_CONF.push(t);
			}else{
				TASKS_BAD.push(tid);
			}
		}
	}//---------------------------------------------------;
	
	
	public function tasks_info()
	{
		tasks_init();
		
		// -- Print Info
		P.H("Tasks Info  : ", 0);
		P.p('These are the tasks that are defined in the <yellow>config.ini<!> file to be disabled');
		P.table("L,70|L,10,1");
		P.tline();
		P.T.fg(magenta);
		P.tr(['Task Name', 'Status']);
		P.T.reset();
		P.tline();
		//--
		var ACTIVE = 0;
		for (T in TASKS_CONF)
		{
			P.tc(T.PATH);
			if (T.STATUS == "Disabled"){
				P.T.fg(red);
			}else{
				P.T.fg(yellow);
				ACTIVE++;
			}
			P.tc(T.STATUS);
			P.T.reset();
			P.tr();
		}
		P.tline();

		// -- General Infos
		P.ptem('Total <darkgray>(valid)<!> Tasks in Config.ini : <yellow>{1}<!>', TASKS_CONF.length);
		P.ptem('Active : <yellow>{1}<!> | Disabled : <red>{2}<!>', ACTIVE, (TASKS_CONF.length - TASKS_BAD.length - ACTIVE));
		P.line(60);
		
		// -- Unavailable Task Paths
		if (TASKS_BAD.length > 0){
			P.ptem('<:yellow,black> WARNING: <!,yellow> ({1}) Tasks do not exist in Task Scheduler : <!>', cast TASKS_BAD.length);
			for (i in TASKS_BAD) {
				P.p('\t- $i');
			}
			P.line(60);
		}
	}//---------------------------------------------------;
	
	// From all tasks
	function task_get(path:String):TaskD
	{
		for (i in TASKS_DB) {
			if (i.PATH == path) return i;
		}return null;
	}//---------------------------------------------------;
	
	/**
	   Disable all tasks from Config File
	**/
	public function tasks_disable_conf()
	{
		tasks_init();
		
		P.H("Disabling ALL tasks: ", 0);
		P.p('- Tasks defined in the <yellow>config.ini<!> file');
		
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
		if(COUNT>0) P.p('Just disabled <yellow>(${COUNT})<!> Tasks.');
		if (CANNOT > 0) P.p('Could not disable <red>(${CANNOT})<!> Tasks.');
		
		P.line(50);
		
		// -- Unavailable Task Paths
		if (TASKS_BAD.length > 0){
			P.ptem('<:yellow,black> WARNING: <!,yellow> ({1}) Tasks do not exist in Task Scheduler : <!>', cast TASKS_BAD.length);
			for (i in TASKS_BAD) {
				P.p('\t- $i');
			}
			P.line(60);
		}
		P.p(" - DONE - ");
	}//---------------------------------------------------;	
	
	
	// Try to make a task owned by current user
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
	
	
	// --
	public function policy_apply()
	{
		P.H("Applying Group Policy Tweaks: ", 0);
		P.T.endl();
		reg_batch('gpolicy', true);
	}//---------------------------------------------------;
	
	
	/**
	 * Apply REGISTRY Tweaks and COMMAND Tweaks from the config file
	 */
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
		var D = CONF.getTextArray('main', 'commands');
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
		P.p("- DONE");
	}//---------------------------------------------------;
	
	
	// Apply reg values from a key in config.ini
	function reg_batch(key:String, displayKeys:Bool = false)
	{
		P.p('- Applying All Reg keys from <cyan>[$key]<!> in config.ini ::');
		P.line(60);
		var k = CONF.getTextArray('main', key);
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
		P.p("- DONE");
	}//---------------------------------------------------;
	
}//--)