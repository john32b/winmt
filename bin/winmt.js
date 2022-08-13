(function ($global) { "use strict";
var $estr = function() { return js_Boot.__string_rec(this,''); },$hxEnums = $hxEnums || {},$_;
function $extend(from, fields) {
	var proto = Object.create(from);
	for (var name in fields) proto[name] = fields[name];
	if( fields.toString !== Object.prototype.toString ) proto.toString = fields.toString;
	return proto;
}
var EReg = function(r,opt) {
	this.r = new RegExp(r,opt.split("u").join(""));
};
EReg.__name__ = true;
EReg.prototype = {
	match: function(s) {
		if(this.r.global) {
			this.r.lastIndex = 0;
		}
		this.r.m = this.r.exec(s);
		this.r.s = s;
		return this.r.m != null;
	}
	,matched: function(n) {
		if(this.r.m != null && n >= 0 && n < this.r.m.length) {
			return this.r.m[n];
		} else {
			throw haxe_Exception.thrown("EReg::matched");
		}
	}
	,matchedPos: function() {
		if(this.r.m == null) {
			throw haxe_Exception.thrown("No string matched");
		}
		return { pos : this.r.m.index, len : this.r.m[0].length};
	}
	,matchSub: function(s,pos,len) {
		if(len == null) {
			len = -1;
		}
		if(this.r.global) {
			this.r.lastIndex = pos;
			this.r.m = this.r.exec(len < 0 ? s : HxOverrides.substr(s,0,pos + len));
			var b = this.r.m != null;
			if(b) {
				this.r.s = s;
			}
			return b;
		} else {
			var b = this.match(len < 0 ? HxOverrides.substr(s,pos,null) : HxOverrides.substr(s,pos,len));
			if(b) {
				this.r.s = s;
				this.r.m.index += pos;
			}
			return b;
		}
	}
	,map: function(s,f) {
		var offset = 0;
		var buf_b = "";
		while(true) {
			if(offset >= s.length) {
				break;
			} else if(!this.matchSub(s,offset)) {
				buf_b += Std.string(HxOverrides.substr(s,offset,null));
				break;
			}
			var p = this.matchedPos();
			buf_b += Std.string(HxOverrides.substr(s,offset,p.pos - offset));
			buf_b += Std.string(f(this));
			if(p.len == 0) {
				buf_b += Std.string(HxOverrides.substr(s,p.pos,1));
				offset = p.pos + 1;
			} else {
				offset = p.pos + p.len;
			}
			if(!this.r.global) {
				break;
			}
		}
		if(!this.r.global && offset > 0 && offset < s.length) {
			buf_b += Std.string(HxOverrides.substr(s,offset,null));
		}
		return buf_b;
	}
};
var Engine = function() {
	this.T = djNode_BaseApp.TERMINAL;
	this.P = new djNode_utils_Print2();
	if(!sys_FileSystem.exists("config.ini")) {
		throw haxe_Exception.thrown("Config File does not exist. <" + "config.ini" + ">");
	}
	try {
		this.CONF = new djA_ConfigFileB(js_node_Fs.readFileSync("config.ini",{ encoding : "utf8"}));
	} catch( _g ) {
		var _g1 = haxe_Exception.caught(_g).unwrap();
		if(typeof(_g1) == "string") {
			var e = _g1;
			throw haxe_Exception.thrown("Error Parsing Config File : " + e);
		} else {
			throw _g;
		}
	}
};
Engine.__name__ = true;
Engine.prototype = {
	services_init: function() {
		if(this.SERV_DB != null) {
			return;
		}
		haxe_Log.trace("--> Getting Service Data ",{ fileName : "src/Engine.hx", lineNumber : 80, className : "Engine", methodName : "services_init"});
		this.SERV_DB = [];
		var out = djNode_utils_CLIApp.quickExecS("sc query type= all state= all") + "";
		var lines = out.split(js_node_Os.EOL);
		var c = 1;
		while(c < lines.length) {
			var s = new Serv();
			s.ID = StringTools.trim(lines[c++].split(":")[1]);
			s.DISPLAY_NAME = StringTools.trim(lines[c++].split(":")[1]);
			var reg01 = new EReg(".*:\\W(.*?)\\W+(.*?)\\W+","");
			if(reg01.match(lines[c++])) {
				s.TYPE = reg01.matched(2);
			} else {
				throw haxe_Exception.thrown("Parse Error : " + lines[c - 1] + " -- Could not get TYPE ");
			}
			if(reg01.match(lines[c++])) {
				s.STATE = reg01.matched(2);
				if(s.STATE != "STOPPED") {
					var regStop = new EReg(".*(NOT_STOPPABLE)","");
					if(regStop.match(lines[c++])) {
						s.STOPPABLE = false;
					}
				}
			} else {
				throw haxe_Exception.thrown("Parse Error : " + lines[c - 1] + " -- Could not get STATE ");
			}
			this.SERV_DB.push(s);
			c += 5;
		}
	}
	,services_sort: function(serv,type) {
		var sfn;
		switch(type) {
		case "state":
			sfn = function(a,b) {
				var aa = a.STATE.charAt(0).toLowerCase();
				var bb = b.STATE.charAt(0).toLowerCase();
				if(aa < bb) {
					return -1;
				}
				if(aa > bb) {
					return 1;
				}
				return 0;
			};
			break;
		case "type":
			var ar = ["WIN32_SHARE_PROCESS","WIN32_OWN_PROCESS","USER_SHARE_PROCESS"];
			sfn = function(a,b) {
				return ar.indexOf(a.TYPE) - ar.indexOf(b.TYPE);
			};
			break;
		default:
			sfn = function(a,b) {
				var aa = a.DISPLAY_NAME.charAt(0).toLowerCase();
				var bb = b.DISPLAY_NAME.charAt(0).toLowerCase();
				if(aa < bb) {
					return -1;
				}
				if(aa > bb) {
					return 1;
				}
				return 0;
			};
		}
		serv.sort(sfn);
		return serv;
	}
	,services_act_group: function(grp,act) {
		haxe_Log.trace("--> Services_act_group( " + grp + " , " + act + ") ",{ fileName : "src/Engine.hx", lineNumber : 170, className : "Engine", methodName : "services_act_group"});
		this.services_init();
		var o = this.services_get_group(grp);
		this.services_sort(o.serv,"ab");
		if(this.OPTIONS.sort != null) {
			this.services_sort(o.serv,this.OPTIONS.sort);
		}
		var ss;
		switch(grp) {
		case "all":
			ss = "All Services";
			break;
		case "blocklist":
			ss = "Blocklist";
			break;
		case "user":
			ss = "User services";
			break;
		default:
			ss = "Custom group " + grp;
		}
		this.P.p("- Service Group: <cyan>[" + grp + "]<!> : " + ss);
		switch(act) {
		case "disable":
			if(grp == "all") {
				throw haxe_Exception.thrown("For safety reasons. You cannot disable ALL services");
			}
			this.P.H(" Services Enable: ",0);
			this.services_batch_toggle(o.serv,true);
			break;
		case "enable":
			this.P.H(" Services Enable: ",0);
			this.services_batch_toggle(o.serv,false);
			break;
		case "info":
			this.P.H("Services Info  : ",0);
			this.services_info(o.serv);
			break;
		default:
			throw haxe_Exception.thrown("param");
		}
		if(o.bad.length > 0) {
			this.P.ptem("<:yellow,black> WARNING: <!,yellow> ({1}) Services could not be identified : <!>",o.bad.length);
			var _g = 0;
			var _g1 = o.bad;
			while(_g < _g1.length) {
				var i = _g1[_g];
				++_g;
				this.P.p("\t- " + i);
			}
			this.P.line(60);
		}
		this.P.p("- [OK] ");
	}
	,services_info: function(SERV) {
		var T_RUNNING = 0;
		if(this.OPTIONS.id) {
			this.P.table("L,48|L,30,1|L,10,1|L,12,1");
			this.P.tline();
			this.P.T.fg(djNode_TColor.magenta);
			this.P.tr(["Service","ID","Status","Type"]);
		} else {
			this.P.table("L,48|L,10,1|L,12,1");
			this.P.tline();
			this.P.T.fg(djNode_TColor.magenta);
			this.P.tr(["Service","Status","Type"]);
		}
		var _this = this.P.T;
		process.stdout.write("\x1B[0m");
		this.P.tline();
		var _g = 0;
		while(_g < SERV.length) {
			var serv = SERV[_g];
			++_g;
			var this_running = false;
			if(serv.isRunning()) {
				++T_RUNNING;
				this_running = true;
			}
			this.P.tc(serv.DISPLAY_NAME);
			if(this.OPTIONS.id) {
				this.P.tc(serv.ID);
			}
			this.P.T.fg(this_running ? djNode_TColor.green : djNode_TColor.red);
			this.P.tc(serv.STATE);
			if(serv.TYPE == "USER_SHARE_PROCESS") {
				this.P.T.fg(djNode_TColor.cyan);
				this.P.tc("USER");
			} else {
				this.P.T.fg(djNode_TColor.magenta);
				this.P.tc(serv.TYPE);
			}
			var _this = this.P.T;
			process.stdout.write("\x1B[0m");
			this.P.tr();
		}
		this.P.tline();
		this.P.ptem("Total <darkgray>(valid)<!> Services : <yellow>{1}<!>",SERV.length);
		this.P.ptem("Running : <green>{1}<!> | Stopped : <red>{2}<!>",T_RUNNING,SERV.length - T_RUNNING);
		this.P.line(60);
	}
	,services_get_group: function(group) {
		if(group == null) {
			throw haxe_Exception.thrown("param");
		}
		haxe_Log.trace("--> Services_get_group (" + group + ")",{ fileName : "src/Engine.hx", lineNumber : 290, className : "Engine", methodName : "services_get_group"});
		var S = [];
		var SBAD = [];
		if(group == "user") {
			var _g = [];
			var _g1 = 0;
			var _g2 = this.SERV_DB;
			while(_g1 < _g2.length) {
				var v = _g2[_g1];
				++_g1;
				if(v.TYPE == "USER_SHARE_PROCESS") {
					_g.push(v);
				}
			}
			S = _g;
			return { serv : S, bad : SBAD};
		}
		if(group == "all") {
			var _g = [];
			var _g1 = 0;
			var _g2 = this.SERV_DB;
			while(_g1 < _g2.length) {
				var v = _g2[_g1];
				++_g1;
				if(["KERNEL_DRIVER","FILE_SYSTEM_DRIVER"].indexOf(v.TYPE) == -1) {
					_g.push(v);
				}
			}
			S = _g;
			return { serv : S, bad : SBAD};
		}
		var SIDS = this.CONF.getTextArray("services",group);
		if(SIDS == null) {
			throw haxe_Exception.thrown("Cannot find [services]:" + group + " in <config.ini>");
		}
		var userServ = [];
		var _g = 0;
		var _g1 = SIDS.length;
		while(_g < _g1) {
			var c = _g++;
			if(HxOverrides.substr(SIDS[c],0,2) == "u-") {
				var sname = HxOverrides.substr(SIDS[c],2,null).toLowerCase();
				var found = false;
				var _g2 = 0;
				var _g3 = this.SERV_DB;
				while(_g2 < _g3.length) {
					var s = _g3[_g2];
					++_g2;
					if(s.ID.toLowerCase().indexOf(sname) == 0) {
						found = true;
						userServ.push(s.ID);
					}
				}
				if(!found) {
					SBAD.push("USER:" + SIDS[c]);
				}
				SIDS[c] = "";
			}
		}
		SIDS = SIDS.concat(userServ);
		var _g = 0;
		while(_g < SIDS.length) {
			var sid = SIDS[_g];
			++_g;
			if(sid == "") {
				continue;
			}
			var serv = this.service_get_by_id(sid);
			if(serv == null) {
				SBAD.push(sid);
				haxe_Log.trace("Warning, service ID \"" + sid + "\" Does not exist",{ fileName : "src/Engine.hx", lineNumber : 349, className : "Engine", methodName : "services_get_group"});
			} else {
				S.push(serv);
			}
		}
		return { serv : S, bad : SBAD};
	}
	,services_batch_toggle: function(AR,_disable) {
		if(_disable == null) {
			_disable = true;
		}
		this.P.table("L,54|R,14,1|R,12,2");
		this.P.tline();
		this.P.T.fg(djNode_TColor.magenta);
		this.P.tr(["Service","Run","State"]);
		var _this = this.P.T;
		process.stdout.write("\x1B[0m");
		this.P.tline();
		var NEED_RESTART = false;
		var COUNT0 = 0;
		var _g = 0;
		while(_g < AR.length) {
			var serv = AR[_g];
			++_g;
			this.P.tc(serv.DISPLAY_NAME,1);
			this.P.tc("...",2);
			if(!_disable) {
				var r = serv.enable();
				if(r == "error") {
					this.P.T.fg(djNode_TColor.red);
					this.P.tc("Can't Enable",3);
				} else if(r == "reg") {
					NEED_RESTART = true;
					this.P.T.fg(djNode_TColor.yellow);
					this.P.tc("Enabled REG",3);
				} else {
					this.P.T.fg(djNode_TColor.green);
					this.P.tc("Enabled",3);
				}
				if(serv.isRunning()) {
					this.P.T.fg(djNode_TColor.green);
					this.P.tc("Was running",2);
				} else {
					var _this = this.P.T;
					process.stdout.write("\x1B[39m");
					this.P.tc("...",2);
					if(serv.start()) {
						this.P.T.fg(djNode_TColor.green);
						this.P.tc("Started",2);
						++COUNT0;
					} else {
						this.P.T.fg(djNode_TColor.red);
						this.P.tc("Can't Start",2);
					}
				}
			} else {
				var r1 = serv.disable();
				if(r1 == "error") {
					this.P.T.fg(djNode_TColor.red);
					this.P.tc("Can't Disable",3);
				} else if(r1 == "reg") {
					NEED_RESTART = true;
					this.P.T.fg(djNode_TColor.yellow);
					this.P.tc("Disabled REG",3);
				} else {
					this.P.T.fg(djNode_TColor.green);
					this.P.tc("Disabled",3);
				}
				if(r1 == "reg") {
					NEED_RESTART = true;
				}
				if(!serv.isRunning()) {
					this.P.T.fg(djNode_TColor.green);
					this.P.tc("Was stopped",2);
				} else {
					var _this1 = this.P.T;
					process.stdout.write("\x1B[39m");
					this.P.tc("...",2);
					if(serv.stop()) {
						this.P.T.fg(djNode_TColor.green);
						this.P.tc("Stopped",2);
						++COUNT0;
					} else {
						this.P.T.fg(djNode_TColor.red);
						this.P.tc("Can't Stop",2);
					}
				}
			}
			var _this2 = this.P.T;
			process.stdout.write("\x1B[0m");
			this.P.tr();
		}
		this.P.tline();
		this.P.p("Processed Total <yellow>(" + AR.length + ")<!> services.");
		this.P.p("Changed state to <yellow>(" + COUNT0 + ")<!> services.");
		if(NEED_RESTART) {
			this.P.p("You need to <cyan>restart<!> the computer to apply the changes.");
		}
		this.P.line(50);
	}
	,service_get_by_id: function(id) {
		var _g = 0;
		var _g1 = this.SERV_DB;
		while(_g < _g1.length) {
			var s = _g1[_g];
			++_g;
			if(s.ID == id) {
				return s;
			}
		}
		return null;
	}
	,tasks_init: function() {
		var _gthis = this;
		if(this.TASKS_DB != null) {
			return;
		}
		this.TASKS_DB = [];
		this.TASKS_BAD = [];
		this.TASKS_CONF = [];
		var out = djNode_utils_CLIApp.quickExecS("schtasks /Query /FO LIST") + "";
		var lines = out.split(js_node_Os.EOL);
		var c = 1;
		while(c < lines.length) {
			var line = lines[c++];
			if(HxOverrides.substr(line,0,9) == "TaskName:") {
				var t_name = StringTools.trim(HxOverrides.substr(line,9,null));
				var status = StringTools.trim(HxOverrides.substr(lines[c + 1],7,null));
				var T = new TaskD();
				T.PATH = t_name;
				T.STATUS = status;
				this.TASKS_DB.push(T);
				c += 3;
			}
		}
		var task_get = function(path) {
			var _g = 0;
			var _g1 = _gthis.TASKS_DB;
			while(_g < _g1.length) {
				var i = _g1[_g];
				++_g;
				if(i.PATH == path) {
					return i;
				}
			}
			return null;
		};
		var conf = this.CONF.getTextArray("tweaks","tasks");
		var _g = 0;
		while(_g < conf.length) {
			var tid = conf[_g];
			++_g;
			var t = task_get(tid);
			if(t != null) {
				this.TASKS_CONF.push(t);
			} else {
				this.TASKS_BAD.push(tid);
			}
		}
	}
	,tasks_apply_blocklist: function() {
		this.tasks_init();
		this.P.H("Disabling ALL tasks: ",0);
		this.P.p("- Tasks defined in <yellow>config.ini<!>");
		this.P.table("L,60|R,18,1");
		this.P.tline();
		this.P.T.fg(djNode_TColor.magenta);
		this.P.tr(["Task","Status"]);
		var _this = this.P.T;
		process.stdout.write("\x1B[0m");
		this.P.tline();
		var COUNT = 0;
		var CANNOT = 0;
		var _g = 0;
		var _g1 = this.TASKS_CONF;
		while(_g < _g1.length) {
			var T = _g1[_g];
			++_g;
			this.P.tc(T.PATH,1);
			if(T.isDisabled()) {
				this.P.T.fg(djNode_TColor.cyan);
				this.P.tc("Disabled");
				var _this = this.P.T;
				process.stdout.write("\x1B[0m");
				this.P.tr();
				continue;
			}
			this.P.tc("...",2);
			var res = djNode_utils_CLIApp.quickExecS("schtasks /change /tn \"" + T.PATH + "\" /disable");
			if(res == null) {
				this.P.T.fg(djNode_TColor.red);
				this.P.tc("Failed",2);
				++CANNOT;
			} else {
				this.P.T.fg(djNode_TColor.cyan);
				this.P.tc("Disabled",2);
				++COUNT;
			}
			var _this1 = this.P.T;
			process.stdout.write("\x1B[0m");
			this.P.tr();
		}
		this.P.tline();
		this.P.p("Processed Total <yellow>(" + this.TASKS_CONF.length + ")<!> Tasks.");
		if(COUNT > 0) {
			this.P.p("Just disabled <yellow>(" + COUNT + ")<!> Tasks.");
		}
		if(CANNOT > 0) {
			this.P.p("Could not disable <red>(" + CANNOT + ")<!> Tasks.");
		}
		this.P.line(50);
		if(this.TASKS_BAD.length > 0) {
			this.P.ptem("<:yellow,black> WARNING: <!,yellow> ({1}) Tasks do not exist in Task Scheduler : <!>",this.TASKS_BAD.length);
			var _g = 0;
			var _g1 = this.TASKS_BAD;
			while(_g < _g1.length) {
				var i = _g1[_g];
				++_g;
				this.P.p("\t- " + i);
			}
			this.P.line(60);
		}
		this.P.p("- [OK] ");
	}
	,task_fix_permissions: function(t) {
		var path = js_node_Path.join(process.env["windir"],"System32\\Tasks");
		path = js_node_Path.join(path,t.PATH);
		var op1 = djNode_utils_CLIApp.quickExecS("takeown /f \"" + path + "\"");
		if(op1 == null) {
			haxe_Log.trace("Cannot takeown for ",{ fileName : "src/Engine.hx", lineNumber : 591, className : "Engine", methodName : "task_fix_permissions", customParams : [path]});
			return false;
		}
		var user = js_node_Os.userInfo().username;
		var op2 = djNode_utils_CLIApp.quickExecS("icacls \"" + path + "\" /grant " + user + ":f");
		if(op2 == null) {
			haxe_Log.trace("Cannot change permissions",{ fileName : "src/Engine.hx", lineNumber : 599, className : "Engine", methodName : "task_fix_permissions", customParams : [path]});
			return false;
		}
		haxe_Log.trace("task fixed ok",{ fileName : "src/Engine.hx", lineNumber : 603, className : "Engine", methodName : "task_fix_permissions"});
		return true;
	}
	,policy_apply: function() {
		this.P.H("Applying Group Policy Tweaks: ",0);
		var _this = this.P.T;
		process.stdout.write("\n");
		this.reg_batch("gpolicy",true);
	}
	,tweaks_apply: function() {
		this.P.H("Applying Registry Tweaks: ",0);
		var _this = this.P.T;
		process.stdout.write("\n");
		this.reg_batch("reg",false);
		var _this = this.P.T;
		process.stdout.write("\n");
		this.P.H("Applying Other Tweaks : ",0);
		var _this = this.P.T;
		process.stdout.write("\n");
		this.P.line(60);
		var D = this.CONF.getTextArray("tweaks","commands");
		var _g = 0;
		while(_g < D.length) {
			var l = D[_g];
			++_g;
			l = StringTools.trim(l);
			if(l.length == 0) {
				continue;
			}
			if(l.charAt(0) == "+") {
				this.P.p("+ <yellow>" + HxOverrides.substr(l,1,null) + "<!>");
				continue;
			}
			djNode_utils_CLIApp.quickExecS(l);
		}
		this.P.line(60);
		this.P.p("- [OK] ");
	}
	,reg_batch: function(key,displayKeys) {
		if(displayKeys == null) {
			displayKeys = false;
		}
		this.P.p("- Applying All Reg keys from <cyan>[" + key + "]<!>:");
		this.P.line(60);
		var k = this.CONF.getTextArray("tweaks",key);
		var c_key = "";
		var _g = 0;
		while(_g < k.length) {
			var line = k[_g];
			++_g;
			line = StringTools.trim(line);
			if(line.length == 0) {
				continue;
			}
			if(line.charAt(0) == "+") {
				this.P.p("+ <yellow>" + HxOverrides.substr(line,1,null) + "<!>");
				continue;
			}
			if(line.indexOf("HKEY") == 0) {
				c_key = line;
				if(displayKeys) {
					this.P.p(" + <yellow>" + c_key + "<!>");
				}
				continue;
			}
			if(line.charAt(0) == "-") {
				c_key = HxOverrides.substr(line,1,null);
				if(displayKeys) {
					this.P.p(" + <red>DELETING<!> : <yellow>" + c_key + "<!>");
				}
				djNode_utils_Registry.deleteKey(c_key);
				continue;
			}
			var d = line.split(" ");
			if(displayKeys) {
				this.P.p("     " + d[0] + " = <green,bold>" + d[1] + "<!>");
			}
			djNode_utils_Registry.setValueDWord(c_key,d[0],d[1]);
		}
		this.P.line(60);
		this.P.p("- [OK] ");
	}
};
var HxOverrides = function() { };
HxOverrides.__name__ = true;
HxOverrides.dateStr = function(date) {
	var m = date.getMonth() + 1;
	var d = date.getDate();
	var h = date.getHours();
	var mi = date.getMinutes();
	var s = date.getSeconds();
	return date.getFullYear() + "-" + (m < 10 ? "0" + m : "" + m) + "-" + (d < 10 ? "0" + d : "" + d) + " " + (h < 10 ? "0" + h : "" + h) + ":" + (mi < 10 ? "0" + mi : "" + mi) + ":" + (s < 10 ? "0" + s : "" + s);
};
HxOverrides.cca = function(s,index) {
	var x = s.charCodeAt(index);
	if(x != x) {
		return undefined;
	}
	return x;
};
HxOverrides.substr = function(s,pos,len) {
	if(len == null) {
		len = s.length;
	} else if(len < 0) {
		if(pos == 0) {
			len = s.length + len;
		} else {
			return "";
		}
	}
	return s.substr(pos,len);
};
HxOverrides.now = function() {
	return Date.now();
};
var djNode_BaseApp = function() {
	this.argsAction = null;
	this.argsOptions = { };
	this.argsOutput = null;
	this.argsInput = [];
	this.ARGS = { inputRule : "no", outputRule : "no", requireAction : false, resolveWildcards : true, helpInput : null, helpOutput : null, helpText : null, Actions : [], Options : []};
	this.PROGRAM_INFO = { name : "CLI Application", version : "0.1"};
	this.HELP_MARGIN = 16;
	var _gthis = this;
	djNode_BaseApp.app = this;
	djNode_tools_LOG.init();
	this.set_FLAG_USE_SLASH_FOR_OPTION(false);
	this.T = djNode_BaseApp.TERMINAL = new djNode_Terminal();
	process.once("exit",$bind(this,this.onExit));
	process.once("SIGINT",function() {
		process.exit(1223);
	});
	process.once("uncaughtException",function(err) {
		_gthis.onExit(1);
		if(((err) instanceof Error)) {
			throw haxe_Exception.thrown(err);
		}
	});
	try {
		this.init();
	} catch( _g ) {
		var _g1 = haxe_Exception.caught(_g).unwrap();
		if(typeof(_g1) == "string") {
			var e = _g1;
			this.printBanner(true);
			if(e == "HELP") {
				this.printHelp();
				process.exit(0);
			}
			this.exitError(e,true);
		} else {
			throw _g;
		}
	}
	djNode_tools_LOG.log("- Inputs : " + this.argsInput.join(", "),null,{ fileName : "djNode/BaseApp.hx", lineNumber : 166, className : "djNode.BaseApp", methodName : "new"});
	djNode_tools_LOG.log("- Output : " + this.argsOutput,null,{ fileName : "djNode/BaseApp.hx", lineNumber : 167, className : "djNode.BaseApp", methodName : "new"});
	djNode_tools_LOG.log("- Action  set : " + this.argsAction,null,{ fileName : "djNode/BaseApp.hx", lineNumber : 168, className : "djNode.BaseApp", methodName : "new"});
	djNode_tools_LOG.log("- Options set : ",null,{ fileName : "djNode/BaseApp.hx", lineNumber : 169, className : "djNode.BaseApp", methodName : "new"});
	var _g = 0;
	var _g1 = Reflect.fields(this.argsOptions);
	while(_g < _g1.length) {
		var o = _g1[_g];
		++_g;
		djNode_tools_LOG.log("\t\t" + o + " : " + Std.string(Reflect.getProperty(this.argsOptions,o)),null,{ fileName : "djNode/BaseApp.hx", lineNumber : 171, className : "djNode.BaseApp", methodName : "new"});
	}
	djNode_tools_LOG.log(djA_StrT.rep(40,"─"),null,{ fileName : "djNode/BaseApp.hx", lineNumber : 173, className : "djNode.BaseApp", methodName : "new"});
	process.nextTick($bind(this,this.onStart));
};
djNode_BaseApp.__name__ = true;
djNode_BaseApp.prototype = {
	set_FLAG_USE_SLASH_FOR_OPTION: function(v) {
		this.FLAG_USE_SLASH_FOR_OPTION = v;
		if(v) {
			this._sb = ["/","?"];
		} else {
			this._sb = ["-","help"];
		}
		return v;
	}
	,init: function() {
		var _this = this.T;
		process.stdout.write("\x1B[0m");
		this.ARGS.Options.unshift(["o","-output","yes"]);
		var P = this.PROGRAM_INFO;
		var A = this.ARGS;
		if(P.executable == null) {
			P.executable = js_node_Path.basename(__filename);
		}
		djNode_tools_LOG.log("Creating Application [ " + P.name + " ,v" + P.version + " ]",null,{ fileName : "djNode/BaseApp.hx", lineNumber : 205, className : "djNode.BaseApp", methodName : "init"});
		var cc = 0;
		var $arguments = process.argv.slice(2);
		var arg;
		while(true) {
			arg = $arguments[cc++];
			if(!(arg != null)) {
				break;
			}
			if(arg.charAt(0) == this._sb[0]) {
				if(arg.toLowerCase().indexOf(this._sb[1]) == 1) {
					throw haxe_Exception.thrown("HELP");
				}
				var o = this.getArgOption(HxOverrides.substr(arg,1,null));
				if(o == null) {
					throw haxe_Exception.thrown("Illegal argument [" + arg + "]");
				}
				if(o[2] != null) {
					var nextArg = $arguments[cc++];
					if(nextArg == null || this.getArgOption(nextArg) != null) {
						throw haxe_Exception.thrown("Argument [" + arg + "] requires a parameter");
					}
					this.argsOptions[o[0]] = nextArg;
				} else {
					this.argsOptions[o[0]] = true;
				}
				continue;
			}
			var a = this.getArgAction(arg);
			if(a != null) {
				if(this.argsAction == null) {
					this.argsAction = a[0];
					continue;
				}
			}
			this.argsInput.push(arg);
		}
		if(this.argsOptions.o != null) {
			this.argsOutput = this.argsOptions.o;
		}
		if(this.ARGS.resolveWildcards) {
			var _g = 0;
			var _g1 = this.argsInput;
			while(_g < _g1.length) {
				var i = _g1[_g];
				++_g;
				if(i.indexOf("*") >= 0) {
					if(this.argsInput.length > 1) {
						throw haxe_Exception.thrown("Multiple Inputs with wildcards are not supported");
					}
					this.argsInput = djNode_tools_FileTool.getFileListFromWildcard(i);
					if(this.argsInput.length == 0) {
						throw haxe_Exception.thrown("Wildcard `" + i + "` returned 0 files");
					}
					break;
				}
			}
		}
		if(this.argsAction == null && this.argsInput.length > 0) {
			var act = this.getArgAction(null,HxOverrides.substr(js_node_Path.extname(this.argsInput[0].toLowerCase()),1,null));
			if(act != null) {
				this.argsAction = act[0];
			}
		}
		if(this.argsInput.length == 0 && ["yes","multi"].indexOf(A.inputRule) >= 0) {
			throw haxe_Exception.thrown("Input is required");
		}
		if(this.argsOutput == null && A.outputRule == "yes") {
			throw haxe_Exception.thrown("Output is required");
		}
		if(A.requireAction && this.argsAction == null) {
			throw haxe_Exception.thrown("Setting an action is required");
		}
		var _g = 0;
		var _g1 = this.ARGS.Options;
		while(_g < _g1.length) {
			var o = _g1[_g];
			++_g;
			if(o[2] == null) {
				if(!Object.prototype.hasOwnProperty.call(this.argsOptions,o[0])) {
					this.argsOptions[o[0]] = false;
				}
			}
		}
	}
	,onStart: function() {
	}
	,onExit: function(code) {
		if(this.onExit_ != null) {
			this.onExit_(code);
		}
		djNode_tools_LOG.log("==> [EXIT] with code " + code,null,{ fileName : "djNode/BaseApp.hx", lineNumber : 329, className : "djNode.BaseApp", methodName : "onExit"});
		djNode_tools_LOG.end();
		var _this = this.T;
		process.stdout.write("\x1B[0m");
		this.T.cursorShow();
	}
	,printHelp: function() {
		var _gthis = this;
		var A = this.ARGS;
		var P = this.PROGRAM_INFO;
		var sp = function(s) {
			return djA_StrT.rep(s," ");
		};
		var __fixDescFormat = function(s,b) {
			var S;
			if(djA_StrT.isEmpty(s)) {
				S = "...";
			} else {
				var _this_r = new RegExp("(\n)","g".split("u").join(""));
				var by = "\n " + sp(_gthis.HELP_MARGIN);
				S = s.replace(_this_r,by);
			}
			var g = S.split("\n");
			g[0] += b;
			return g.join("\n");
		};
		this.T.ptag("<green> Program Usage:\n");
		var s = "   " + P.executable + " ";
		if(A.Actions.length > 0) {
			s += "<action> ";
		}
		if(A.Options.length > 1) {
			s += "[<options>...] ";
		}
		if(A.inputRule != "no") {
			s += A.inputRule == "multi" ? "[<inputs>...] " : "<input> ";
		}
		if(A.outputRule != "no") {
			s += this._sb[0] + "o <output> ";
		}
		var _this = this.T.ptag("<bold,white>" + s + "<!>\n").fg(djNode_TColor.darkgray);
		var str = djA_StrT.rep(40,"─");
		process.stdout.write(str + "\n");
		var _prtIO = function(r,lab,txt) {
			if(r == "no") {
				return false;
			}
			_gthis.T.ptag("<yellow> [" + lab + "] <!> is " + (r == "opt" ? "optional." : "required."));
			if(r == "multi") {
				_gthis.T.ptag("<darkgray> (multiple supported)");
			}
			var _this = _gthis.T;
			process.stdout.write("\n");
			if(txt != null) {
				var _this_r = new RegExp("(\n)","g".split("u").join(""));
				txt = "<gray>\t " + txt.replace(_this_r,"\n\t ");
				var _this = _gthis.T.ptag(txt);
				process.stdout.write("\n");
			}
			return true;
		};
		var a = _prtIO(A.inputRule,"input",A.helpInput);
		var b = _prtIO(A.outputRule,"output",A.helpOutput);
		if(a || b) {
			var _this = this.T.ptag(" <darkgray>" + djA_StrT.rep(40,"─"));
			process.stdout.write("\n");
		}
		var _this = this.T;
		process.stdout.write("\x1B[0m");
		if(A.Actions.length > 0) {
			this.T.ptag("<magenta> [actions] ");
			this.T.ptag("<darkmagenta>(you can set one action at a time)<!>\n");
			var _g = 0;
			var _g1 = A.Actions;
			while(_g < _g1.length) {
				var i = _g1[_g];
				++_g;
				if(i[1].charAt(0) == "-") {
					continue;
				}
				i[1] = __fixDescFormat(i[1],i[2] == null ? "" : "<darkgray> | auto ext:[" + i[2] + "] <!>");
				this.T.fg(djNode_TColor.white).bold();
				var _this = this.T.ptag(" " + i[0] + sp(this.HELP_MARGIN - i[0].length));
				process.stdout.write("\x1B[0m");
				_this.ptag(i[1]);
				var _this1 = this.T;
				process.stdout.write("\n");
			}
		}
		if(A.Options.length > 1) {
			this.T.ptag("<cyan> [options] ");
			this.T.ptag("<darkcyan>(you can set multiple options)<!>\n");
			var _g = 0;
			var _g1 = A.Options;
			while(_g < _g1.length) {
				var i = _g1[_g];
				++_g;
				if(i[1].charAt(0) == "-") {
					continue;
				}
				i[1] = __fixDescFormat(i[1],i[2] == null ? "" : "<darkgray> (requires parameter) <!>");
				this.T.fg(djNode_TColor.white).bold();
				var _this = this.T.ptag(" " + this._sb[0] + i[0] + sp(this.HELP_MARGIN - i[0].length - 1));
				process.stdout.write("\x1B[0m");
				_this.ptag(i[1]);
				var _this1 = this.T;
				process.stdout.write("\n");
			}
		}
		if(this.ARGS.helpText != null) {
			var _this = this.T;
			process.stdout.write("\n");
			this.T.ptag("" + this.ARGS.helpText + "\n");
		}
	}
	,printBanner: function(longer) {
		if(longer == null) {
			longer = false;
		}
		var P = this.PROGRAM_INFO;
		var col = "cyan";
		var _this = this.T;
		process.stdout.write("\n");
		this.T.ptag("<:" + col + ",black>==<!><" + col + ",bold> " + P.name + " <darkgray>v" + P.version + "<!>");
		if(longer) {
			if(P.author != null) {
				this.T.ptag(" by " + P.author);
			}
			var _this = this.T;
			process.stdout.write("\n");
			if(P.info != null) {
				this.T.ptag(" - " + P.info + "\n");
			}
			if(P.desc != null) {
				this.T.ptag(" - " + P.desc + "\n");
			}
		} else {
			var _this = this.T;
			process.stdout.write("\n");
		}
		this.T.ptag("<" + Std.string(djNode_TColor.darkgray) + ">" + djA_StrT.rep(40,"─") + "<!>\n");
	}
	,getArgOption: function(tag) {
		var _g = 0;
		var _g1 = this.ARGS.Options;
		while(_g < _g1.length) {
			var o = _g1[_g];
			++_g;
			if(o[0] == tag) {
				return o;
			}
		}
		return null;
	}
	,getArgAction: function(tag,ext) {
		var _g = 0;
		var _g1 = this.ARGS.Actions;
		while(_g < _g1.length) {
			var a = _g1[_g];
			++_g;
			if(tag != null && a[0] == tag) {
				return a;
			}
			if(ext != null && a[2] != null) {
				if(a[2].split(",").indexOf(ext.toLowerCase()) >= 0) {
					return a;
				}
			}
		}
		return null;
	}
	,exitError: function(text,showHelp) {
		if(showHelp == null) {
			showHelp = false;
		}
		this.T.ptag("\n<:darkred,white> ERROR <!> " + text + "<!>\n");
		if(showHelp) {
			this.T.ptag("<darkgray>" + djA_StrT.rep(40,"─") + ("\n<yellow> " + this._sb[0] + this._sb[1] + " <!> for usage info\n"));
		}
		djNode_tools_LOG.FLAG_STDOUT = false;
		djNode_tools_LOG.log(this.T.PARSED_NOTAG,4,{ fileName : "djNode/BaseApp.hx", lineNumber : 490, className : "djNode.BaseApp", methodName : "exitError"});
		process.exit(1);
	}
	,isAdmin: function() {
		var res = djNode_utils_CLIApp.quickExecS("fsutil dirty query %systemdrive% >nul");
		return res != null;
	}
	,autoCallAction: function() {
		var fn = Reflect.field(this,"action_" + this.argsAction);
		if(fn != null && Reflect.isFunction(fn)) {
			return fn.apply(this,[]);
		}
		return null;
	}
	,waitKeyQuit: function() {
		this.T.ptag("\n<darkgray>Press any key to quit.<!>\n");
		djNode_Keyboard.startCapture(true,function(e) {
			process.exit(0);
		});
	}
	,getAppPathJoin: function(p) {
		return js_node_Path.join(__dirname,p);
	}
	,__properties__: {set_FLAG_USE_SLASH_FOR_OPTION:"set_FLAG_USE_SLASH_FOR_OPTION"}
};
var Main = function() {
	djNode_BaseApp.call(this);
};
Main.__name__ = true;
Main.main = function() {
	new Main();
};
Main.__super__ = djNode_BaseApp;
Main.prototype = $extend(djNode_BaseApp.prototype,{
	init: function() {
		this.PROGRAM_INFO = { name : "Win10 - My Tools (winmt)", version : "0.2", desc : "Applies Tweaks, handles services. <bold,black,:cyan>-- Use at your own risk! --<!>"};
		this.ARGS.helpText = "Tweaks of services/tasks/registry are defined in <yellow>\"config.ini\"<!>";
		this.ARGS.Actions = [["serv","(1)<blue>[all, blocklist, user, {Group}]<!> (2)<blue>[enable, disable, info]<!>\n" + "e.g. serv blocklist disable<darkgray>  > Disable all services in `blocklist`<!>"],["tweaks","Apply a set of tweaks. Task Scheduler, Group Policy, Registry and others."]];
		this.ARGS.Options = [["sort","When displaying service infos, sort by <blue>[state, type]<!>.","yes"],["id","When displaying service infos, display the service ID as well"],["log","Write debug logs to a file","yes"]];
		djNode_BaseApp.prototype.init.call(this);
		if(this.argsOptions.log != null) {
			djNode_tools_LOG.pipeTrace();
			djNode_tools_LOG.setLogFile(this.argsOptions.log);
			djNode_tools_LOG.FLAG_SHOW_POS = false;
			djNode_utils_CLIApp.FLAG_LOG_QUIET = false;
		}
	}
	,onStart: function() {
		if(this.argsAction == null) {
			this.printBanner(true);
			this.printHelp();
			return;
		} else {
			this.printBanner();
		}
		if(!this.isAdmin()) {
			this.exitError("You need to run this with Administrator rights");
		}
		djNode_utils_Print2.H_STYLES[0].line = null;
		try {
			this.E = new Engine();
		} catch( _g ) {
			var _g1 = haxe_Exception.caught(_g).unwrap();
			if(typeof(_g1) == "string") {
				var err = _g1;
				this.exitError(err);
			} else {
				throw _g;
			}
		}
		this.E.OPTIONS = this.argsOptions;
		switch(this.argsAction) {
		case "serv":
			var helpText = "Correct format : <yellow>serv<!> <cyan>[all, blocklist, user, {Group}]<!> <magenta>[enable, disable, info]<!>";
			if(this.argsInput[0] == null || this.argsInput[1] == null) {
				this.exitError(helpText);
			}
			if(["enable","disable","info"].indexOf(this.argsInput[1]) < 0) {
				this.exitError(helpText);
			}
			try {
				this.E.services_act_group(this.argsInput[0],this.argsInput[1]);
			} catch( _g ) {
				var _g1 = haxe_Exception.caught(_g).unwrap();
				if(typeof(_g1) == "string") {
					var e = _g1;
					if(e == "param") {
						this.exitError(helpText);
					}
					this.exitError(e);
				} else {
					throw _g;
				}
			}
			break;
		case "tweaks":
			this.E.policy_apply();
			var _this = this.T;
			process.stdout.write("\n");
			this.E.tasks_apply_blocklist();
			var _this = this.T;
			process.stdout.write("\n");
			this.E.tweaks_apply();
			var _this = this.T;
			process.stdout.write("\n");
			break;
		default:
		}
	}
});
Math.__name__ = true;
var Reflect = function() { };
Reflect.__name__ = true;
Reflect.field = function(o,field) {
	try {
		return o[field];
	} catch( _g ) {
		return null;
	}
};
Reflect.getProperty = function(o,field) {
	var tmp;
	if(o == null) {
		return null;
	} else {
		var tmp1;
		if(o.__properties__) {
			tmp = o.__properties__["get_" + field];
			tmp1 = tmp;
		} else {
			tmp1 = false;
		}
		if(tmp1) {
			return o[tmp]();
		} else {
			return o[field];
		}
	}
};
Reflect.fields = function(o) {
	var a = [];
	if(o != null) {
		var hasOwnProperty = Object.prototype.hasOwnProperty;
		for( var f in o ) {
		if(f != "__id__" && f != "hx__closures__" && hasOwnProperty.call(o,f)) {
			a.push(f);
		}
		}
	}
	return a;
};
Reflect.isFunction = function(f) {
	if(typeof(f) == "function") {
		return !(f.__name__ || f.__ename__);
	} else {
		return false;
	}
};
Reflect.compare = function(a,b) {
	if(a == b) {
		return 0;
	} else if(a > b) {
		return 1;
	} else {
		return -1;
	}
};
Reflect.isEnumValue = function(v) {
	if(v != null) {
		return v.__enum__ != null;
	} else {
		return false;
	}
};
var Serv = function() {
	this.STOPPABLE = true;
};
Serv.__name__ = true;
Serv.prototype = {
	isRunning: function() {
		return this.STATE == "RUNNING";
	}
	,disable_reg: function() {
		haxe_Log.trace("Disabling (" + this.ID + ") with the Registry",{ fileName : "src/Serv.hx", lineNumber : 53, className : "Serv", methodName : "disable_reg"});
		var res = djNode_utils_Registry.setValueDWord("HKLM\\SYSTEM\\CurrentControlSet\\Services\\" + this.ID,"Start","4");
		return res;
	}
	,enable_reg: function() {
		haxe_Log.trace("Enabling (" + this.ID + ") with the Registry",{ fileName : "src/Serv.hx", lineNumber : 60, className : "Serv", methodName : "enable_reg"});
		var res = djNode_utils_Registry.setValueDWord("HKLM\\SYSTEM\\CurrentControlSet\\Services\\" + this.ID,"Start","3");
		return res;
	}
	,disable: function() {
		haxe_Log.trace("  .Disabling `(" + this.ID + ") : " + this.DISPLAY_NAME + "`",{ fileName : "src/Serv.hx", lineNumber : 74, className : "Serv", methodName : "disable"});
		var res = djNode_utils_CLIApp.quickExecS("sc config " + this.ID + " start= disabled");
		if(res == null) {
			haxe_Log.trace("Cannot disable with `sc` command, Trying with Registry",{ fileName : "src/Serv.hx", lineNumber : 78, className : "Serv", methodName : "disable"});
			if(this.disable_reg()) {
				haxe_Log.trace("REG OK",{ fileName : "src/Serv.hx", lineNumber : 80, className : "Serv", methodName : "disable"});
				return "reg";
			} else {
				haxe_Log.trace("REG FAIL",{ fileName : "src/Serv.hx", lineNumber : 83, className : "Serv", methodName : "disable"});
				return "error";
			}
		}
		return "ok";
	}
	,enable: function() {
		haxe_Log.trace("  .Enabling `(" + this.ID + ") : " + this.DISPLAY_NAME + "`",{ fileName : "src/Serv.hx", lineNumber : 101, className : "Serv", methodName : "enable"});
		var res = djNode_utils_CLIApp.quickExecS("sc config " + this.ID + " start= demand");
		if(res == null) {
			haxe_Log.trace("Cannot enable with `sc` command, Trying with Registry",{ fileName : "src/Serv.hx", lineNumber : 105, className : "Serv", methodName : "enable"});
			if(this.enable_reg()) {
				haxe_Log.trace("REG OK",{ fileName : "src/Serv.hx", lineNumber : 107, className : "Serv", methodName : "enable"});
				return "reg";
			} else {
				haxe_Log.trace(". Cannot Enable",{ fileName : "src/Serv.hx", lineNumber : 110, className : "Serv", methodName : "enable"});
				return "error";
			}
		}
		haxe_Log.trace(". Enabled OK",{ fileName : "src/Serv.hx", lineNumber : 114, className : "Serv", methodName : "enable"});
		return "ok";
	}
	,stop: function() {
		haxe_Log.trace("  .Stopping `" + this.DISPLAY_NAME + "`",{ fileName : "src/Serv.hx", lineNumber : 120, className : "Serv", methodName : "stop"});
		var res = djNode_utils_CLIApp.quickExecS("sc stop " + this.ID);
		if(res == null) {
			haxe_Log.trace(". Cannot stop",{ fileName : "src/Serv.hx", lineNumber : 125, className : "Serv", methodName : "stop"});
			return false;
		}
		this.STATE = "STOPPED";
		haxe_Log.trace(". Stopped OK",{ fileName : "src/Serv.hx", lineNumber : 130, className : "Serv", methodName : "stop"});
		return true;
	}
	,start: function() {
		haxe_Log.trace("  .Starting `" + this.DISPLAY_NAME + "`",{ fileName : "src/Serv.hx", lineNumber : 136, className : "Serv", methodName : "start"});
		var res = djNode_utils_CLIApp.quickExecS("sc start " + this.ID);
		if(res == null) {
			haxe_Log.trace(". Cannot start",{ fileName : "src/Serv.hx", lineNumber : 140, className : "Serv", methodName : "start"});
			return false;
		}
		this.STATE = "RUNNING";
		haxe_Log.trace(". Started OK",{ fileName : "src/Serv.hx", lineNumber : 143, className : "Serv", methodName : "start"});
		return true;
	}
};
var Std = function() { };
Std.__name__ = true;
Std.string = function(s) {
	return js_Boot.__string_rec(s,"");
};
Std.parseInt = function(x) {
	if(x != null) {
		var _g = 0;
		var _g1 = x.length;
		while(_g < _g1) {
			var i = _g++;
			var c = x.charCodeAt(i);
			if(c <= 8 || c >= 14 && c != 32 && c != 45) {
				var nc = x.charCodeAt(i + 1);
				var v = parseInt(x,nc == 120 || nc == 88 ? 16 : 10);
				if(isNaN(v)) {
					return null;
				} else {
					return v;
				}
			}
		}
	}
	return null;
};
var StringTools = function() { };
StringTools.__name__ = true;
StringTools.isSpace = function(s,pos) {
	var c = HxOverrides.cca(s,pos);
	if(!(c > 8 && c < 14)) {
		return c == 32;
	} else {
		return true;
	}
};
StringTools.ltrim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,r)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s,r,l - r);
	} else {
		return s;
	}
};
StringTools.rtrim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,l - r - 1)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s,0,l - r);
	} else {
		return s;
	}
};
StringTools.trim = function(s) {
	return StringTools.ltrim(StringTools.rtrim(s));
};
StringTools.lpad = function(s,c,l) {
	if(c.length <= 0) {
		return s;
	}
	var buf_b = "";
	l -= s.length;
	while(buf_b.length < l) buf_b += c == null ? "null" : "" + c;
	buf_b += s == null ? "null" : "" + s;
	return buf_b;
};
StringTools.rpad = function(s,c,l) {
	if(c.length <= 0) {
		return s;
	}
	var buf_b = "";
	buf_b += s == null ? "null" : "" + s;
	while(buf_b.length < l) buf_b += c == null ? "null" : "" + c;
	return buf_b;
};
var haxe_io_Output = function() { };
haxe_io_Output.__name__ = true;
var _$Sys_FileOutput = function(fd) {
	this.fd = fd;
};
_$Sys_FileOutput.__name__ = true;
_$Sys_FileOutput.__super__ = haxe_io_Output;
_$Sys_FileOutput.prototype = $extend(haxe_io_Output.prototype,{
	writeByte: function(c) {
		js_node_Fs.writeSync(this.fd,String.fromCodePoint(c));
	}
	,writeBytes: function(s,pos,len) {
		var data = s.b;
		return js_node_Fs.writeSync(this.fd,js_node_buffer_Buffer.from(data.buffer,data.byteOffset,s.length),pos,len);
	}
	,writeString: function(s,encoding) {
		js_node_Fs.writeSync(this.fd,s);
	}
	,flush: function() {
		js_node_Fs.fsyncSync(this.fd);
	}
	,close: function() {
		js_node_Fs.closeSync(this.fd);
	}
});
var haxe_io_Input = function() { };
haxe_io_Input.__name__ = true;
var _$Sys_FileInput = function(fd) {
	this.fd = fd;
};
_$Sys_FileInput.__name__ = true;
_$Sys_FileInput.__super__ = haxe_io_Input;
_$Sys_FileInput.prototype = $extend(haxe_io_Input.prototype,{
	readByte: function() {
		var buf = js_node_buffer_Buffer.alloc(1);
		try {
			js_node_Fs.readSync(this.fd,buf,0,1,null);
		} catch( _g ) {
			var e = haxe_Exception.caught(_g).unwrap();
			if(e.code == "EOF") {
				throw haxe_Exception.thrown(new haxe_io_Eof());
			} else {
				throw haxe_Exception.thrown(haxe_io_Error.Custom(e));
			}
		}
		return buf[0];
	}
	,readBytes: function(s,pos,len) {
		var data = s.b;
		var buf = js_node_buffer_Buffer.from(data.buffer,data.byteOffset,s.length);
		try {
			return js_node_Fs.readSync(this.fd,buf,pos,len,null);
		} catch( _g ) {
			var e = haxe_Exception.caught(_g).unwrap();
			if(e.code == "EOF") {
				throw haxe_Exception.thrown(new haxe_io_Eof());
			} else {
				throw haxe_Exception.thrown(haxe_io_Error.Custom(e));
			}
		}
	}
	,close: function() {
		js_node_Fs.closeSync(this.fd);
	}
});
var TaskD = function() {
};
TaskD.__name__ = true;
TaskD.prototype = {
	isDisabled: function() {
		return this.STATUS == "Disabled";
	}
};
var Type = function() { };
Type.__name__ = true;
Type.createEnum = function(e,constr,params) {
	var f = Reflect.field(e,constr);
	if(f == null) {
		throw haxe_Exception.thrown("No such constructor " + constr);
	}
	if(Reflect.isFunction(f)) {
		if(params == null) {
			throw haxe_Exception.thrown("Constructor " + constr + " need parameters");
		}
		return f.apply(e,params);
	}
	if(params != null && params.length != 0) {
		throw haxe_Exception.thrown("Constructor " + constr + " does not need parameters");
	}
	return f;
};
Type.enumParameters = function(e) {
	var enm = $hxEnums[e.__enum__];
	var params = enm.__constructs__[e._hx_index].__params__;
	if(params != null) {
		var _g = [];
		var _g1 = 0;
		while(_g1 < params.length) {
			var p = params[_g1];
			++_g1;
			_g.push(e[p]);
		}
		return _g;
	} else {
		return [];
	}
};
var djA_ConfigFileB = function(cont) {
	this.data = new haxe_ds_StringMap();
	if(cont != null) {
		this.parse(cont);
	}
};
djA_ConfigFileB.__name__ = true;
djA_ConfigFileB.prototype = {
	parse: function(contents) {
		var _gthis = this;
		var cSect = null;
		var v1 = null;
		var v2 = null;
		var isMultiLine = false;
		var _saveKeyVal = function() {
			var b;
			if(!Object.prototype.hasOwnProperty.call(_gthis.data.h,cSect)) {
				b = new haxe_ds_StringMap();
				_gthis.data.h[cSect] = b;
			} else {
				b = _gthis.data.h[cSect];
			}
			b.h[v1] = v2;
		};
		var _g = 0;
		var _g1 = contents.split("\n");
		while(_g < _g1.length) {
			var line = _g1[_g];
			++_g;
			var lineT = StringTools.trim(line);
			if(lineT.length == 0) {
				if(isMultiLine) {
					v2 += "\n";
				}
				continue;
			}
			if(djA_ConfigFileB.COMMENTS.indexOf(lineT.charAt(0)) >= 0) {
				continue;
			}
			if(djA_ConfigFileB.reg_section.match(lineT)) {
				if(cSect != null) {
					if(v1 != null) {
						if(v2 == null) {
							throw haxe_Exception.thrown("Key \"" + v1 + "\" does not have a value defined");
						}
						_saveKeyVal();
					}
				}
				cSect = djA_ConfigFileB.reg_section.matched(1);
				v2 = null;
				v1 = v2;
				isMultiLine = false;
				continue;
			}
			if(djA_ConfigFileB.reg_def.match(lineT)) {
				if(cSect == null) {
					throw haxe_Exception.thrown("Parse Error, Variable needs to be in a [section]");
				}
				if(v1 != null) {
					if(v2 == null) {
						throw haxe_Exception.thrown("Parse Error: Key \"" + v1 + "\" does not have a value defined");
					}
					_saveKeyVal();
				}
				v1 = djA_ConfigFileB.reg_def.matched(1);
				v2 = djA_ConfigFileB.reg_def.matched(2);
				v1 = StringTools.rtrim(v1);
				v2 = StringTools.ltrim(v2);
				isMultiLine = false;
				if(v2 == "\\l") {
					isMultiLine = true;
					v2 = "";
				}
				continue;
			}
			if(v1 == null) {
				throw haxe_Exception.thrown("Parse Error: Value defined outside of a key (" + line + ")");
			}
			isMultiLine = true;
			if(v2 == null || v2.length == 0) {
				v2 = StringTools.rtrim(line);
				continue;
			}
			if(lineT == "\\e") {
				isMultiLine = false;
				continue;
			}
			if(v2.charAt(v2.length - 1) == djA_ConfigFileB.NO_NEW_LINE) {
				v2 = HxOverrides.substr(v2,0,-1);
				v2 += lineT;
			} else {
				v2 = v2 + "\n" + StringTools.rtrim(line);
			}
		}
		if(v1 != null) {
			if(v2 == null) {
				throw haxe_Exception.thrown("Parse Error: Key \"" + v1 + "\" does not have a value defined");
			}
			_saveKeyVal();
		}
	}
	,exists: function(section,key) {
		if(Object.prototype.hasOwnProperty.call(this.data.h,section)) {
			return Object.prototype.hasOwnProperty.call(this.data.h[section].h,key);
		} else {
			return false;
		}
	}
	,get: function(section,key) {
		var s = this.data.h[section];
		if(s != null) {
			return s.h[key];
		}
		return null;
	}
	,getTextArray: function(section,key) {
		if(!this.exists(section,key)) {
			return null;
		}
		var raw = this.get(section,key).split("\n");
		var res = [];
		var _g = 0;
		while(_g < raw.length) {
			var l = raw[_g];
			++_g;
			var line = StringTools.trim(l);
			if(line.length == 0) {
				continue;
			}
			res.push(line);
		}
		return res;
	}
	,getObj: function(section,obj) {
		if(obj == null) {
			obj = { };
		}
		var sect = this.data.h[section];
		var h = sect.h;
		var _g_h = h;
		var _g_keys = Object.keys(h);
		var _g_length = _g_keys.length;
		var _g_current = 0;
		while(_g_current < _g_length) {
			var key = _g_keys[_g_current++];
			var _g1_key = key;
			var _g1_value = _g_h[key];
			var k = _g1_key;
			var v = _g1_value;
			obj[k] = v;
		}
		return obj;
	}
	,getObjEx: function(section,obj) {
		if(obj == null) {
			obj = { };
		}
		var TF_0 = "true";
		var TF_1 = "false";
		var sect = this.data.h[section];
		var h = sect.h;
		var _g_h = h;
		var _g_keys = Object.keys(h);
		var _g_length = _g_keys.length;
		var _g_current = 0;
		while(_g_current < _g_length) {
			var key = _g_keys[_g_current++];
			var _g1_key = key;
			var _g1_value = _g_h[key];
			var k = _g1_key;
			var v = _g1_value;
			if(v.charAt(0) == "#") {
				var str = HxOverrides.substr(v,1,null);
				var num = parseFloat(str);
				if(num % 1 != 0) {
					obj[k] = num;
				} else {
					obj[k] = num | 0;
				}
			} else if(v == "true") {
				obj[k] = true;
			} else if(v == "false") {
				obj[k] = false;
			} else {
				obj[k] = v;
			}
		}
		return obj;
	}
};
var djA_StrT = function() { };
djA_StrT.__name__ = true;
djA_StrT.isEmpty = function(str) {
	if(str != null) {
		return str.length == 0;
	} else {
		return true;
	}
};
djA_StrT.rep = function(len,symbol) {
	return StringTools.lpad("",symbol,len);
};
djA_StrT.padString = function(str,length,align,char) {
	if(char == null) {
		char = " ";
	}
	if(align == null) {
		align = "l";
	}
	var b = length - str.length;
	if(b == 0) {
		return str;
	}
	if(b < 0) {
		return str.substring(0,length - 1) + djA_StrT.OVERFLOW_SMBL;
	}
	switch(align) {
	case "c":
		var _l = Math.ceil(b / 2);
		var _r = Math.floor(b / 2);
		str = StringTools.rpad("",char,_l) + str + StringTools.rpad("",char,_r);
		break;
	case "r":
		str = StringTools.lpad(str,char,length);
		break;
	default:
		str = StringTools.rpad(str,char,length);
	}
	return str;
};
var djNode_KeycodeID = $hxEnums["djNode.KeycodeID"] = { __ename__:true,__constructs__:null
	,up: {_hx_name:"up",_hx_index:0,__enum__:"djNode.KeycodeID",toString:$estr}
	,down: {_hx_name:"down",_hx_index:1,__enum__:"djNode.KeycodeID",toString:$estr}
	,left: {_hx_name:"left",_hx_index:2,__enum__:"djNode.KeycodeID",toString:$estr}
	,right: {_hx_name:"right",_hx_index:3,__enum__:"djNode.KeycodeID",toString:$estr}
	,home: {_hx_name:"home",_hx_index:4,__enum__:"djNode.KeycodeID",toString:$estr}
	,insert: {_hx_name:"insert",_hx_index:5,__enum__:"djNode.KeycodeID",toString:$estr}
	,'delete': {_hx_name:"delete",_hx_index:6,__enum__:"djNode.KeycodeID",toString:$estr}
	,end: {_hx_name:"end",_hx_index:7,__enum__:"djNode.KeycodeID",toString:$estr}
	,pageup: {_hx_name:"pageup",_hx_index:8,__enum__:"djNode.KeycodeID",toString:$estr}
	,pagedown: {_hx_name:"pagedown",_hx_index:9,__enum__:"djNode.KeycodeID",toString:$estr}
	,backsp: {_hx_name:"backsp",_hx_index:10,__enum__:"djNode.KeycodeID",toString:$estr}
	,tab: {_hx_name:"tab",_hx_index:11,__enum__:"djNode.KeycodeID",toString:$estr}
	,enter: {_hx_name:"enter",_hx_index:12,__enum__:"djNode.KeycodeID",toString:$estr}
	,space: {_hx_name:"space",_hx_index:13,__enum__:"djNode.KeycodeID",toString:$estr}
	,esc: {_hx_name:"esc",_hx_index:14,__enum__:"djNode.KeycodeID",toString:$estr}
	,ctrlC: {_hx_name:"ctrlC",_hx_index:15,__enum__:"djNode.KeycodeID",toString:$estr}
	,acute: {_hx_name:"acute",_hx_index:16,__enum__:"djNode.KeycodeID",toString:$estr}
	,F1: {_hx_name:"F1",_hx_index:17,__enum__:"djNode.KeycodeID",toString:$estr}
	,F2: {_hx_name:"F2",_hx_index:18,__enum__:"djNode.KeycodeID",toString:$estr}
	,F3: {_hx_name:"F3",_hx_index:19,__enum__:"djNode.KeycodeID",toString:$estr}
	,F4: {_hx_name:"F4",_hx_index:20,__enum__:"djNode.KeycodeID",toString:$estr}
	,F5: {_hx_name:"F5",_hx_index:21,__enum__:"djNode.KeycodeID",toString:$estr}
	,F6: {_hx_name:"F6",_hx_index:22,__enum__:"djNode.KeycodeID",toString:$estr}
	,F7: {_hx_name:"F7",_hx_index:23,__enum__:"djNode.KeycodeID",toString:$estr}
	,F8: {_hx_name:"F8",_hx_index:24,__enum__:"djNode.KeycodeID",toString:$estr}
	,F9: {_hx_name:"F9",_hx_index:25,__enum__:"djNode.KeycodeID",toString:$estr}
	,F10: {_hx_name:"F10",_hx_index:26,__enum__:"djNode.KeycodeID",toString:$estr}
	,F11: {_hx_name:"F11",_hx_index:27,__enum__:"djNode.KeycodeID",toString:$estr}
	,F12: {_hx_name:"F12",_hx_index:28,__enum__:"djNode.KeycodeID",toString:$estr}
	,other: {_hx_name:"other",_hx_index:29,__enum__:"djNode.KeycodeID",toString:$estr}
};
djNode_KeycodeID.__constructs__ = [djNode_KeycodeID.up,djNode_KeycodeID.down,djNode_KeycodeID.left,djNode_KeycodeID.right,djNode_KeycodeID.home,djNode_KeycodeID.insert,djNode_KeycodeID.delete,djNode_KeycodeID.end,djNode_KeycodeID.pageup,djNode_KeycodeID.pagedown,djNode_KeycodeID.backsp,djNode_KeycodeID.tab,djNode_KeycodeID.enter,djNode_KeycodeID.space,djNode_KeycodeID.esc,djNode_KeycodeID.ctrlC,djNode_KeycodeID.acute,djNode_KeycodeID.F1,djNode_KeycodeID.F2,djNode_KeycodeID.F3,djNode_KeycodeID.F4,djNode_KeycodeID.F5,djNode_KeycodeID.F6,djNode_KeycodeID.F7,djNode_KeycodeID.F8,djNode_KeycodeID.F9,djNode_KeycodeID.F10,djNode_KeycodeID.F11,djNode_KeycodeID.F12,djNode_KeycodeID.other];
var djNode_Keycode = function() { };
djNode_Keycode.__name__ = true;
djNode_Keycode.toKeyCodeID = function(key) {
	if(HxOverrides.cca(key,1) == null) {
		switch(HxOverrides.cca(key,0)) {
		case 3:
			return djNode_KeycodeID.ctrlC;
		case 8:
			return djNode_KeycodeID.backsp;
		case 9:
			return djNode_KeycodeID.tab;
		case 13:
			return djNode_KeycodeID.enter;
		case 27:
			return djNode_KeycodeID.esc;
		case 32:
			return djNode_KeycodeID.space;
		case 96:
			return djNode_KeycodeID.acute;
		case 127:
			return djNode_KeycodeID.backsp;
		}
	} else if(HxOverrides.cca(key,0) == 27 && HxOverrides.cca(key,1) == 91) {
		switch(HxOverrides.cca(key,2)) {
		case 49:
			switch(HxOverrides.cca(key,3)) {
			case 55:
				return djNode_KeycodeID.F6;
			case 56:
				return djNode_KeycodeID.F7;
			case 57:
				return djNode_KeycodeID.F8;
			case 126:
				return djNode_KeycodeID.home;
			}
			break;
		case 50:
			switch(HxOverrides.cca(key,3)) {
			case 48:
				return djNode_KeycodeID.F9;
			case 49:
				return djNode_KeycodeID.F10;
			case 51:
				return djNode_KeycodeID.F11;
			case 52:
				return djNode_KeycodeID.F12;
			case 126:
				return djNode_KeycodeID.insert;
			}
			break;
		case 51:
			return djNode_KeycodeID.delete;
		case 52:
			return djNode_KeycodeID.end;
		case 53:
			return djNode_KeycodeID.pageup;
		case 54:
			return djNode_KeycodeID.pagedown;
		case 65:
			return djNode_KeycodeID.up;
		case 66:
			return djNode_KeycodeID.down;
		case 67:
			return djNode_KeycodeID.right;
		case 68:
			return djNode_KeycodeID.left;
		case 91:
			switch(HxOverrides.cca(key,3)) {
			case 65:
				return djNode_KeycodeID.F1;
			case 66:
				return djNode_KeycodeID.F2;
			case 67:
				return djNode_KeycodeID.F3;
			case 68:
				return djNode_KeycodeID.F4;
			case 69:
				return djNode_KeycodeID.F5;
			}
			break;
		}
	}
	return null;
};
var djNode_Keyboard = function() { };
djNode_Keyboard.__name__ = true;
djNode_Keyboard.startCapture = function(realtime,callback) {
	if(realtime == null) {
		realtime = true;
	}
	djNode_Keyboard.stop();
	if(callback != null) {
		djNode_Keyboard.onData = callback;
	}
	djNode_Keyboard.stdin = process.stdin;
	djNode_Keyboard.stdin.setRawMode(realtime);
	djNode_Keyboard.stdin.setEncoding("utf8");
	djNode_Keyboard.stdin.on("data",djNode_Keyboard.onKeyData);
	djNode_Keyboard.stdin.resume();
};
djNode_Keyboard.onKeyData = function(data) {
	if(djNode_Keyboard.FLAG_CAN_BREAK && data == djNode_Keycode.CTRLC) {
		djNode_Keyboard.stop();
		if(djNode_Keyboard.onBreak != null) {
			djNode_Keyboard.onBreak();
		}
		djNode_Keyboard.onBreak = null;
		return;
	}
	if(djNode_Keyboard.onData != null) {
		djNode_Keyboard.onData(data);
	}
};
djNode_Keyboard.stop = function() {
	if(djNode_Keyboard.stdin == null) {
		return;
	}
	djNode_Keyboard.stdin.pause();
	djNode_Keyboard.stdin.setRawMode(false);
	djNode_Keyboard.stdin.removeAllListeners("data");
};
djNode_Keyboard.flush = function() {
	if(djNode_Keyboard.stdin == null) {
		return;
	}
	djNode_Keyboard.stdin.pause();
	djNode_Keyboard.stdin.resume();
};
djNode_Keyboard.readOnceSync = function() {
	var SIZE = 512;
	var b = js_node_buffer_Buffer.alloc(SIZE);
	var bytesin = 0;
	bytesin = 0;
	try {
		bytesin = js_node_Fs.readSync(process.stdin.fd,b,0,SIZE,null);
	} catch( _g ) {
		var e = haxe_Exception.caught(_g).unwrap();
		haxe_Log.trace(e,{ fileName : "djNode/Keyboard.hx", lineNumber : 231, className : "djNode.Keyboard", methodName : "readOnceSync"});
		throw haxe_Exception.thrown(e);
	}
	return b.toString("utf8",0,bytesin - 2);
};
var djNode_TColor = $hxEnums["djNode.TColor"] = { __ename__:true,__constructs__:null
	,black: {_hx_name:"black",_hx_index:0,__enum__:"djNode.TColor",toString:$estr}
	,white: {_hx_name:"white",_hx_index:1,__enum__:"djNode.TColor",toString:$estr}
	,gray: {_hx_name:"gray",_hx_index:2,__enum__:"djNode.TColor",toString:$estr}
	,red: {_hx_name:"red",_hx_index:3,__enum__:"djNode.TColor",toString:$estr}
	,green: {_hx_name:"green",_hx_index:4,__enum__:"djNode.TColor",toString:$estr}
	,blue: {_hx_name:"blue",_hx_index:5,__enum__:"djNode.TColor",toString:$estr}
	,yellow: {_hx_name:"yellow",_hx_index:6,__enum__:"djNode.TColor",toString:$estr}
	,cyan: {_hx_name:"cyan",_hx_index:7,__enum__:"djNode.TColor",toString:$estr}
	,magenta: {_hx_name:"magenta",_hx_index:8,__enum__:"djNode.TColor",toString:$estr}
	,darkgray: {_hx_name:"darkgray",_hx_index:9,__enum__:"djNode.TColor",toString:$estr}
	,darkred: {_hx_name:"darkred",_hx_index:10,__enum__:"djNode.TColor",toString:$estr}
	,darkgreen: {_hx_name:"darkgreen",_hx_index:11,__enum__:"djNode.TColor",toString:$estr}
	,darkblue: {_hx_name:"darkblue",_hx_index:12,__enum__:"djNode.TColor",toString:$estr}
	,darkyellow: {_hx_name:"darkyellow",_hx_index:13,__enum__:"djNode.TColor",toString:$estr}
	,darkcyan: {_hx_name:"darkcyan",_hx_index:14,__enum__:"djNode.TColor",toString:$estr}
	,darkmagenta: {_hx_name:"darkmagenta",_hx_index:15,__enum__:"djNode.TColor",toString:$estr}
};
djNode_TColor.__constructs__ = [djNode_TColor.black,djNode_TColor.white,djNode_TColor.gray,djNode_TColor.red,djNode_TColor.green,djNode_TColor.blue,djNode_TColor.yellow,djNode_TColor.cyan,djNode_TColor.magenta,djNode_TColor.darkgray,djNode_TColor.darkred,djNode_TColor.darkgreen,djNode_TColor.darkblue,djNode_TColor.darkyellow,djNode_TColor.darkcyan,djNode_TColor.darkmagenta];
var djNode_Terminal = function() {
	this.PARSED_NOTAG = "";
	this.ENABLE_NOTAG = false;
	var _g = new haxe_ds_EnumValueMap();
	_g.set(djNode_TColor.darkgray,"\x1B[90m");
	_g.set(djNode_TColor.red,"\x1B[91m");
	_g.set(djNode_TColor.green,"\x1B[92m");
	_g.set(djNode_TColor.yellow,"\x1B[93m");
	_g.set(djNode_TColor.blue,"\x1B[94m");
	_g.set(djNode_TColor.magenta,"\x1B[95m");
	_g.set(djNode_TColor.cyan,"\x1B[96m");
	_g.set(djNode_TColor.white,"\x1B[97m");
	_g.set(djNode_TColor.black,"\x1B[30m");
	_g.set(djNode_TColor.darkred,"\x1B[31m");
	_g.set(djNode_TColor.darkgreen,"\x1B[32m");
	_g.set(djNode_TColor.darkyellow,"\x1B[33m");
	_g.set(djNode_TColor.darkblue,"\x1B[34m");
	_g.set(djNode_TColor.darkmagenta,"\x1B[35m");
	_g.set(djNode_TColor.darkcyan,"\x1B[36m");
	_g.set(djNode_TColor.gray,"\x1B[37m");
	this.COLORS_FG = _g;
	var _g = new haxe_ds_EnumValueMap();
	_g.set(djNode_TColor.darkgray,"\x1B[100m");
	_g.set(djNode_TColor.red,"\x1B[101m");
	_g.set(djNode_TColor.green,"\x1B[102m");
	_g.set(djNode_TColor.yellow,"\x1B[103m");
	_g.set(djNode_TColor.blue,"\x1B[104m");
	_g.set(djNode_TColor.magenta,"\x1B[105m");
	_g.set(djNode_TColor.cyan,"\x1B[106m");
	_g.set(djNode_TColor.white,"\x1B[107m");
	_g.set(djNode_TColor.black,"\x1B[40m");
	_g.set(djNode_TColor.darkred,"\x1B[41m");
	_g.set(djNode_TColor.darkgreen,"\x1B[42m");
	_g.set(djNode_TColor.darkyellow,"\x1B[43m");
	_g.set(djNode_TColor.darkblue,"\x1B[44m");
	_g.set(djNode_TColor.darkmagenta,"\x1B[45m");
	_g.set(djNode_TColor.darkcyan,"\x1B[46m");
	_g.set(djNode_TColor.gray,"\x1B[47m");
	this.COLORS_BG = _g;
};
djNode_Terminal.__name__ = true;
djNode_Terminal.prototype = {
	fg: function(col) {
		if(col == null) {
			process.stdout.write("\x1B[39m");
			return this;
		}
		var str = this.COLORS_FG.get(col);
		process.stdout.write(str);
		return this;
	}
	,bold: function() {
		process.stdout.write("\x1B[1m");
		return this;
	}
	,cursorShow: function() {
		process.stdout.write("\x1B[?25h");
		return this;
	}
	,ptag: function(s) {
		var str = this.parseTags(s);
		process.stdout.write(str);
		return this;
	}
	,parseTags: function(str) {
		var _gthis = this;
		var res = new EReg("<(\\S+?)>","g").map(str,function(reg) {
			var src = reg.matched(1);
			var prop = src.split(",");
			var ret = "";
			var _g = 0;
			while(_g < prop.length) {
				var p = prop[_g];
				++_g;
				var ret1;
				switch(p) {
				case "!":
					ret1 = "\x1B[0m";
					break;
				case "!bg":
					ret1 = "\x1B[49m";
					break;
				case "!blink":
					ret1 = "\x1B[25m";
					break;
				case "!bold":
					ret1 = "\x1B[21m";
					break;
				case "!dim":
					ret1 = "\x1B[22m";
					break;
				case "!fg":
					ret1 = "\x1B[39m";
					break;
				case "!underl":
					ret1 = "\x1B[24m";
					break;
				case "blink":
					ret1 = "\x1B[5m";
					break;
				case "bold":
					ret1 = "\x1B[1m";
					break;
				case "cr":
					ret1 = "\x1B[u";
					break;
				case "cs":
					ret1 = "\x1B[s";
					break;
				case "dim":
					ret1 = "\x1B[2m";
					break;
				case "underl":
					ret1 = "\x1B[4m";
					break;
				default:
					if(p.indexOf(":") == 0) {
						try {
							ret1 = _gthis.COLORS_BG.get(Type.createEnum(djNode_TColor,p.split(":")[1],null));
						} catch( _g1 ) {
							throw haxe_Exception.thrown("Tag Error: Color does not exist in `" + src + "`");
						}
					} else {
						try {
							ret1 = _gthis.COLORS_FG.get(Type.createEnum(djNode_TColor,p,null));
						} catch( _g2 ) {
							ret1 = reg.matched(0);
						}
					}
				}
				ret += ret1;
			}
			return ret;
		});
		if(this.ENABLE_NOTAG) {
			this.PARSED_NOTAG = new EReg("<(\\S+?)>","g").map(str,function(reg) {
				return "";
			});
		}
		return res;
	}
};
var djNode_tools_FileTool = function() { };
djNode_tools_FileTool.__name__ = true;
djNode_tools_FileTool.getFileListFromWildcard = function(path) {
	var fileList = [];
	var basePath = js_node_Path.dirname(path);
	var extToGet = djNode_tools_FileTool.getFileExt(path);
	var baseToGet;
	var exp = new EReg("(\\S*)\\.","");
	if(exp.match(js_node_Path.basename(path))) {
		baseToGet = exp.matched(1);
		if(baseToGet.length > 1 && baseToGet.indexOf("*") > 0) {
			throw haxe_Exception.thrown("Advanced search is currently unsupported, use basic [*.*] or [*.ext]");
		}
	} else {
		baseToGet = "*";
	}
	var allfiles = js_node_Fs.readdirSync(js_node_Path.normalize(basePath));
	var stats;
	var _g = 0;
	while(_g < allfiles.length) {
		var i = allfiles[_g];
		++_g;
		try {
			stats = js_node_Fs.statSync(js_node_Path.join(basePath,i));
		} catch( _g1 ) {
			continue;
		}
		if(stats.isFile()) {
			if(baseToGet != "*") {
				if(exp.match(i)) {
					if(baseToGet != exp.matched(1)) {
						continue;
					}
				} else {
					continue;
				}
			}
			if(extToGet == ".*") {
				fileList.push(js_node_Path.join(basePath,i));
				continue;
			}
			if(extToGet == js_node_Path.extname(i).toLowerCase()) {
				fileList.push(js_node_Path.join(basePath,i));
				continue;
			}
		}
	}
	return fileList;
};
djNode_tools_FileTool.getFileExt = function(file) {
	return js_node_Path.extname(file).toLowerCase();
};
var djNode_tools_LOG = function() { };
djNode_tools_LOG.__name__ = true;
djNode_tools_LOG.init = function() {
	if(djNode_tools_LOG._isInited) {
		return;
	}
	djNode_tools_LOG._isInited = true;
	djNode_tools_LOG.messages = [];
};
djNode_tools_LOG.end = function() {
	if(djNode_tools_LOG.flag_socket_log) {
		djNode_tools_LOG.io.close();
	}
};
djNode_tools_LOG.pipeTrace = function(produceStdout) {
	if(produceStdout == null) {
		produceStdout = false;
	}
	djNode_tools_LOG.FLAG_STDOUT = produceStdout;
	haxe_Log.trace = function(msg,pos) {
		djNode_tools_LOG.log(msg,1,pos);
		if(pos != null && pos.customParams != null) {
			var _g = 0;
			var _g1 = pos.customParams;
			while(_g < _g1.length) {
				var v = _g1[_g];
				++_g;
				djNode_tools_LOG.log(v,1,pos);
			}
		}
	};
};
djNode_tools_LOG.log = function(obj,level,pos) {
	if(level == null) {
		level = 1;
	}
	if(level < djNode_tools_LOG.logLevel) {
		return;
	}
	var logmsg = { pos : pos, log : Std.string(obj), level : level};
	if(djNode_tools_LOG.BUFFER_SIZE > 0 && djNode_tools_LOG.messages.length >= djNode_tools_LOG.BUFFER_SIZE) {
		djNode_tools_LOG.messages.shift();
	}
	djNode_tools_LOG.messages.push(logmsg);
	if(djNode_tools_LOG.flag_socket_log) {
		djNode_tools_LOG.io.sockets.emit("logText",{ data : logmsg.log, pos : logmsg.pos, level : logmsg.level});
	}
	if(djNode_tools_LOG.logFile != null) {
		djNode_tools_LOG.push_File(logmsg);
	}
	if(djNode_tools_LOG.onLog != null) {
		djNode_tools_LOG.onLog(logmsg);
	}
	if(djNode_tools_LOG.FLAG_STDOUT) {
		var _this = djNode_BaseApp.TERMINAL;
		var str = logmsg.log;
		process.stdout.write(str + "\n");
	}
};
djNode_tools_LOG.push_File = function(log) {
	var m = "";
	if(djNode_tools_LOG.FLAG_SHOW_MESSAGE_TYPE) {
		m += djNode_tools_LOG.messageTypes[log.level] + " ";
	}
	if(djNode_tools_LOG.FLAG_SHOW_POS) {
		m += "(" + log.pos.fileName.split("/").pop() + ":" + log.pos.lineNumber + ") ";
	}
	m += log.log + "\n";
	try {
		js_node_Fs.appendFileSync(djNode_tools_LOG.logFile,m,"utf8");
	} catch( _g ) {
		if(((haxe_Exception.caught(_g).unwrap()) instanceof Error)) {
			djNode_BaseApp.TERMINAL.ptag("<red> - NO SPACE LEFT FOR THE LOG FILE - <!>\n");
			process.exit(1);
		} else {
			throw _g;
		}
	}
};
djNode_tools_LOG.setLogFile = function(filename) {
	djNode_tools_LOG.logFile = filename;
	var header = " - LOG -\n" + " -------\n" + " - " + djNode_tools_LOG.logFile + "\n" + " - Created: " + HxOverrides.dateStr(new Date()) + "\n" + " - App: " + js_node_Path.basename(process.argv[1]) + "\n" + " ---------------------------------------------------\n\n";
	try {
		js_node_Fs.writeFileSync(djNode_tools_LOG.logFile,header,{ encoding : "utf8"});
	} catch( _g ) {
		if(((haxe_Exception.caught(_g).unwrap()) instanceof Error)) {
			throw haxe_Exception.thrown("Cannot Create Log File \"" + djNode_tools_LOG.logFile + "\"");
		} else {
			throw _g;
		}
	}
	var _g = 0;
	var _g1 = djNode_tools_LOG.messages;
	while(_g < _g1.length) {
		var i = _g1[_g];
		++_g;
		djNode_tools_LOG.push_File(i);
	}
};
var djNode_utils_CLIApp = function() { };
djNode_utils_CLIApp.__name__ = true;
djNode_utils_CLIApp.quickExecS = function(path,cwd) {
	try {
		if(!djNode_utils_CLIApp.FLAG_LOG_QUIET) {
			djNode_tools_LOG.log("ExecSync : " + path + " | cwd : " + (cwd == null ? process.cwd() : cwd),null,{ fileName : "djNode/utils/CLIApp.hx", lineNumber : 212, className : "djNode.utils.CLIApp", methodName : "quickExecS"});
		}
		return js_node_ChildProcess.execSync(path,{ cwd : cwd, stdio : ["ignore","pipe","ignore"]});
	} catch( _g ) {
		return null;
	}
};
var djNode_utils_Print2 = function(printMode) {
	if(printMode == null) {
		printMode = 0;
	}
	this._table = null;
	this.pmode = 0;
	this.lpad = 0;
	this.T = djNode_BaseApp.TERMINAL;
	if(printMode > 0) {
		this.buffer = [];
		this.T.ENABLE_NOTAG = true;
	}
	this.pmode = printMode;
};
djNode_utils_Print2.__name__ = true;
djNode_utils_Print2.prototype = {
	_prtl: function(s) {
		if(this.pmode < 2) {
			var _this = this.T;
			process.stdout.write(s + "\n");
		}
		if(this.pmode > 0) {
			this.buffer.push(s);
		}
	}
	,H: function(text,size) {
		if(size == null) {
			size = 0;
		}
		var s = djNode_utils_Print2.H_STYLES[size];
		this.lpad = s.pad0;
		this.ptem(s.templ,text);
		if(s.line != null) {
			var r = s.line.split(":");
			var l = Std.parseInt(r[0]);
			if(l == 1) {
				l = this.T.PARSED_NOTAG.length;
			}
			if(l > 0) {
				this.T.fg(Type.createEnum(djNode_TColor,r[1],null));
				this.line(l);
				var _this = this.T;
				process.stdout.write("\x1B[39m");
			}
		}
		this.lpad = s.pad1;
		return this;
	}
	,p: function(text) {
		if(this.lpad > 0) {
			text = djA_StrT.rep(this.lpad," ") + text;
		}
		var t2 = this.T.parseTags(text);
		if(this.pmode < 2) {
			var _this = this.T;
			process.stdout.write(t2 + "\n");
		}
		if(this.pmode > 0) {
			this.buffer.push(this.T.PARSED_NOTAG);
		}
		return this;
	}
	,line: function(len) {
		if(len == null) {
			len = 40;
		}
		this._prtl(djA_StrT.rep(this.lpad," ") + djA_StrT.rep(len,"─"));
		return this;
	}
	,ptem: function(tem,t1,t2,t3) {
		return this.p(this.parseTempl(tem,t1,t2,t3));
	}
	,parseTempl: function(tem,t1,t2,t3) {
		var r = new EReg("\\{(\\d+):?(\\d+)?\\}","g");
		return r.map(tem,function(r1) {
			var m = r.matched(1);
			var part;
			var _g = Std.parseInt(m);
			if(_g == null) {
				throw haxe_Exception.thrown("Templates support up to three(3) capture groups");
			} else {
				switch(_g) {
				case 1:
					part = t1;
					break;
				case 2:
					part = t2;
					break;
				case 3:
					part = t3;
					break;
				default:
					throw haxe_Exception.thrown("Templates support up to three(3) capture groups");
				}
			}
			if(r1.matched(2) != null) {
				part = djA_StrT.padString(part,Std.parseInt(r1.matched(2)));
			}
			return part;
		});
	}
	,table: function(DATA) {
		this._table = [];
		this._tActiveCell = 0;
		var xpos = 0;
		var _g = 0;
		var _g1 = DATA.split("|");
		while(_g < _g1.length) {
			var c = _g1[_g];
			++_g;
			var D = c.split(",");
			if(D.length == 2) {
				D.push("0");
			}
			var w = Std.parseInt(D[1]);
			var pad = Std.parseInt(D[2]);
			var al;
			switch(D[0]) {
			case "C":
				al = "c";
				break;
			case "R":
				al = "r";
				break;
			default:
				al = "l";
			}
			this._table.push({ align : al, width : w, pad : pad, xpos : pad + xpos});
			xpos += w + pad;
		}
		this._table_width = xpos;
	}
	,tr: function(cells) {
		if(this._table == null) {
			throw haxe_Exception.thrown("Table not defined");
		}
		this._tActiveCell = 0;
		if(cells == null) {
			var _this = this.T;
			process.stdout.write("\n");
			return;
		}
		var str = djA_StrT.rep(this.lpad," ");
		var _g = 0;
		var _g1 = cells.length;
		while(_g < _g1) {
			var i = _g++;
			str += djA_StrT.rep(this._table[i].pad," ");
			str += djA_StrT.padString(cells[i],this._table[i].width,this._table[i].align);
		}
		this._prtl(str);
	}
	,tc: function(text,cell,charpad) {
		if(charpad == null) {
			charpad = " ";
		}
		if(cell == null) {
			cell = 0;
		}
		if(this.pmode > 0) {
			haxe_Log.trace("ERROR : tc() does not support printing to buffer, use tr()",{ fileName : "djNode/utils/Print2.hx", lineNumber : 353, className : "djNode.utils.Print2", methodName : "tc"});
		}
		if(this._table == null) {
			throw haxe_Exception.thrown("Table not defined");
		}
		if(cell == 0) {
			cell = this._tActiveCell;
		} else {
			--cell;
		}
		if(cell >= this._table.length) {
			haxe_Log.trace("ERROR : Table Cell (" + this._tActiveCell + ") Overflow, for text (" + text + ")",{ fileName : "djNode/utils/Print2.hx", lineNumber : 359, className : "djNode.utils.Print2", methodName : "tc"});
			return this;
		}
		var d = this._table[cell];
		var _this = this.T;
		var x = this._table_width + this.lpad + 1;
		if(x == null) {
			x = 1;
		}
		process.stdout.write("\x1B[" + x + "D");
		if(this.lpad > 0) {
			var _this = this.T;
			var x = this.lpad;
			if(x == null) {
				x = 1;
			}
			process.stdout.write("\x1B[" + x + "C");
		}
		if(d.xpos > 0) {
			var _this = this.T;
			var x = d.xpos;
			if(x == null) {
				x = 1;
			}
			process.stdout.write("\x1B[" + x + "C");
		}
		var _this = this.T;
		var str = djA_StrT.padString(text,d.width,d.align,charpad);
		process.stdout.write(str);
		this._tActiveCell++;
		return this;
	}
	,tline: function() {
		if(this._table == null) {
			throw haxe_Exception.thrown("Table not defined");
		}
		this.line(this._table_width);
		this._tActiveCell = 0;
	}
};
var djNode_utils_Registry = function() { };
djNode_utils_Registry.__name__ = true;
djNode_utils_Registry.getValue = function(Key,Value) {
	var res = djNode_utils_CLIApp.quickExecS("reg.exe QUERY " + Key + " /v " + Value);
	if(res == null) {
		return null;
	}
	res = res.toString();
	var a = res.split("\n")[2];
	var r = new EReg(".+\\s+REG_\\w+\\s+(.+)","i");
	if(r.match(a)) {
		return r.matched(1);
	}
	return null;
};
djNode_utils_Registry.setValueDWord = function(Key,Value,Data) {
	var res = djNode_utils_CLIApp.quickExecS("reg.exe ADD " + Key + " /v " + Value + " /t REG_DWORD /d " + Data + " /f");
	return res != null;
};
djNode_utils_Registry.deleteKey = function(Key) {
	var res = djNode_utils_CLIApp.quickExecS("reg.exe DELETE " + Key + " /f");
	return res != null;
};
var haxe_Exception = function(message,previous,native) {
	Error.call(this,message);
	this.message = message;
	this.__previousException = previous;
	this.__nativeException = native != null ? native : this;
};
haxe_Exception.__name__ = true;
haxe_Exception.caught = function(value) {
	if(((value) instanceof haxe_Exception)) {
		return value;
	} else if(((value) instanceof Error)) {
		return new haxe_Exception(value.message,null,value);
	} else {
		return new haxe_ValueException(value,null,value);
	}
};
haxe_Exception.thrown = function(value) {
	if(((value) instanceof haxe_Exception)) {
		return value.get_native();
	} else if(((value) instanceof Error)) {
		return value;
	} else {
		var e = new haxe_ValueException(value);
		return e;
	}
};
haxe_Exception.__super__ = Error;
haxe_Exception.prototype = $extend(Error.prototype,{
	unwrap: function() {
		return this.__nativeException;
	}
	,get_native: function() {
		return this.__nativeException;
	}
	,__properties__: {get_native:"get_native"}
});
var haxe_Log = function() { };
haxe_Log.__name__ = true;
haxe_Log.formatOutput = function(v,infos) {
	var str = Std.string(v);
	if(infos == null) {
		return str;
	}
	var pstr = infos.fileName + ":" + infos.lineNumber;
	if(infos.customParams != null) {
		var _g = 0;
		var _g1 = infos.customParams;
		while(_g < _g1.length) {
			var v = _g1[_g];
			++_g;
			str += ", " + Std.string(v);
		}
	}
	return pstr + ": " + str;
};
haxe_Log.trace = function(v,infos) {
	var str = haxe_Log.formatOutput(v,infos);
	if(typeof(console) != "undefined" && console.log != null) {
		console.log(str);
	}
};
var haxe_ValueException = function(value,previous,native) {
	haxe_Exception.call(this,String(value),previous,native);
	this.value = value;
};
haxe_ValueException.__name__ = true;
haxe_ValueException.__super__ = haxe_Exception;
haxe_ValueException.prototype = $extend(haxe_Exception.prototype,{
	unwrap: function() {
		return this.value;
	}
});
var haxe_ds_BalancedTree = function() {
};
haxe_ds_BalancedTree.__name__ = true;
haxe_ds_BalancedTree.prototype = {
	set: function(key,value) {
		this.root = this.setLoop(key,value,this.root);
	}
	,get: function(key) {
		var node = this.root;
		while(node != null) {
			var c = this.compare(key,node.key);
			if(c == 0) {
				return node.value;
			}
			if(c < 0) {
				node = node.left;
			} else {
				node = node.right;
			}
		}
		return null;
	}
	,setLoop: function(k,v,node) {
		if(node == null) {
			return new haxe_ds_TreeNode(null,k,v,null);
		}
		var c = this.compare(k,node.key);
		if(c == 0) {
			return new haxe_ds_TreeNode(node.left,k,v,node.right,node == null ? 0 : node._height);
		} else if(c < 0) {
			var nl = this.setLoop(k,v,node.left);
			return this.balance(nl,node.key,node.value,node.right);
		} else {
			var nr = this.setLoop(k,v,node.right);
			return this.balance(node.left,node.key,node.value,nr);
		}
	}
	,balance: function(l,k,v,r) {
		var hl = l == null ? 0 : l._height;
		var hr = r == null ? 0 : r._height;
		if(hl > hr + 2) {
			var _this = l.left;
			var _this1 = l.right;
			if((_this == null ? 0 : _this._height) >= (_this1 == null ? 0 : _this1._height)) {
				return new haxe_ds_TreeNode(l.left,l.key,l.value,new haxe_ds_TreeNode(l.right,k,v,r));
			} else {
				return new haxe_ds_TreeNode(new haxe_ds_TreeNode(l.left,l.key,l.value,l.right.left),l.right.key,l.right.value,new haxe_ds_TreeNode(l.right.right,k,v,r));
			}
		} else if(hr > hl + 2) {
			var _this = r.right;
			var _this1 = r.left;
			if((_this == null ? 0 : _this._height) > (_this1 == null ? 0 : _this1._height)) {
				return new haxe_ds_TreeNode(new haxe_ds_TreeNode(l,k,v,r.left),r.key,r.value,r.right);
			} else {
				return new haxe_ds_TreeNode(new haxe_ds_TreeNode(l,k,v,r.left.left),r.left.key,r.left.value,new haxe_ds_TreeNode(r.left.right,r.key,r.value,r.right));
			}
		} else {
			return new haxe_ds_TreeNode(l,k,v,r,(hl > hr ? hl : hr) + 1);
		}
	}
	,compare: function(k1,k2) {
		return Reflect.compare(k1,k2);
	}
};
var haxe_ds_TreeNode = function(l,k,v,r,h) {
	if(h == null) {
		h = -1;
	}
	this.left = l;
	this.key = k;
	this.value = v;
	this.right = r;
	if(h == -1) {
		var tmp;
		var _this = this.left;
		var _this1 = this.right;
		if((_this == null ? 0 : _this._height) > (_this1 == null ? 0 : _this1._height)) {
			var _this = this.left;
			tmp = _this == null ? 0 : _this._height;
		} else {
			var _this = this.right;
			tmp = _this == null ? 0 : _this._height;
		}
		this._height = tmp + 1;
	} else {
		this._height = h;
	}
};
haxe_ds_TreeNode.__name__ = true;
var haxe_ds_EnumValueMap = function() {
	haxe_ds_BalancedTree.call(this);
};
haxe_ds_EnumValueMap.__name__ = true;
haxe_ds_EnumValueMap.__super__ = haxe_ds_BalancedTree;
haxe_ds_EnumValueMap.prototype = $extend(haxe_ds_BalancedTree.prototype,{
	compare: function(k1,k2) {
		var d = k1._hx_index - k2._hx_index;
		if(d != 0) {
			return d;
		}
		var p1 = Type.enumParameters(k1);
		var p2 = Type.enumParameters(k2);
		if(p1.length == 0 && p2.length == 0) {
			return 0;
		}
		return this.compareArgs(p1,p2);
	}
	,compareArgs: function(a1,a2) {
		var ld = a1.length - a2.length;
		if(ld != 0) {
			return ld;
		}
		var _g = 0;
		var _g1 = a1.length;
		while(_g < _g1) {
			var i = _g++;
			var d = this.compareArg(a1[i],a2[i]);
			if(d != 0) {
				return d;
			}
		}
		return 0;
	}
	,compareArg: function(v1,v2) {
		if(Reflect.isEnumValue(v1) && Reflect.isEnumValue(v2)) {
			return this.compare(v1,v2);
		} else if(((v1) instanceof Array) && ((v2) instanceof Array)) {
			return this.compareArgs(v1,v2);
		} else {
			return Reflect.compare(v1,v2);
		}
	}
});
var haxe_ds_StringMap = function() {
	this.h = Object.create(null);
};
haxe_ds_StringMap.__name__ = true;
var haxe_io_Bytes = function(data) {
	this.length = data.byteLength;
	this.b = new Uint8Array(data);
	this.b.bufferValue = data;
	data.hxBytes = this;
	data.bytes = this.b;
};
haxe_io_Bytes.__name__ = true;
var haxe_io_Encoding = $hxEnums["haxe.io.Encoding"] = { __ename__:true,__constructs__:null
	,UTF8: {_hx_name:"UTF8",_hx_index:0,__enum__:"haxe.io.Encoding",toString:$estr}
	,RawNative: {_hx_name:"RawNative",_hx_index:1,__enum__:"haxe.io.Encoding",toString:$estr}
};
haxe_io_Encoding.__constructs__ = [haxe_io_Encoding.UTF8,haxe_io_Encoding.RawNative];
var haxe_io_Eof = function() {
};
haxe_io_Eof.__name__ = true;
haxe_io_Eof.prototype = {
	toString: function() {
		return "Eof";
	}
};
var haxe_io_Error = $hxEnums["haxe.io.Error"] = { __ename__:true,__constructs__:null
	,Blocked: {_hx_name:"Blocked",_hx_index:0,__enum__:"haxe.io.Error",toString:$estr}
	,Overflow: {_hx_name:"Overflow",_hx_index:1,__enum__:"haxe.io.Error",toString:$estr}
	,OutsideBounds: {_hx_name:"OutsideBounds",_hx_index:2,__enum__:"haxe.io.Error",toString:$estr}
	,Custom: ($_=function(e) { return {_hx_index:3,e:e,__enum__:"haxe.io.Error",toString:$estr}; },$_._hx_name="Custom",$_.__params__ = ["e"],$_)
};
haxe_io_Error.__constructs__ = [haxe_io_Error.Blocked,haxe_io_Error.Overflow,haxe_io_Error.OutsideBounds,haxe_io_Error.Custom];
var haxe_iterators_ArrayIterator = function(array) {
	this.current = 0;
	this.array = array;
};
haxe_iterators_ArrayIterator.__name__ = true;
haxe_iterators_ArrayIterator.prototype = {
	hasNext: function() {
		return this.current < this.array.length;
	}
	,next: function() {
		return this.array[this.current++];
	}
};
var js_Boot = function() { };
js_Boot.__name__ = true;
js_Boot.__string_rec = function(o,s) {
	if(o == null) {
		return "null";
	}
	if(s.length >= 5) {
		return "<...>";
	}
	var t = typeof(o);
	if(t == "function" && (o.__name__ || o.__ename__)) {
		t = "object";
	}
	switch(t) {
	case "function":
		return "<function>";
	case "object":
		if(o.__enum__) {
			var e = $hxEnums[o.__enum__];
			var con = e.__constructs__[o._hx_index];
			var n = con._hx_name;
			if(con.__params__) {
				s = s + "\t";
				return n + "(" + ((function($this) {
					var $r;
					var _g = [];
					{
						var _g1 = 0;
						var _g2 = con.__params__;
						while(true) {
							if(!(_g1 < _g2.length)) {
								break;
							}
							var p = _g2[_g1];
							_g1 = _g1 + 1;
							_g.push(js_Boot.__string_rec(o[p],s));
						}
					}
					$r = _g;
					return $r;
				}(this))).join(",") + ")";
			} else {
				return n;
			}
		}
		if(((o) instanceof Array)) {
			var str = "[";
			s += "\t";
			var _g = 0;
			var _g1 = o.length;
			while(_g < _g1) {
				var i = _g++;
				str += (i > 0 ? "," : "") + js_Boot.__string_rec(o[i],s);
			}
			str += "]";
			return str;
		}
		var tostr;
		try {
			tostr = o.toString;
		} catch( _g ) {
			return "???";
		}
		if(tostr != null && tostr != Object.toString && typeof(tostr) == "function") {
			var s2 = o.toString();
			if(s2 != "[object Object]") {
				return s2;
			}
		}
		var str = "{\n";
		s += "\t";
		var hasp = o.hasOwnProperty != null;
		var k = null;
		for( k in o ) {
		if(hasp && !o.hasOwnProperty(k)) {
			continue;
		}
		if(k == "prototype" || k == "__class__" || k == "__super__" || k == "__interfaces__" || k == "__properties__") {
			continue;
		}
		if(str.length != 2) {
			str += ", \n";
		}
		str += s + k + " : " + js_Boot.__string_rec(o[k],s);
		}
		s = s.substring(1);
		str += "\n" + s + "}";
		return str;
	case "string":
		return o;
	default:
		return String(o);
	}
};
var js_node_ChildProcess = require("child_process");
var js_node_Fs = require("fs");
var js_node_KeyValue = {};
js_node_KeyValue.__properties__ = {get_value:"get_value",get_key:"get_key"};
js_node_KeyValue.get_key = function(this1) {
	return this1[0];
};
js_node_KeyValue.get_value = function(this1) {
	return this1[1];
};
var js_node_Os = require("os");
var js_node_Path = require("path");
var js_node_buffer_Buffer = require("buffer").Buffer;
var js_node_stream_WritableNewOptionsAdapter = {};
js_node_stream_WritableNewOptionsAdapter.from = function(options) {
	if(!Object.prototype.hasOwnProperty.call(options,"final")) {
		Object.defineProperty(options,"final",{ get : function() {
			return options.final_;
		}});
	}
	return options;
};
var js_node_url_URLSearchParamsEntry = {};
js_node_url_URLSearchParamsEntry.__properties__ = {get_value:"get_value",get_name:"get_name"};
js_node_url_URLSearchParamsEntry._new = function(name,value) {
	var this1 = [name,value];
	return this1;
};
js_node_url_URLSearchParamsEntry.get_name = function(this1) {
	return this1[0];
};
js_node_url_URLSearchParamsEntry.get_value = function(this1) {
	return this1[1];
};
var sys_FileSystem = function() { };
sys_FileSystem.__name__ = true;
sys_FileSystem.exists = function(path) {
	try {
		js_node_Fs.accessSync(path);
		return true;
	} catch( _g ) {
		return false;
	}
};
var sys_io_FileInput = function(fd) {
	this.fd = fd;
	this.pos = 0;
};
sys_io_FileInput.__name__ = true;
sys_io_FileInput.__super__ = haxe_io_Input;
sys_io_FileInput.prototype = $extend(haxe_io_Input.prototype,{
	readByte: function() {
		var buf = js_node_buffer_Buffer.alloc(1);
		var bytesRead;
		try {
			bytesRead = js_node_Fs.readSync(this.fd,buf,0,1,this.pos);
		} catch( _g ) {
			var e = haxe_Exception.caught(_g).unwrap();
			if(e.code == "EOF") {
				throw haxe_Exception.thrown(new haxe_io_Eof());
			} else {
				throw haxe_Exception.thrown(haxe_io_Error.Custom(e));
			}
		}
		if(bytesRead == 0) {
			throw haxe_Exception.thrown(new haxe_io_Eof());
		}
		this.pos++;
		return buf[0];
	}
	,readBytes: function(s,pos,len) {
		var data = s.b;
		var buf = js_node_buffer_Buffer.from(data.buffer,data.byteOffset,s.length);
		var bytesRead;
		try {
			bytesRead = js_node_Fs.readSync(this.fd,buf,pos,len,this.pos);
		} catch( _g ) {
			var e = haxe_Exception.caught(_g).unwrap();
			if(e.code == "EOF") {
				throw haxe_Exception.thrown(new haxe_io_Eof());
			} else {
				throw haxe_Exception.thrown(haxe_io_Error.Custom(e));
			}
		}
		if(bytesRead == 0) {
			throw haxe_Exception.thrown(new haxe_io_Eof());
		}
		this.pos += bytesRead;
		return bytesRead;
	}
	,close: function() {
		js_node_Fs.closeSync(this.fd);
	}
	,seek: function(p,pos) {
		switch(pos._hx_index) {
		case 0:
			this.pos = p;
			break;
		case 1:
			this.pos += p;
			break;
		case 2:
			this.pos = js_node_Fs.fstatSync(this.fd).size + p;
			break;
		}
	}
	,tell: function() {
		return this.pos;
	}
	,eof: function() {
		return this.pos >= js_node_Fs.fstatSync(this.fd).size;
	}
});
var sys_io_FileOutput = function(fd) {
	this.fd = fd;
	this.pos = 0;
};
sys_io_FileOutput.__name__ = true;
sys_io_FileOutput.__super__ = haxe_io_Output;
sys_io_FileOutput.prototype = $extend(haxe_io_Output.prototype,{
	writeByte: function(b) {
		var buf = js_node_buffer_Buffer.alloc(1);
		buf[0] = b;
		js_node_Fs.writeSync(this.fd,buf,0,1,this.pos);
		this.pos++;
	}
	,writeBytes: function(s,pos,len) {
		var data = s.b;
		var buf = js_node_buffer_Buffer.from(data.buffer,data.byteOffset,s.length);
		var wrote = js_node_Fs.writeSync(this.fd,buf,pos,len,this.pos);
		this.pos += wrote;
		return wrote;
	}
	,close: function() {
		js_node_Fs.closeSync(this.fd);
	}
	,seek: function(p,pos) {
		switch(pos._hx_index) {
		case 0:
			this.pos = p;
			break;
		case 1:
			this.pos += p;
			break;
		case 2:
			this.pos = js_node_Fs.fstatSync(this.fd).size + p;
			break;
		}
	}
	,tell: function() {
		return this.pos;
	}
});
var sys_io_FileSeek = $hxEnums["sys.io.FileSeek"] = { __ename__:true,__constructs__:null
	,SeekBegin: {_hx_name:"SeekBegin",_hx_index:0,__enum__:"sys.io.FileSeek",toString:$estr}
	,SeekCur: {_hx_name:"SeekCur",_hx_index:1,__enum__:"sys.io.FileSeek",toString:$estr}
	,SeekEnd: {_hx_name:"SeekEnd",_hx_index:2,__enum__:"sys.io.FileSeek",toString:$estr}
};
sys_io_FileSeek.__constructs__ = [sys_io_FileSeek.SeekBegin,sys_io_FileSeek.SeekCur,sys_io_FileSeek.SeekEnd];
function $bind(o,m) { if( m == null ) return null; if( m.__id__ == null ) m.__id__ = $global.$haxeUID++; var f; if( o.hx__closures__ == null ) o.hx__closures__ = {}; else f = o.hx__closures__[m.__id__]; if( f == null ) { f = m.bind(o); o.hx__closures__[m.__id__] = f; } return f; }
$global.$haxeUID |= 0;
if(typeof(performance) != "undefined" ? typeof(performance.now) == "function" : false) {
	HxOverrides.now = performance.now.bind(performance);
}
if( String.fromCodePoint == null ) String.fromCodePoint = function(c) { return c < 0x10000 ? String.fromCharCode(c) : String.fromCharCode((c>>10)+0xD7C0)+String.fromCharCode((c&0x3FF)+0xDC00); }
String.__name__ = true;
Array.__name__ = true;
Date.__name__ = "Date";
js_Boot.__toStr = ({ }).toString;
Engine.CONF_FILE = "config.ini";
Engine.SECTION_SERVICES = "services";
Engine.SECTION_TWEAKS = "tweaks";
djNode_BaseApp.VERSION = "0.6.2";
djNode_BaseApp.LINE_LEN = 40;
djA_ConfigFileB.OBJEX_NUM_SYMBOL = "#";
djA_ConfigFileB.STRING_TERMINATOR = "\\e";
djA_ConfigFileB.FORCE_EMPTYLINES = "\\l";
djA_ConfigFileB.NEWLINES = ["\n","\r","r\n"];
djA_ConfigFileB.COMMENTS = ["#",";"];
djA_ConfigFileB.NO_NEW_LINE = "\\";
djA_ConfigFileB.reg_section = new EReg("^\\[([^\\]]+)\\]","");
djA_ConfigFileB.reg_def = new EReg("^([^(){}:=]+)[:=](.*)","");
djA_StrT.OVERFLOW_SMBL = "-";
djNode_Keycode.CTRLC = "\x03";
djNode_Keycode.ESC = "\x1B";
djNode_Keycode.UP = "\x1B[A";
djNode_Keycode.DOWN = "\x1B[B";
djNode_Keycode.LEFT = "\x1B[C";
djNode_Keycode.RIGHT = "\x1B[D";
djNode_Keycode.BACKSP = "\x08";
djNode_Keycode.TAB = "\t";
djNode_Keycode.ENTER = "\r";
djNode_Keycode.DELETE = "";
djNode_Keyboard.FLAG_CAN_BREAK = true;
djNode_tools_LOG.messageTypes = ["DEBUG","INFO","WARN","ERROR","FATAL"];
djNode_tools_LOG._isInited = false;
djNode_tools_LOG.logLevel = 0;
djNode_tools_LOG.flag_socket_log = false;
djNode_tools_LOG.FLAG_SHOW_MESSAGE_TYPE = false;
djNode_tools_LOG.FLAG_SHOW_POS = true;
djNode_tools_LOG.FLAG_STDOUT = false;
djNode_tools_LOG.BUFFER_SIZE = 8000;
djNode_utils_CLIApp.FLAG_LOG_QUIET = true;
djNode_utils_Print2.H_STYLES = [{ templ : "<cyan>>><bold,white,:darkblue> {1} <!>", pad0 : 1, pad1 : 4, line : null},{ templ : "<:blue,black>><!> <blue>{1}<!>", pad0 : 4, pad1 : 6, line : null}];
Main.main();
})(typeof window != "undefined" ? window : typeof global != "undefined" ? global : typeof self != "undefined" ? self : this);

//# sourceMappingURL=winmt.js.map