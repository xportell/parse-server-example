console.log('Loading cloud.....');
console.log( 'clodu code:' + __dirname);

//Use Parse.Cloud.define to define as many cloud functions as you want.
//For example:
var _ = require('./underscore.js')

/**
* Vars
*/
//ROLES:
//Moderator role name
var moderatorRole = 'role:moderator';
//Workgroup role name
var workgroupRole = 'role:workgroup';
//Can create workgroups
var canCreateGroup = ['user'];

var workgroupObject;
var guestGroupObject;
var groupsObject = {};
var getGroupRole = function(name){
	var roleQuery = new Parse.Query(Parse.Role);
	roleQuery.equalTo('name', name || 'workgroup');
	
	return roleQuery.first({useMasterKey: true}).then(function(role) {
  		if (!role) {
   		 throw new Error('nosuchrole');
  		}
		if(name=='workgroup') workgroupObject = role;
		groupsObject[name] = role;
		console.log('More groups', groupsObject);
		return role;
	});
}

getGroupRole('workgroup');
getGroupRole('guestgroup');

Parse.Cloud.define("getTags", function(request,response){
	var tags =request.params.tags;
	console.log('tags',tags);
	
	var classNames = [
		"Forum",
		"Note",
		"Event",
		"Hashtag",
		"Todo",
		"Post",
		"Idea",
		"Poll"
	];

	Activity = Parse.Object.extend("Activity");
	
	var orArgs = classNames.map(function(item){
		var innQuery = new Parse.Query(item);	
		var subQuery = new Parse.Query(Activity);
		return subQuery.matchesQuery("base", innQuery.containsAll('tags',tags));
	});

	
	var query = Parse.Query.or.apply(this, orArgs);
	query.include("childs");
	query.include("childs.author");
	query.include("base");
	query.include("base.author");
	
	console.log(query);
	
	query.find({sessionToken: request.user.getSessionToken()}).then(
		  function(activities) {
				response.success(activities);
		  }, function(error) {
		      // The file either could not be read, or could not be saved to Parse.
		      console.log("Error in requesting tags:" + JSON.stringify(error));
		      response.error(error);
		  });
});

Parse.Cloud.define("createGroup", function(request,response){
	//console.log(request);
	var name = request.params.name || '';
	var type = request.params.type || '';
	var members = request.params.group || [];

	if(name == '') response.error('noname');
	if(['workgroup','guestgroup'].indexOf(type)<0) response.error('no valid group');
	if(members == 0) response.error('nomembers');
	
	var roleName = name.replace(/\W/g, '');

	userHasRole(request.user, canCreateGroup)
	.then(function(hasRole){
		var roleACL = new Parse.ACL();
		//Set correct permissions
		roleACL.setPublicReadAccess(true);
		var role = new Parse.Role(roleName, roleACL);
		
		members.forEach(function(member){
			var user = new Parse.User();
			user.set('id', member.user.id);
			role.getUsers().add(user);
		})

		return role.save(null,{useMasterKey: true}).then(function(role){
			//Add role to workgroup role realtion
			groupsObject[type].getRoles().add(role);
			groupsObject[type].save(null,{useMasterKey: true});
			return role;
		});
	})
	.then(function(role){
		var Profile = Parse.Object.extend("Profile");
		var profile = new Profile;
		
		profile.set("name",name);
		profile.set("role",{
			"__type": "Pointer",
			"className": role.className,
			"objectId": role.id
		});
		var profileACL = new Parse.ACL();
		profileACL.setPublicReadAccess(true);
		profile.setACL(profileACL);
		return profile.save(null,{useMasterKey: true});
		 //throw new Error('nopermission');
	})
	.then(function(profile){
		response.success({result: profile});
	})
	.catch(function(err){
		response.error(err);
	});
});

