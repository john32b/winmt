# WIN-MT

> ✴️ **2022-08 NOTICE** -- I am done with Windows, I will never be working on this project ever again 👻👻

On a **Windows 10** installation, **`win-mt`** *(Windows My Tools)*, is a **NodeJS** tool that can apply **tweaks/modifications** to various **system settings** based on a **config file**.

**More specifically :**

- Can **mass-disable** a list of **Services** *( also can mass-enable, display state information on services )*
- Can **disable Tasks** from the **Task Scheduler** 
- Can apply **Group Policy Modifications**
- Can apply general tweaks by writing to the **Windows Registry**
- Can also **run commands** for other Windows Tweaks.
- All the modifications/tweaks are defined in a **human readable/editable** `config.ini` file. So you can alter/add your own modifications easily



## ❗ READ THIS - IMPORTANT ❗

- Currently `win-mt` comes with a **curated config file**, that includes my own set of things to alter. You can easily modify the config and make it your own, with your own set of services and tasks etc. to disable and tweaks to apply.

- The included curated config file is meant to work for **WINDOWS 10 LTSC (1809)** 

- Needs  **NodeJS** to run. (https://nodejs.org)

- ☢️ This is an **advanced** tool ☣️ - Meant for power users who know what they are doing.

- ⚠️ **USE AT YOUR OWN RISK** ⚠️ - I am not responsible if your system crashes​ or stops working.
  
  

![](/media/shot_02.png)  
<sup>Displaying information on the service group "user"</sup>



## MOTIVATION - ABOUT

I wanted a quick way to apply a set of settings that I was doing by hand every time I did a fresh Windows installation. So I gathered (mostly) all of the things that I would do into a single convenient tool. The reason this is not a batch file, is because in some cases I wanted better logic in some operations. Like when disabling a service, if it fails to do it one way, the program will do it another way. Also I am comfortable with both HAXE and NodeJS . Plus I can get better and more colorful output to the Terminal with NodeJS 😺

This tool is not meant for mass-consumption, I know that this is a very niche thing. Perhaps it will help someone coming from google that wants to find a quick way to mass disable services, who knows.


## 🏃‍♂️ RUNNING

First of all, `win-mt` can only run with **administrator privileges**. It will warn you about it.  

![](/media/shot_01.png)

`win-mt` currently has two main ACTIONS. Working with SERVICES and applying all the TWEAKS at once. So if you want to apply the tweaks and disable the service blocklist, you need to run this twice 😐

#### Action `serv`

This is a multi action. With this you can **[enable/disable/display information]** a group of services.  
The groups for services you can work with are:  

- `all` : meaning the ENTIRETY of system services,  (except Driver/Kernel Services). This is mostly when you want to mass-enable or display information
- `blocklist` : This is the curated service blocklist that you can find in `config.ini`. I want these services disabled on my system
- `user` : These are all the USER TYPE services.
- `{group}` : If you define a custom key in the `config.ini` file under the `services` section, you can operate on the group by just calling the group name. Example `node winmt serv bluetooth disable` > will act on the list of services with the key name `bluetooth`.  

After setting the **group name**, you need to specify an operation

- `enable` : Sets the services to "DEMAND" mode and tries to START them.

- `disable` : Sets the services to "DISABLED" mode and tries to STOP them.

- `info` : Displays Information on the services, does not alter anything. It shows the running status of the services. When using `info` you can specify some additional options.

  - `-id` : Display the ID string of the Services also
  - `-sort` : Sort the order of the info by `state` *(running or not)* or by `type` *(user service, win32shared, etc)*

  Example `node winmt serv all info -sort state` > will display the status of ALL services sorted by running state.


#### Action `tweaks`

This will apply all the settings/tweaks that are defined in `config.ini` under the `[tweaks]` section. A curated list of :

- Group Policy Settings
- Task Scheduler Tasks to Disable
- Registry tweaks
- Commands

Consult `config.ini` to see what exactly.  
To run just do `node winmt tweaks`



## 🛠️ Advanced / How does it do it

#### Enabling/Disabling Services

WINMT, uses the `sc` windows command to manipulate the state of services,  
so it will do a `sc stop {serviceID}` to stop a service and `sc config $ID start= disabled` to disable it.  
**HOWEVER**, if a service cannot be stopped with `sc` then it will try to disable a service by writing to the Registry  
and modifying the service `START` value e.g. `HKLM\\SYSTEM\\CurrentControlSet\\Services\\SEVICE_ID Start = 4`  

#### Group Policy Modifications

I could not find a better way to alter the Group Policy, so `win-mt` alters the values by writing to the Windows Registry,  
it seems to work, so I am sticking with it.

#### Task Scheduler 

To disable Tasks `win-mt` uses the `schtasks` windows command, and more specifically  
it calls `schtasks /change /tn TASK_PATH /disable` to every Task on the list.

#### `Config.ini`

Every Tweak and List `win-mt` reads from the `config.ini` file. It is documented so I think you should be able to edit this to your liking.

## BUILDING FROM SOURCE

**Requires:**

- General HAXE knowledge, how to build, install a haxelib
- HAXE 4.1.5
- djNode 0.6.2, installed as a haxelib. https://github.com/john32b/djNode 
  - Download the tag zip directly from [here](https://github.com/john32b/djNode/releases/tag/v0.6.2)
  - Install the `.zip` file with `haxelib install djNode-0.6.2.zip`
- hxnodejs. https://github.com/HaxeFoundation/hxnodejs

**To build:**

`haxe build.hxml`  

> This will generate `winmt.js` in the bin folder

---
## INFO
Author : **John32B** - Project started: **2020/10** - Tools : **Haxe Built to nodeJS**