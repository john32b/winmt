package ;

class TaskD 
{
	public var PATH:String; 
	public var STATUS:String; // Running, Ready, Disabled
	
	public function isDisabled() { 	return STATUS == "Disabled"; }	
	
	public function new() {}
}