Parse.Cloud.define("createWorkgroup", function(request,response){
	//console.log(request);
	var name = request.params.name || '';
	var members = request.params.workgroup || [];

	if(name == '') response.error('noname');
	if(members == 0) response.error('nomembers');
	
	var roleName = name.replace(/\W/g, '');

	userHasRole(request.user, canCreateGroup)
	.then(function(hasRole){
		var roleACL = new Parse.ACL();
		//Set correct permissions
		roleACL.setPublicReadAccess(true);
		var role = new Parse.Role(roleName, roleACL);
		
		members.forEach(function(member){
			var user = new Parse.User();
			user.set('id', member.user.id);
			role.getUsers().add(user);
		})

		return role.save(null,{useMasterKey: true}).then(function(role){
			//Add role to workgroup role realtion
			workgroupObject.getRoles().add(role);
			workgroupObject.save(null,{useMasterKey: true});
			return role;
		});
	})
	.then(function(role){
		var Profile = Parse.Object.extend("Profile");
		var profile = new Profile;
		
		profile.set("name",name);
		profile.set("role",{
			"__type": "Pointer",
			"className": role.className,
			"objectId": role.id
		});
		var profileACL = new Parse.ACL();
		profileACL.setPublicReadAccess(true);
		profile.setACL(profileACL);
		return profile.save(null,{useMasterKey: true});
		 //throw new Error('nopermission');
	})
	.then(function(profile){
		response.success({result: profile});
	})
	.catch(function(err){
		response.error(err);
	});
});

Parse.Cloud.define("UploadImageAndGetURL", function(request, response) {

  var fileName = request.params.fileName;
  var base64 = request.params.base64EncodedImageString;

  var file = new Parse.File(fileName, { base64: base64 });

  file.save(null, {useMasterKey:true}).then(function(fileObject) {
      // The file has been saved to Parse.
      var photoURL = fileObject.url();
      var photoName = fileObject.name();
      console.log("Photo" + photoName +  " saved successfully with URL:" + photoURL);
      response.success({
      	name: photoName,
      	url: photoURL
      });
    }, function(error) {
      // The file either could not be read, or could not be saved to Parse.
      console.log("The file either could not be read, or could not be saved to Parse:" + JSON.stringify(error));
      response.error(error);
  });

});

function updateActivity(request, response){
	var type = request.object.className;
	var item = {
     		"__type": "Pointer",
     		"className": type,
     		"objectId": request.object.id,
 	};
 		
	Activity = Parse.Object.extend("Activity");
	var activity = new Activity;

	if(request.object.attributes.parent){
		activity.set("id",request.object.attributes.parent.id);
		activity.addUnique("childs", item);
	}
	else{
		activity.set("type", type);
		activity.addUnique("base", item);
		
		//If new activity save ACL
		if(request.object.attributes.ACL)  activity.setACL(activityACL(request.object.attributes.ACL));
	}
	
	//Set attributes if exist
	if(request.object.attributes.attributes) activity.set("attributes",request.object.attributes.attributes);
	else activity.set("attributes",[]);


	activity.save(null,{
	  useMasterKey:true,
	  success: function(activity) {
	    sendActivityPush(activity, request);
	    response.success(activity);
	  },
	  error: function(activity, error) {
	     response.error(error);
	  }
	});
	
	addTag(request, response);

}

function activityACL(item){
	var acl = new Parse.ACL();
	//acl.setPublicReadAccess(true);
        acl.setPublicWriteAccess(false);
	for(var prop in item.permissionsById) {
		if (prop==moderatorRole){
			acl.setReadAccess(prop, true);
			acl.setWriteAccess(prop, true);
		}
		else if (prop=='*'){
			acl.setPublicReadAccess(item.permissionsById[prop].read);
		        acl.setPublicWriteAccess(false);
		}
		else if(prop!='*'){
			acl.setReadAccess(prop, item.permissionsById[prop].read);
			acl.setWriteAccess(prop, false);	
		}
	}
	return acl;
}

function addTag(request, response){
	console.log('---------------------');
	console.log(request.object.attributes.tags);
	var tags = request.object.attributes.tags;

	var Tag = Parse.Object.extend("Tag");
	var query = new Parse.Query(Tag);
	query.containedIn("label", tags);
	
	query.find({
		success: function(results) {
			console.log("Successfully retrieved " + results.length + " tags.");
			// Do something with the returned Parse.Object values
			var toInc = [];
			var toAdd = tags;
			results.forEach(function(object){
				var index = tags.indexOf(object.get("label"));
				toAdd.splice(index,1);
				toInc.push(object);
				object.increment("count");
				object.save(null,{useMasterKey:true});

			});
			
			toAdd.forEach(function(tagName){
				var tag = new Tag;
				tag.set("label",tagName);
				tag.set("count", 1);
				tag.save(null,{useMasterKey:true});
			});
			console.log("*********TOINC", toInc); 
			console.log("*********TOADD", toAdd);
		  },
		error: function(error) {
			console.log("Error: " + error.code + " " + error.message);
		}
	});


	
}

/**
* Before save Activity (for likes) - NOT WORKS
*
*/
Parse.Cloud.beforeSave("Activity", function(request, response) {
	response.success();
});

/**
* BeforeSave SubActivity
*
* 	1. Adds moderator role to the subactivity
*/

Parse.Cloud.beforeSave("Note", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});

Parse.Cloud.beforeSave("Forum", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});

Parse.Cloud.beforeSave("Hashtag", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});

Parse.Cloud.beforeSave("Idea", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});


Parse.Cloud.beforeSave("Post", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});


Parse.Cloud.beforeSave("Event", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});


Parse.Cloud.beforeSave("Todo", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});

Parse.Cloud.beforeSave("Poll", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	response.success();
});

//No subactivities beforeSave

Parse.Cloud.beforeSave("Message", function(request, response) {
	//request.object.set("ACL",addModerator(request));
	console.log('Request BeforeSave+++++', request.object.id);
	if(request.object.id) response.success();
	else{
		getMsgProfiles(request.object.get("profiles")).then(
			function(res){
				var authorized = false;
				var users = res.map(function(item){
					if(item.get('user').id == request.user.id) authorized = true;
					return item.get('user').id;
				});
				var acl = new Parse.ACL();
				request.object.set("ACL",addUsersACL(acl,users));
				if(!authorized) response.error('No permissions');
				response.success();
			},
			function(error){
				response.error(error);
			}
		);
	}

});

function addUsersACL(acl, users){
	users.forEach(function(user){
		try{
			acl.setReadAccess(user, true);
			acl.setWriteAccess(user, true);	
		}catch(e){
			console.log('exception',e);
		}
	});
	return acl;
}

function addModerator(request){
	var acl = request.object.get("ACL");
	acl.setReadAccess(moderatorRole, true);
	acl.setWriteAccess(moderatorRole, true);	
	return acl;
}

/**
* AfterSave SubActivity
*/
Parse.Cloud.afterSave("Event",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
}); 

Parse.Cloud.afterSave("Post",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
}); 

Parse.Cloud.afterSave("Comment",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Like",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Note",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Forum",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Hashtag",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Todo",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Idea",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Post",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterSave("Poll",function(request, response) {
	if(request.object.attributes.updatedAt == request.object.attributes.createdAt) updateActivity(request);
	else response.success(request.object); //Not works... the return value is {objectId, createdAt}
});

Parse.Cloud.afterDelete("Like",function(request, response) {
	var like = {
		"__type":"Pointer",
		"className":"Like",
		"objectId": request.object.id,
		};
	Activity = Parse.Object.extend("Activity");
	var activity = new Activity;	
	activity.set('id', request.object.attributes.parent);	 
		activity.remove("childs", like);
		activity.save(null,{
		  success: function(post) {
		    // save succeeded
		  },
		  error: function(post, error) {
		    // inspect error
		  }
		});
});


Parse.Cloud.afterDelete("dtest", function(request, response){
	console.log(request);
	console.log(response);
	response.error(request);
});

Parse.Cloud.afterSave("dtest", function(request, response){
	console.log(request);
	response.error('hi joe!');
});


Parse.Cloud.beforeDelete("Post", function(request, response) {
	var target = {"__type":"Pointer","className":"Post","objectId":request.object.id};
  query = new Parse.Query("Activity");
  //query.include("childs");
  query.equalTo("childs", target);
  query.equalTo("parent",undefined);
  query.find({
    success: function(activities) {
	var objects = [];
	console.log(activities);
	//for (var i = 0; i < activities.length; i++) {
	for (var i = 0; i < 1; i++) {
	      var activity = activities[i];
	      var n = activity.get("childs");
	      console.log(n);
	      for(var j = 0; j < n.length; j++){
	      	if(n[j].id != target.objectId){
		      	var DObject = Parse.Object.extend(n[j].className);
			var object = new DObject;
			object.set('id', n[j].id);
			objects.push(object);	
	      	}
	      }
	      console.log(activity.className);
	      console.log(activity.id);
	      var Base = Parse.Object.extend(activity.className);
	      var object = new Base;
	      object.set('id', activity.id);
	      objects.push(object);	
	 }
	 
      	//response.error(objects);
        Parse.Object.destroyAll(objects).then(function(success) {
	  response.success();
	}, function(error) {
	  response.error("Error " + error.code + " : " + error.message + " when deleting activity.");
	});
      
    },
    error: function(error) {
      response.error("Error " + error.code + " : " + error.message + " when deleting activity.");
    }
  });
});

Parse.Cloud.define('hello', function(req, res) {
	console.log('hello', req);
  res.success('Hi');
});


Parse.Cloud.define("isMe", function(request, response) {
		var Profile = Parse.Object.extend("Profile");
		var query = new Parse.Query(Profile);

		
		query.equalTo("objectId", request.params.profileId);
		query.first().then(function(object){
			 console.log(object.attributes.user.id);
			 console.log(request.user.id);
			 if(object.attributes.user.id == request.user.id) response.success('Wellcome');
			 else response.error('Realy?');
		});	
});


Parse.Cloud.define("signupAsBasicUser", function(request, response) {
	console.log('signupAsBasicUser2 init',request);
	var postParams = request.body;
	console.log(postParams);
	//console.log(request.params);
	console.log(request.params.username);
	console.log(request.params.email);
	console.log(request.params.password);
	console.log(request.params.profile);
	
	signupAsBasicUser(request.params.username, request.params.password, request.params.email).then(function(user) {
		
		response.success(user);
		
     		/*var Profile = Parse.Object.extend("Profile");
		var profile = new Profile;
		
		var pUser = {
                            "__type": "Pointer",
                            "className": "_User",
                            "objectId": user.object.objectId
		};
		
		profile.set("user", pUser);
		profile.set("organitzation", request.params.profile.organitzation);
		profile.set("surnames", request.params.profile.surnames);
		console.log(profile);
		profile.save({ useMasterKey: true },{
				sucess: function(profile){
				//save succeeded
				response.success(user);
				},
				error: function(profile, error){
				//	inspect error
				}
			});*/
     		
     		//response.success(user);
 	}, function(error) {
     		response.error(error);
	 });
});

//return a promise fulfilled with a signed-up user who is added to the 'Basic User" role
//
function signupAsBasicUser(name, password, email) {

 var user = new Parse.User();
 console.log('name '+ name);
 console.log('pass: '+password);
 console.log('email: '+email);
 user.set("username", name);
 user.set("password", password);
 user.set("email", email);
 console.log(user);
 console.log('------Abans del user.signUp------');
 return user.signUp(null, {useMasterKey: true}).then(function() {
	  console.log('------Signup fet------');
     var query = new Parse.Query(Parse.Role);
     query.equalTo("name", 'user');
     console.log('-----return query.find------');
     return query.find({useMasterKey: true});
 }).then(function(roles) {
     if (roles.length < 1) return Parse.Promise.error("no such role");
     roles[0].getUsers().add(user);
     console.log('-----dins el then function 1------');
     return roles[0].save(null,{useMasterKey: true});
 }).then(function() {
 	console.log('------dins el then function 2, return user------');
     return user;
 });
}


/**
* Callable functions
*/

Parse.Cloud.define("vote", function(request, response) {
	//Prepare vars
	var item = request.params.item;
	var index = request.params.option;
	var user = request.user;
	var useMasterKey = false;
	
	//Get target activity
	var Activity = Parse.Object.extend("Activity");
	var query = new Parse.Query(Activity);
	query.include('base');
	query.get(item, {
		  sessionToken: user.getSessionToken(),
		  success: function(activity) {
			//Get requesting profile from user
			var target = {"__type":"Pointer","className":"_User","objectId":user.id};
			var Profile = Parse.Object.extend("Profile");
			var queryProfile = new Parse.Query(Profile);
			queryProfile.equalTo("user", target);
			queryProfile.first().then(function(profile){
				//Update like
				var profilePointer = {"__type":"Pointer","className":"Profile","objectId":profile.id};
				var votes = activity.get('childs') || [];
				var exist = false;

				votes.forEach(function(item){
					if(item.className == 'Profile' && item.id == profile.id) exist = true;
				});

				if(exist) response.error({op: 'error',msg: "alredy voted"});
				//If no vote continue adding profile
				activity.addUnique('childs', profilePointer);
				 console.log('Before save activity', activity.get('base'));
				activity.save(null, {useMasterKey:true}).then(function(saved) {
					//On sucess modify poll
					console.log('After save activity', activity);
					var poll = new Parse.Object("Poll");
					var base = activity.get('base');
										console.log('base', base);
					var options = base[0].get('options');
					console.log('options2', options);
					options.forEach(function(option, i){
						if(option.index == index) options[i].votes++;
					});
					console.log('options3', options);
					poll.id = base[0].id;
					poll.set('options',options);
					poll.save(null,{useMasterKey:true}).then(function(saved) {
						response.success({op: 'add',msg: 'vote added'});
					}).catch(function(error){
						response.error({op: 'error',msg: 'vote not added'});
					});
				}).catch(function(error) {
					//Error saving like
					response.error({op: 'error',msg: 'vote not saved'});
				});
				
			}).catch(function(error){
				//No profile found
				response.error({op: 'error', msg: 'no profile found'});
			});
			
		  },
		  error: function(object, error) {
		     // Activity not find (no permissions)
			response.error({op: 'error',msg: 'forbbiden action'});
		  }
	});	
});

Parse.Cloud.define("doLike", function(request, response) {
	//Prepare vars
	var item = request.params.item;
	var user = request.user;
	var useMasterKey = false;
	
	//Get target activity
	var Activity = Parse.Object.extend("Activity");
	var query = new Parse.Query(Activity);
	query.get(item, {
		  sessionToken: user.getSessionToken(),
		  success: function(activity) {
			//Get requesting profile from user
			var target = {"__type":"Pointer","className":"_User","objectId":user.id};
			var Profile = Parse.Object.extend("Profile");
			var queryProfile = new Parse.Query(Profile);
			queryProfile.equalTo("user", target);
			queryProfile.first().then(function(profile){
				//Update like
				var profilePointer = {"__type":"Pointer","className":"Profile","objectId":profile.id};
				var likes = activity.get('childs') || [];
				var exist = false;

				likes.forEach(function(item){
					if(item.className == 'Profile' && item.id == profile.id) exist = true;
				});

				if(!exist) activity.addUnique('childs', profilePointer);
				else activity.remove('childs', profilePointer);
				activity.save(null, {useMasterKey:true}).then(function(saved) {
					//Sucess
					response.success({
						op: exist?'remove':'add',
						childs: saved.get('childs').filter(function(item){return item.className=='Profile'})
					});
				}, function(error) {
					//Error saving like
					response.error({
						op: 'error',
						childs: []
					});
				});
				
			}).catch(function(error){
				//No profile found
				response.error({
					op: 'error',
					childs: []
				});
			});
			
		  },
		  error: function(object, error) {
		     // Activity not find (no permissions)
			console.log("Error like permissions:" + JSON.stringify(error));
			response.error({
				op: 'error',
				childs: []
			});
		  }
	});
	
	
});


Parse.Cloud.define("changePercent", function(request, response) {

	var item = request.params.item;
	var value = request.params.value;
	var userId = request.user;
	console.log('userId',userId);
	var useMasterKey = false;
	
	var Todo = Parse.Object.extend("Todo");
	var query = new Parse.Query(Todo);
	query.include("assigned");
	query.get(item, {
		  success: function(todo) {
			  var assigned = todo.get("assigned");
			  console.log('+++++++assigned', assigned);
			  getUserRoles(userId).then(function(roles){
				  			  console.log('+++++++assigned2', assigned);
				//Retrive all roles of the user
				var aIds = roles.map(function(role){ return role.id});
				//Add user id to ids
				aIds.push(userId.id);
				   console.log('+++++++assigned3', aIds);
				//Check if user id and his roles id are in assigned field
				assigned.forEach(function(oUser){
					
					var id = '';
					var user = oUser.get('user');
					var role = oUser.get('role');
					console.log(user, role);
					if(typeof user != 'undefined') id = user.id;
					else if(typeof role != 'undefined') id = role.id;
					console.log('indexOf:' + id ,aIds.indexOf(id));
					if(aIds.indexOf(id) > -1) useMasterKey = true;
					 console.log('useMasterKey',useMasterKey);
				});
				//Save ToDo
				//Set default key or master key
				var key = {sessionToken: userId.getSessionToken()};
				if(useMasterKey) key = {useMasterKey: true};
				  
				todo.set("complete",value);
				todo.save(null,key).then(function(saved) {
					response.success(saved);
				}, function(error) {
					response.error(error);
				});
			 },function(error){
				console.log("Error retrieving roles:" + JSON.stringify(error));
				response.error(object);
			 });
		  },
		  error: function(object, error) {
		     // The file either could not be read, or could not be saved to Parse.
		      console.log("Error completing todo:" + JSON.stringify(error));
		      response.error(object);
		  }
	});
	
	
});


/**
* NOTIFICATIONS FUNCTIONS (ON TEST)
*/
function pushNotification(channels, data){
	console.log('-------pushNotification1-------');
	var queryPush = new Parse.Query(Parse.Installation);
	queryPush.containedIn('channels', channels);
		console.log('-------pushNotification2-------');
	
	
	Parse.Push.send({
	  where: queryPush,
	   data: data,
	}, { useMasterKey: true })
	.then(function() {
		console.log('-----------PUSH SENDED-------------');
		return('Send done');
	}, function(error) {
		console.log('---------ERROR SENDING PUSH-----------');
		return('Error sending: ' + error);
	});
}

function sendActivityPush(activity, subactivity){
	var type = subactivity.object.className;
	var author = subactivity.object.attributes.author.id;
	var text = subactivity.object.attributes.text;
	var tags = subactivity.object.attributes.tags;

	var activityType = activity.className;
	var activityId = activity.id;
	
	var all = '*';
	
	var channels = [];
	channels.push(['create',	all,		all].join('-')); //General create action
	channels.push(['create',	activityType,	all].join('-')); //General activity channel
	channels.push(['create',	type,		all].join('-')); //Subactivity activity channel

console.log('-------target channels-------', channels);
	
	var data = {
		alert: 'New publish on Apps4Corporate'
	};
	pushNotification(channels, data);
}

function getChannels(channel){
	var aChannel = chennel.split('-');
	var action = '*';
	var type = '*';
	var target = '*';
	var all = '*';
	
	if(typeof aChannel[0] != 'undefined') action = aChannel[0];
	if(typeof aChannel[1] != 'undefined') type = aChannel[1];
	if(typeof aChannel[2] != 'undefined') target = aChannel[2];

	var channels = [];
	
	//Generate permutations
	channels.push([action,	all,	all].join('-'));
	channels.push([action,	all,	target].join('-'));
	channels.push([action,	type,	all].join('-'));
	channels.push([action,	type,	target].join('-'));
	channels.push([all,	all,	all].join('-'));
	channels.push([all,	all,	target].join('-'));
	channels.push([all,	type,	all].join('-'));
	channels.push([all,	type,	target].join('-'));

	return channels;
	
}

Parse.Cloud.define("pushOld", function(request, response) {
	var query = new Parse.Query("Post");
	
	 query.get(request.params.objectId, {
	    success: function(post) {
	      post.increment("push");
	      var text = post.get("text");
	      post.save();
	      var queryPush = new Parse.Query(Parse.Installation);
		  //query.notEqualTo("installationId", post.installationID);
		  queryPush.equalTo('channels', 'NewPosts2');
		  console.log(text);
		  Parse.Push.send({
			  where: queryPush, // Set our Installation query
			  data: {
			    alert: text,
			  }
			}, {
			  success: function(post) {
				  response.success(request.params.objectId);
				
			  },
			  error: function(error) {

			  }
			});
	    },
	    error: function(error) {
	      console.error("Got an error " + error.code + " : " + error.message);
	    }
	 });
	  
});

/*
*
*/
var getUserRoles = function(user){		
	var roleQuery = new Parse.Query(Parse.Role);
	roleQuery.equalTo('users', user);
	return roleQuery.find({useMasterKey:true}).then(function(users){
		return users;
	},
	function(error){
				console.log('+++++users error',users);
		return error;
	});
}

/**
* Check if user has role
*/
var userHasRole = function(user, rolenames) {
  	var roleQuery = new Parse.Query(Parse.Role);
	roleQuery.containedIn('name', rolenames);
	roleQuery.equalTo('users', user);

	return roleQuery.first({useMasterKey: true}).then(function(role) {
  		if (!role) {
   		 throw new Error('nopermission');
  		}
		return role;
	});
}

var getWorkgroupRole = function(){
	var roleQuery = new Parse.Query(Parse.Role);
	roleQuery.equal('name', 'workgroup');
	
	return roleQuery.first({useMasterKey: true}).then(function(role) {
  		if (!role) {
   		 throw new Error('nosuchrole');
  		}
		return role;
	});
}

var isAuthor = function(request){
	var Profile = Parse.Object.extend("Profile");
	var query = new Parse.Query(Profile);
	var pointer = {
			"__type": "Pointer",
			"className": "_User",
			"objectId": request.user.id
		}
	query.equalTo("user", pointer);
	var result = query.first().then(function(object){
		console.log('Object',object);
		if(object.attributes.user.id == request.user.id) result.resolve('Wellcome');
		else result.resolve('Really?');
	});
	return result;
}

var getRequesterProfile = function(request){
	var Profile = Parse.Object.extend("Profile");
	var query = new Parse.Query(Profile);
	var pointer = {
			"__type": "Pointer",
			"className": "_User",
			"objectId": request.user.id
		}
	query.equalTo("user", pointer);
	var result = query.first().then(
		function(object){
			console.log('requester profile',object);
			result.resolve(object);
			//else result.resolve('Really?');
		},
		function(error){
			result.reject(error)
		}
	);
	return result;
}

var getMsgProfiles = function(profiles){	
	var Profile = Parse.Object.extend("Profile");
	var query = new Parse.Query(Profile);
	query.containedIn('objectId',profiles);
	var result = query.find({
		success: function(results) {
			result.resolve(results);
	  	},
		error: function(error){
			result.reject(error);
		}
  	});
	return result;
}

Parse.Cloud.define("getUserMsgGroups", function(request,response){
	getRequesterProfile(request).then(function(success){ //Get requester profile id
		var profileId = success.id;
		var Message = Parse.Object.extend("Message");
		var query = new Parse.Query(Message);
		query.find({sessionToken: request.user.getSessionToken()}).then(
			function(success){
				response.success(success);
			}
		);
	}).catch(function(error){
		response.error(error);
	});
});

Parse.Cloud.define("markAsRead", function(request,response){
	getRequesterProfile(request).then(function(success){ //Get requester profile id
		var profileId = success.id;
		var items = request.params.msgs;
		var Message = Parse.Object.extend("Message");
		var query = new Parse.Query(Message);
		query.containedIn("objectId", items);
		query.find({sessionToken: request.user.getSessionToken()}).then(
			function(results){ //Find unread msgs
				var toSave = results.map(function(item){
					var msg = new Message;
					msg.set('id', item.id);
					msg.addUnique("read", profileId);
					return msg;
				});
				Parse.Object.saveAll(toSave,{sessionToken: request.user.getSessionToken()}).then(
					function(saved){response.success(saved);},
					function(error){response.error(error);}
				);
			},
			function(error){response.error(error);}
		);
	}).catch(function(error){
		response.error(error);
	});
});

Parse.Cloud.define("unreadAll", function(request,response){
		var Message = Parse.Object.extend("Message");
		var query = new Parse.Query(Message);
		query.find({useMasterKey: true}).then(
			function(results){ //Find unread msgs
				console.log('FINDALL',results);
				//response.success(results)
				var toSave = results.map(function(item){
					var msg = new Message;
					msg.set('id', item.id);
					msg.set("read", []);
					return msg;
				});
				//response.success(toSave);
				try{
				Parse.Object.saveAll(toSave,{useMasterKey: true}).then(
					function(saved){response.success(saved);},
					function(error){response.error(error);}
				);
				}
				catch(e){
					console.log('Exception',e);
				}
			},
			function(error){response.error(error);}
		);

});
